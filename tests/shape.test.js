import { describe, it, expect } from 'vitest';
import { deadEndCells, hasIslands, cutsGrid, freeGridOfCells } from '../src/core/shape.js';

// Build a blocked set from ASCII rows: '#' is blocked, anything else free. Rows may be shorter than size; the rest is free.
const board = (rows, size = rows.length) => {
  const blocked = new Set();
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') blocked.add(`${x},${y}`); }));
  return { blocked, size };
};
const wallsAround = (size, open) => {
  const blocked = new Set();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!open(x, y)) blocked.add(`${x},${y}`);
  return blocked;
};

describe('deadEndCells', () => {
  it('has none on an empty board', () => {
    expect(deadEndCells(new Set(), 10).size).toBe(0);
  });
  it.each([1, 3, 6])('peels every cell of a dead-end corridor of length %i off an open area', (n) => {
    // open 5x5 room at x 0..4, y 0..4; corridor along y=2 from x=5 going right, closed at the end
    const open = (x, y) => (x <= 4 && y <= 4) || (y === 2 && x >= 5 && x < 5 + n);
    const dead = deadEndCells(wallsAround(12, open), 12);
    const expected = Array.from({ length: n }, (_, i) => `${5 + i},2`).sort();
    expect([...dead].sort()).toEqual(expected);
  });
  it('does not peel an open 5x5 area', () => {
    expect(deadEndCells(wallsAround(10, (x, y) => x < 5 && y < 5), 10).size).toBe(0);
  });
  it('does not peel a 2x2 pocket', () => {
    expect(deadEndCells(wallsAround(10, (x, y) => x >= 4 && x <= 5 && y >= 4 && y <= 5), 10).size).toBe(0);
  });
  it('does not peel a ring', () => {
    const ring = (x, y) => x >= 2 && x <= 6 && y >= 2 && y <= 6 && !(x > 2 && x < 6 && y > 2 && y < 6);
    expect(deadEndCells(wallsAround(10, ring), 10).size).toBe(0);
  });
  it('counts the neighbour above a cell in the second row (3x3 ring around a blocked centre)', () => {
    expect(deadEndCells(new Set(['1,1']), 3).size).toBe(0);
  });
  it('does not peel a corridor that joins two open areas', () => {
    const open = (x, y) => (x <= 2 && y <= 2) || (x >= 6 && x <= 8 && y <= 2) || (y === 1 && x > 2 && x < 6);
    expect(deadEndCells(wallsAround(10, open), 10).size).toBe(0);
  });
  it('counts a single free corner cell behind two blocked neighbours', () => {
    const { blocked, size } = board(['.#', '#.'], 10);
    // (0,0) has right and down blocked and the border on the other sides
    expect([...deadEndCells(new Set(['1,0', '0,1']), 10)]).toContain('0,0');
    expect(blocked.size).toBe(2);
    expect(size).toBe(10);
  });
  it('counts a cell with exactly one free neighbour (<= 1) and peels onward', () => {
    // free: (0,0) and (1,0) only on a 2x2 board with the bottom row blocked: both have <= 1 free neighbour
    expect([...deadEndCells(new Set(['0,1', '1,1']), 2)].sort()).toEqual(['0,0', '1,0']);
  });
  it('honours the size parameter (border at 10 and at 50)', () => {
    expect(deadEndCells(new Set(['8,9', '9,8']), 10).has('9,9')).toBe(true);
    expect(deadEndCells(new Set(['8,9', '9,8']), 50).has('9,9')).toBe(false);
    expect(deadEndCells(new Set(['48,49', '49,48']), 50).has('49,49')).toBe(true);
  });
  it('ignores blocked keys outside the board', () => {
    expect(deadEndCells(new Set(['60,60']), 10).size).toBe(0);
  });
});

describe('hasIslands', () => {
  it('is false for an empty board and for a board with no free cells', () => {
    expect(hasIslands(new Set(), 10)).toBe(false);
    expect(hasIslands(wallsAround(4, () => false), 4)).toBe(false);
  });
  it('is false for one free cell', () => {
    expect(hasIslands(wallsAround(4, (x, y) => x === 1 && y === 1), 4)).toBe(false);
  });
  it('is true for a corner cell cut off by two walls', () => {
    expect(hasIslands(new Set(['1,0', '0,1']), 10)).toBe(true);
  });
  it('is true for a larger pocket cut off', () => {
    const wall = new Set(['3,0', '3,1', '3,2', '0,3', '1,3', '2,3']);
    expect(hasIslands(wall, 10)).toBe(true);
  });
  it('is true for two separate regions', () => {
    expect(hasIslands(wallsAround(10, (x) => x !== 5), 10)).toBe(true);
  });
  it('is false for a connected board with walls', () => {
    const wall = new Set(['3,0', '3,1', '3,2', '3,3', '3,4', '6,9', '6,8', '6,7']);
    expect(hasIslands(wall, 10)).toBe(false);
  });
  it('does not connect cells diagonally', () => {
    expect(hasIslands(new Set(['1,0', '0,1']), 2)).toBe(true);
  });
  it('honours the size (a wall line splits 10 but the same keys leave a 50 board connected)', () => {
    const line = new Set(Array.from({ length: 10 }, (_, y) => `5,${y}`));
    expect(hasIslands(line, 10)).toBe(true);
    expect(hasIslands(line, 50)).toBe(false);
  });
});

describe('cutsGrid and freeGridOfCells', () => {
  it('builds the same grid from cells as from keys', () => {
    const g = freeGridOfCells([{ x: 1, y: 0 }, { x: 9, y: 9 }, { x: 99, y: 0 }], 10);
    expect(g[1]).toBe(0);
    expect(g[99]).toBe(0);
    expect(g.reduce((a, b) => a + b, 0)).toBe(98);
  });
  it('detects a cut, leaves the grid as it found it, and accepts a harmless block', () => {
    const g = freeGridOfCells([{ x: 1, y: 0 }], 10);
    const before = g.slice();
    expect(cutsGrid(g, 10, [10])).toBe(true); // (0,1) isolates (0,0)
    expect(g).toEqual(before);
    expect(cutsGrid(g, 10, [55])).toBe(false);
    expect(cutsGrid(g, 10, [0, 11].slice(0, 1))).toBe(false);
    expect(g).toEqual(before);
  });
  it('sees a cut made by a long segment across the board', () => {
    const g = new Uint8Array(100).fill(1);
    expect(cutsGrid(g, 10, Array.from({ length: 10 }, (_, y) => y * 10 + 5))).toBe(true);
    expect(cutsGrid(g, 10, Array.from({ length: 9 }, (_, y) => y * 10 + 5))).toBe(false);
  });
});
