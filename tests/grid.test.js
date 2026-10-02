import { describe, it, expect } from 'vitest';
import { cellKey, sameCell, inBounds, manhattan, neighbors, allCells } from '../src/core/grid.js';

describe('grid helpers', () => {
  it('keys a cell as "x,y"', () => {
    expect(cellKey({ x: 3, y: 4 })).toBe('3,4');
  });
  it('compares cells by value', () => {
    expect(sameCell({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(sameCell({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
  });
  it('knows the 20x20 bounds', () => {
    expect(inBounds({ x: 0, y: 0 })).toBe(true);
    expect(inBounds({ x: 19, y: 19 })).toBe(true);
    expect(inBounds({ x: 20, y: 0 })).toBe(false);
    expect(inBounds({ x: 5, y: -1 })).toBe(false);
  });
  it('measures Manhattan distance', () => {
    expect(manhattan({ x: 1, y: 2 }, { x: 4, y: 6 })).toBe(7);
  });
  it('lists only in-bounds neighbours', () => {
    expect(neighbors({ x: 0, y: 0 })).toEqual([{ x: 0, y: 1 }, { x: 1, y: 0 }]);
    expect(neighbors({ x: 10, y: 10 })).toHaveLength(4);
  });
  it('lists all 400 cells row by row', () => {
    const cells = allCells();
    expect(cells).toHaveLength(400);
    expect(cells[0]).toEqual({ x: 0, y: 0 });
    expect(cells[1]).toEqual({ x: 1, y: 0 });
    expect(cells[399]).toEqual({ x: 19, y: 19 });
  });
});

describe('grid helpers on other sizes', () => {
  it('knows custom bounds', () => {
    expect(inBounds({ x: 9, y: 9 }, 10)).toBe(true);
    expect(inBounds({ x: 10, y: 0 }, 10)).toBe(false);
    expect(inBounds({ x: 49, y: 49 }, 50)).toBe(true);
    expect(inBounds({ x: 20, y: 0 })).toBe(false); // default stays 20
  });
  it('limits neighbours to the board', () => {
    expect(neighbors({ x: 9, y: 9 }, 10)).toHaveLength(2);
    expect(neighbors({ x: 19, y: 19 }, 50)).toHaveLength(4);
  });
  it('lists size × size cells', () => {
    expect(allCells(10)).toHaveLength(100);
    expect(allCells(50)).toHaveLength(2500);
    expect(allCells(10).at(-1)).toEqual({ x: 9, y: 9 });
  });
});
