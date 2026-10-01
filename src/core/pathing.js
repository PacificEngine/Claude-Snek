import { cellKey, neighbors } from './grid.js';

// Earliest-arrival BFS is conservative: it never allows a bad placement but may reject a good one.
// Cells the snake's head can reach. `blocked` holds permanently blocked "x,y" keys
// (walls, bomb, enemy). A body cell `i` steps behind the head (head is 0) is
// vacated after `length - i` steps, so it can only be entered at step >= length - i.
export function reachable(snake, blocked) {
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
      for (const n of neighbors(cell)) {
        const key = cellKey(n);
        if (seen.has(key) || blocked.has(key)) continue;
        const i = bodyIndex.get(key);
        if (i !== undefined && steps < length - i) continue;
        seen.add(key);
        next.push(n);
      }
    }
    frontier = next;
  }
  return seen;
}

export const hasRoute = (snake, blocked, food) =>
  food !== null && reachable(snake, blocked).has(cellKey(food));
