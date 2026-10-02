import { GRID_SIZE } from './config.js';

export const VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
export const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const cellKey = ({ x, y }) => `${x},${y}`;
export const sameCell = (a, b) => a.x === b.x && a.y === b.y;
export const inBounds = ({ x, y }, size = GRID_SIZE) => x >= 0 && y >= 0 && x < size && y < size;
export const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export const neighbors = (cell, size = GRID_SIZE) =>
  Object.values(VECTORS)
    .map((v) => ({ x: cell.x + v.x, y: cell.y + v.y }))
    .filter((n) => inBounds(n, size));

export function allCells(size = GRID_SIZE) {
  const cells = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) cells.push({ x, y });
  }
  return cells;
}
