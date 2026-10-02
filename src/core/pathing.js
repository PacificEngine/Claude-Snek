import { GRID_SIZE } from './config.js';
import { cellKey, neighbors } from './grid.js';

// Earliest-arrival BFS is conservative: it never allows a bad placement but may reject a good one.
// Cells the snake's head can reach. `blocked` holds permanently blocked "x,y" keys
// (walls, bomb, enemy). A body cell `i` steps behind the head (head is 0) is
// vacated after `length - i` steps, so it can only be entered at step >= length - i.
// While `pending` cells of growth are still due the tail stays put, so every body cell
// clears `pending` steps later.
export function reachable(snake, blocked, size = GRID_SIZE, pending = 0) {
  const length = snake.length;
  const bodyIndex = new Map(snake.map((cell, i) => [cellKey(cell), i]));
  const head = snake[0];
  const seen = new Set([cellKey(head)]);
  let frontier = [head];
  let steps = 0;
  while (frontier.length > 0) {
    steps += 1;
    const next = [];
    for (const cell of frontier) {
      for (const n of neighbors(cell, size)) {
        const key = cellKey(n);
        if (seen.has(key) || blocked.has(key)) continue;
        const i = bodyIndex.get(key);
        if (i !== undefined && steps < length - i + pending) continue;
        seen.add(key);
        next.push(n);
      }
    }
    frontier = next;
  }
  return seen;
}

export const hasRoute = (snake, blocked, food, size = GRID_SIZE, pending = 0) =>
  food !== null && reachable(snake, blocked, size, pending).has(cellKey(food));
