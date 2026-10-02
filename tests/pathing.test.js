import { describe, it, expect } from 'vitest';
import { reachable, hasRoute } from '../src/core/pathing.js';

const snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
const column = (x) => new Set(Array.from({ length: 20 }, (_, y) => `${x},${y}`));

describe('reachable', () => {
  it('reaches every cell on an empty board (body cells vacate in time)', () => {
    expect(reachable(snake, new Set()).size).toBe(400);
  });

  it('cannot cross a full wall', () => {
    const cells = reachable(snake, column(10));
    expect(cells.has('15,5')).toBe(false);
    expect(cells.has('9,5')).toBe(true);
  });

  it('can enter the tail cell on the next step (tail-follow)', () => {
    // a 2x2 coil: head (0,0), tail (0,1)
    const coil = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const cells = reachable(coil, new Set());
    expect(cells.has('0,1')).toBe(true);
    expect(cells.has('0,2')).toBe(true);
  });

  it('cannot go through a body cell that has not vacated yet', () => {
    const line = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
    // (0,1) is blocked, so the only way out is through the body at (1,0)
    const cells = reachable(line, new Set(['0,1']));
    expect(cells.size).toBe(1);
  });
});

describe('hasRoute', () => {
  it('is true when the food is reachable', () => {
    expect(hasRoute(snake, new Set(), { x: 15, y: 15 })).toBe(true);
  });
  it('is false when the food is walled off', () => {
    expect(hasRoute(snake, column(10), { x: 15, y: 5 })).toBe(false);
  });
  it('is false when there is no food', () => {
    expect(hasRoute(snake, new Set(), null)).toBe(false);
  });
});

describe('other board sizes', () => {
  const small = [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }];
  it('reaches every cell of a 10x10 board and nothing outside it', () => {
    const cells = reachable(small, new Set(), 10);
    expect(cells.size).toBe(100);
    expect(cells.has('10,2')).toBe(false);
  });
  it('is split by a full wall on a 10x10 board', () => {
    const wall = new Set(Array.from({ length: 10 }, (_, y) => `5,${y}`));
    expect(hasRoute(small, wall, { x: 8, y: 2 }, 10)).toBe(false);
    expect(hasRoute(small, new Set(), { x: 8, y: 2 }, 10)).toBe(true);
  });
  it('covers a 50x50 board', () => {
    expect(reachable(small, new Set(), 50).size).toBe(2500);
  });

  it('keeps the tail in place for pending growth', () => {
    const coil = [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 }, { x: 0, y: 1 }];
    const blocked = new Set(['2,1', '1,0']);
    expect(reachable(coil, blocked, 3).has('0,0')).toBe(true);
    expect(reachable(coil, blocked, 3, 1).has('0,0')).toBe(false);
  });
  it('lets hasRoute take pending growth into account', () => {
    const coil = [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 }, { x: 0, y: 1 }];
    const blocked = new Set(['2,1', '1,0']);
    expect(hasRoute(coil, blocked, { x: 0, y: 0 }, 3)).toBe(true);
    expect(hasRoute(coil, blocked, { x: 0, y: 0 }, 3, 1)).toBe(false);
  });
});
