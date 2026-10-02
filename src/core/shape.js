// Shape rules for the board: which free cells are dead ends, and whether walls cut the board into islands.
// `blocked` is a Set (or array) of "x,y" keys; the board edge blocks too. Inside, the board is a Uint8Array
// of free cells (1 = free) indexed y * size + x, which keeps repeated checks during placement cheap.

// The same grid built straight from {x, y} cells (no key strings), for hot paths.
export function freeGridOfCells(cells, size) {
  const free = new Uint8Array(size * size).fill(1);
  for (const { x, y } of cells) {
    if (x >= 0 && y >= 0 && x < size && y < size) free[y * size + x] = 0;
  }
  return free;
}

export function freeGrid(blocked, size) {
  const free = new Uint8Array(size * size).fill(1);
  for (const key of blocked) {
    const [x, y] = key.split(',').map(Number);
    if (x >= 0 && y >= 0 && x < size && y < size) free[y * size + x] = 0;
  }
  return free;
}

// Peels a free-cell grid: repeatedly removes every free cell with at most one free neighbour.
// Returns the removed cells as a 0/1 array.
export function peel(free, size) {
  const n = size * size;
  const last = n - size;
  const degree = new Uint8Array(n);
  const queue = [];
  for (let i = 0; i < n; i++) {
    if (!free[i]) continue;
    const x = i % size;
    let d = 0;
    if (x > 0 && free[i - 1]) d++;
    if (x < size - 1 && free[i + 1]) d++;
    if (i >= size && free[i - size]) d++;
    if (i < last && free[i + size]) d++;
    degree[i] = d;
    if (d <= 1) queue.push(i);
  }
  const removed = new Uint8Array(n);
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    if (removed[i]) continue;
    removed[i] = 1;
    const x = i % size;
    const drop = (j) => {
      if (!free[j] || removed[j]) return;
      degree[j] -= 1;
      if (degree[j] <= 1) queue.push(j);
    };
    if (x > 0) drop(i - 1);
    if (x < size - 1) drop(i + 1);
    if (i >= size) drop(i - size);
    if (i < last) drop(i + size);
  }
  return removed;
}

// Free cells that peeling leaves behind nothing of: repeatedly remove every free cell with at most one free neighbour.
export function deadEndCells(blocked, size) {
  const removed = peel(freeGrid(blocked, size), size);
  const dead = new Set();
  removed.forEach((r, i) => { if (r) dead.add(`${i % size},${Math.floor(i / size)}`); });
  return dead;
}

// Flood fill over free cells from `start`. Calls nothing; returns how many were reached, stopping early once all
// `targets` (indices) have been seen when `targets` is given.
function flood(free, size, start, seen, targets) {
  const last = size * size - size;
  const stack = [start];
  seen[start] = 1;
  let count = 0;
  let missing = targets ? targets.filter((t) => t !== start).length : 0;
  const visit = (j) => {
    if (!free[j] || seen[j]) return;
    seen[j] = 1;
    stack.push(j);
    if (targets && targets.includes(j)) missing -= 1;
  };
  while (stack.length > 0) {
    if (targets && missing === 0) return count;
    const i = stack.pop();
    count += 1;
    const x = i % size;
    if (x > 0) visit(i - 1);
    if (x < size - 1) visit(i + 1);
    if (i >= size) visit(i - size);
    if (i < last) visit(i + size);
  }
  return count;
}

// True when the free cells (1 in the grid) are not all in one 4-connected region (no free cells at all is fine).
export function gridHasIslands(free, size) {
  let total = 0;
  let start = -1;
  for (let i = 0; i < free.length; i++) {
    if (free[i]) { total += 1; if (start < 0) start = i; }
  }
  if (total === 0) return false;
  return flood(free, size, start, new Uint8Array(free.length)) !== total;
}

// For a grid that is one connected region: would blocking `cells` (indices, currently free) leave islands?
// Only the free neighbours of the blocked cells can be separated, so the search stops as soon as they are all met.
export function cutsGrid(free, size, cells) {
  const last = size * size - size;
  cells.forEach((i) => { free[i] = 0; });
  const around = [];
  cells.forEach((i) => {
    const x = i % size;
    if (x > 0 && free[i - 1]) around.push(i - 1);
    if (x < size - 1 && free[i + 1]) around.push(i + 1);
    if (i >= size && free[i - size]) around.push(i - size);
    if (i < last && free[i + size]) around.push(i + size);
  });
  let cut = false;
  if (around.length > 1) {
    const seen = new Uint8Array(free.length);
    flood(free, size, around[0], seen, around);
    cut = around.some((j) => !seen[j]);
  }
  cells.forEach((i) => { free[i] = 1; });
  return cut;
}

export const hasIslands = (blocked, size) => gridHasIslands(freeGrid(blocked, size), size);
