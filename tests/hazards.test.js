import { describe, it, expect } from 'vitest';
import {
  emptyHazards, hazardCells, blockedKeys, isSolid, hitsHazard,
  isGhostVisible, wallOpacity, placeSegment, placeCell, spawnForApple, stepHazards,
  SAFE_DISTANCE, LANE_LENGTH, WALL_CELL_CAP,
} from '../src/core/hazards.js';
import { hasRoute } from '../src/core/pathing.js';
import { cellKey, manhattan } from '../src/core/grid.js';

// small deterministic generator for repeatable "random" placement
const seeded = (seed) => {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const cycle = (...values) => { let i = 0; return () => values[i++ % values.length]; };

const snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
const wall = (cells, age = 0, fades = false) => ({ cells, age, fades });
const world = (overrides = {}) => ({
  snake, direction: 'right', food: { x: 3, y: 3 }, hazards: emptyHazards(), ...overrides,
});

describe('hazard bookkeeping', () => {
  it('starts empty', () => {
    expect(emptyHazards()).toEqual({ walls: [], bomb: null, enemy: null });
  });
  it('lists every hazard cell as blocked', () => {
    const h = {
      walls: [wall([{ x: 1, y: 1 }, { x: 2, y: 1 }])],
      bomb: { cells: [{ x: 5, y: 5 }], age: 0 },
      enemy: { cells: [{ x: 7, y: 7 }, { x: 8, y: 7 }, { x: 9, y: 7 }], age: 0, status: 'ghost' },
    };
    expect(hazardCells(h)).toHaveLength(6);
    expect(blockedKeys(h)).toEqual(new Set(['1,1', '2,1', '5,5', '7,7', '8,7', '9,7']));
  });
});

describe('solid versus ghost', () => {
  it('is a ghost for the first 24 steps', () => {
    expect(isSolid(wall([{ x: 1, y: 1 }], 23), snake)).toBe(false);
    expect(isSolid(wall([{ x: 1, y: 1 }], 24), snake)).toBe(true);
  });
  it('stays a ghost while the snake is on it', () => {
    expect(isSolid(wall([{ x: 9, y: 10 }, { x: 9, y: 11 }], 30), snake)).toBe(false);
  });
});

describe('hitsHazard', () => {
  const h = {
    walls: [wall([{ x: 12, y: 10 }], 30)],
    bomb: { cells: [{ x: 14, y: 10 }], age: 30 },
    enemy: { cells: [{ x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }], age: 0, status: 'alive' },
  };
  it('hits a solid wall, the solid bomb, and a live enemy', () => {
    expect(hitsHazard(h, { x: 12, y: 10 }, snake)).toBe(true);
    expect(hitsHazard(h, { x: 14, y: 10 }, snake)).toBe(true);
    expect(hitsHazard(h, { x: 17, y: 10 }, snake)).toBe(true);
  });
  it('hits a dead enemy', () => {
    const dead = { ...h, enemy: { ...h.enemy, status: 'dead' } };
    expect(hitsHazard(dead, { x: 16, y: 10 }, snake)).toBe(true);
  });
  it('passes through ghosts', () => {
    const ghosts = {
      walls: [wall([{ x: 12, y: 10 }], 5)],
      bomb: { cells: [{ x: 14, y: 10 }], age: 5 },
      enemy: { ...h.enemy, status: 'ghost' },
    };
    expect(hitsHazard(ghosts, { x: 12, y: 10 }, snake)).toBe(false);
    expect(hitsHazard(ghosts, { x: 14, y: 10 }, snake)).toBe(false);
    expect(hitsHazard(ghosts, { x: 16, y: 10 }, snake)).toBe(false);
  });
  it('does not hit empty cells', () => {
    expect(hitsHazard(h, { x: 1, y: 1 }, snake)).toBe(false);
  });
});

describe('visuals', () => {
  it('flashes in 4-step blocks, then stays steady for the last 4 steps before solid', () => {
    const visible = (from, to) => Array.from({ length: to - from + 1 }, (_, k) => isGhostVisible(from + k));
    expect(visible(0, 3).every(Boolean)).toBe(true);
    expect(visible(4, 7).some(Boolean)).toBe(false);
    expect(visible(8, 11).every(Boolean)).toBe(true);
    expect(visible(12, 15).some(Boolean)).toBe(false);
    expect(visible(16, 19).every(Boolean)).toBe(true);
    expect(visible(20, 23).every(Boolean)).toBe(true);
  });
  it('stays visible under reduced motion', () => {
    expect([4, 5, 6, 7, 16, 17].every((a) => isGhostVisible(a, true))).toBe(true);
  });
  it('keeps ordinary walls fully opaque', () => {
    expect(wallOpacity(wall([{ x: 1, y: 1 }], 500, false))).toBe(1);
  });
  it('fades late walls over 40 steps after they turn solid', () => {
    const cells = [{ x: 1, y: 1 }];
    expect(wallOpacity(wall(cells, 10, true))).toBe(1);
    expect(wallOpacity(wall(cells, 24, true))).toBe(1);
    expect(wallOpacity(wall(cells, 44, true))).toBeCloseTo(0.5);
    expect(wallOpacity(wall(cells, 64, true))).toBe(0);
    expect(wallOpacity(wall(cells, 500, true))).toBe(0);
  });
});

describe('safe placement', () => {
  const lane = (c) => c.y === 10 && c.x > 10 && c.x <= 10 + LANE_LENGTH;

  it('places a straight segment of the requested length inside the board', () => {
    const cells = placeSegment(world(), 3, seeded(1));
    expect(cells).toHaveLength(3);
    const sameRow = cells.every((c) => c.y === cells[0].y);
    const sameCol = cells.every((c) => c.x === cells[0].x);
    expect(sameRow || sameCol).toBe(true);
    cells.forEach((c) => {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(20);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(20);
    });
  });

  it('keeps clear of the head, its straight-ahead lane, the snake and the food', () => {
    let placed = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const cells = placeSegment(world(), 3, seeded(seed));
      if (!cells) continue;
      placed++;
      cells.forEach((c) => {
        expect(manhattan(c, snake[0])).toBeGreaterThanOrEqual(SAFE_DISTANCE);
        expect(lane(c)).toBe(false);
        expect(snake.some((s) => s.x === c.x && s.y === c.y)).toBe(false);
        expect(c.x === 3 && c.y === 3).toBe(false);
      });
    }
    expect(placed).toBeGreaterThan(50);
  });

  it('does not overlap existing hazards', () => {
    const existing = { walls: [wall([{ x: 15, y: 15 }, { x: 16, y: 15 }, { x: 17, y: 15 }])], bomb: null, enemy: null };
    let placed = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const cells = placeSegment(world({ hazards: existing }), 3, seeded(seed));
      if (!cells) continue;
      placed++;
      expect(cells.some((c) => c.y === 15 && c.x >= 15 && c.x <= 17)).toBe(false);
    }
    expect(placed).toBeGreaterThan(0);
  });

  it('never leaves the food unreachable', () => {
    // a barrier at x=15 from y=0..18 leaves one gap at (15,19)
    const barrier = wall(Array.from({ length: 19 }, (_, y) => ({ x: 15, y })), 30);
    const hazards = { walls: [barrier], bomb: null, enemy: null };
    const food = { x: 18, y: 5 };
    let placed = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const cells = placeSegment(world({ hazards, food }), 2, seeded(seed));
      if (!cells) continue;
      placed++;
      const blocked = new Set([...blockedKeys(hazards), ...cells.map(cellKey)]);
      expect(hasRoute(snake, blocked, food)).toBe(true);
    }
    expect(placed).toBeGreaterThan(0);
  });

  it('rejects a cell that would plug the only gap, then skips', () => {
    const barrier = wall(Array.from({ length: 19 }, (_, y) => ({ x: 15, y })), 30);
    const hazards = { walls: [barrier], bomb: null, enemy: null };
    // rng always yields x=15, y=19 (the gap)
    const gap = cycle(0.76, 0.96);
    expect(placeCell(world({ hazards, food: { x: 18, y: 5 } }), gap)).toBeNull();
  });

  it('skips when every attempt lands on the snake', () => {
    expect(placeCell(world(), cycle(0.5, 0.5))).toBeNull();
  });
});

describe('spawnForApple', () => {
  const w = () => ({ snake, direction: 'right', food: { x: 3, y: 3 } });
  const segmentsOf = (h) => h.walls.map((x) => x.cells.length).sort();

  it('adds nothing below tier 2', () => {
    expect(spawnForApple(w(), emptyHazards(), seeded(1), 15)).toEqual(emptyHazards());
  });

  it('places four 3-cell walls on the apple that reaches tier 2', () => {
    const h = spawnForApple(w(), emptyHazards(), seeded(1), 16);
    expect(segmentsOf(h)).toEqual([3, 3, 3, 3]);
    expect(h.walls.every((x) => x.age === 0 && x.fades === false)).toBe(true);
    expect(h.bomb).toBeNull();
  });

  it('adds no more walls on later apples until tier 6', () => {
    const start = spawnForApple(w(), emptyHazards(), seeded(1), 16);
    expect(spawnForApple(w(), start, seeded(2), 17).walls).toEqual(start.walls);
  });

  it('places the bomb at tier 4 and moves it on every later apple', () => {
    const first = spawnForApple(w(), emptyHazards(), seeded(1), 32);
    expect(first.bomb.cells).toHaveLength(1);
    expect(first.bomb.age).toBe(0);
    const aged = { ...first, bomb: { ...first.bomb, age: 30 } };
    const moved = spawnForApple(w(), aged, seeded(5), 33);
    expect(moved.bomb.age).toBe(0);
    expect(moved.bomb.cells[0]).not.toEqual(first.bomb.cells[0]);
  });

  it('adds one 2-cell wall per apple from tier 6', () => {
    const one = spawnForApple(w(), emptyHazards(), seeded(1), 48);
    expect(segmentsOf(one)).toEqual([2]);
    const two = spawnForApple(w(), one, seeded(2), 49);
    expect(segmentsOf(two)).toEqual([2, 2]);
  });

  it('stops adding walls at the 80-cell cap', () => {
    const full = {
      walls: Array.from({ length: 40 }, (_, i) =>
        wall([{ x: i % 20, y: 2 * Math.floor(i / 20) }, { x: i % 20, y: 2 * Math.floor(i / 20) + 1 }], 30)),
      bomb: null,
      enemy: null,
    };
    expect(WALL_CELL_CAP).toBe(80);
    expect(spawnForApple(w(), full, seeded(1), 50).walls).toHaveLength(40);
  });

  it('spawns a ghost enemy at tier 8', () => {
    const h = spawnForApple(w(), emptyHazards(), seeded(1), 64);
    expect(h.enemy.cells).toHaveLength(3);
    expect(h.enemy.status).toBe('ghost');
    expect(h.enemy.age).toBe(0);
  });

  it('leaves a live enemy alone but replaces a dead one', () => {
    const base = spawnForApple(w(), emptyHazards(), seeded(1), 64);
    const alive = { ...base, enemy: { ...base.enemy, status: 'alive', age: 9 } };
    expect(spawnForApple(w(), alive, seeded(2), 65).enemy).toEqual(alive.enemy);
    const dead = { ...base, enemy: { ...base.enemy, status: 'dead', age: 9 } };
    const respawned = spawnForApple(w(), dead, seeded(3), 65).enemy;
    expect(respawned.status).toBe('ghost');
    expect(respawned.age).toBe(0);
  });

  it('re-lays every wall at tier 10, keeping count and lengths', () => {
    const start = spawnForApple(w(), emptyHazards(), seeded(1), 16);
    const aged = { ...start, walls: start.walls.map((x) => ({ ...x, age: 40 })) };
    const relaid = spawnForApple(w(), aged, seeded(9), 80);
    // four 3-cell walls plus the per-apple 2-cell wall added on this apple, all re-laid
    expect(segmentsOf(relaid)).toEqual([2, 3, 3, 3, 3]);
    expect(relaid.walls.every((x) => x.age === 0)).toBe(true);
  });

  it('keeps every wall exactly where it was when no re-lay spot can be found', () => {
    const walls = [
      wall([{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }], 40, true),
      wall([{ x: 15, y: 15 }, { x: 15, y: 16 }], 33, false),
    ];
    const kept = spawnForApple(w(), { walls, bomb: null, enemy: null }, cycle(0.5, 0.5), 100);
    expect(kept.walls).toEqual(walls);
  });

  it('keeps the old bomb, cells and age, when no new spot can be found', () => {
    const bomb = { cells: [{ x: 15, y: 15 }], age: 30 };
    const kept = spawnForApple(w(), { walls: [], bomb, enemy: null }, cycle(0.5, 0.5), 33);
    expect(kept.bomb).toEqual(bomb);
  });

  it('keeps a dead enemy as an obstacle when no respawn spot can be found', () => {
    const enemy = { cells: [{ x: 15, y: 15 }, { x: 16, y: 15 }, { x: 17, y: 15 }], age: 9, status: 'dead' };
    const kept = spawnForApple(w(), { walls: [], bomb: null, enemy }, cycle(0.5, 0.5), 65);
    expect(kept.enemy).toEqual(enemy);
  });

  it('marks re-laid walls as fading only from 100 apples', () => {
    const start = spawnForApple(w(), emptyHazards(), seeded(1), 16);
    expect(spawnForApple(w(), start, seeded(2), 99).walls.every((x) => !x.fades)).toBe(true);
    expect(spawnForApple(w(), start, seeded(2), 100).walls.every((x) => x.fades)).toBe(true);
  });
});

describe('stepHazards', () => {
  const foodAt = { x: 18, y: 5 };
  const step = (h, rng = seeded(1), s = snake, food = foodAt) => stepHazards(h, { snake: s, food }, rng);

  it('ages walls, the bomb and the enemy by one step', () => {
    const h = {
      walls: [wall([{ x: 1, y: 1 }], 3)],
      bomb: { cells: [{ x: 2, y: 2 }], age: 4 },
      enemy: { cells: [{ x: 17, y: 3 }, { x: 17, y: 2 }, { x: 17, y: 1 }], age: 5, status: 'dead' },
    };
    const next = step(h);
    expect(next.walls[0].age).toBe(4);
    expect(next.bomb.age).toBe(5);
    expect(next.enemy.age).toBe(6);
  });

  it('turns a ghost enemy live after 24 steps', () => {
    const enemy = { cells: [{ x: 17, y: 18 }, { x: 17, y: 17 }, { x: 17, y: 16 }], age: 23, status: 'ghost' };
    const next = step({ walls: [], bomb: null, enemy });
    expect(next.enemy.status).toBe('alive');
    expect(next.enemy.age).toBe(0);
  });

  it('keeps a ghost enemy a ghost while the snake is on it', () => {
    const onSnake = { cells: [{ x: 9, y: 10 }, { x: 9, y: 11 }, { x: 9, y: 12 }], age: 30, status: 'ghost' };
    expect(step({ walls: [], bomb: null, enemy: onSnake }).enemy.status).toBe('ghost');
  });

  it('moves a live enemy one cell on even ages only', () => {
    const enemy = { cells: [{ x: 17, y: 18 }, { x: 17, y: 17 }, { x: 17, y: 16 }], age: 0, status: 'alive' };
    const h1 = step({ walls: [], bomb: null, enemy });       // age 1: stays
    expect(h1.enemy.cells).toEqual(enemy.cells);
    const h2 = step(h1);                                       // age 2: moves
    expect(h2.enemy.cells).toHaveLength(3);
    expect(h2.enemy.cells).not.toEqual(enemy.cells);
    expect(manhattan(h2.enemy.cells[0], enemy.cells[0])).toBe(1);
    expect(h2.enemy.cells.slice(1)).toEqual(enemy.cells.slice(0, 2));
  });

  it('dies when trapped and stays on the board', () => {
    const enemy = { cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], age: 1, status: 'alive' };
    const trap = { walls: [wall([{ x: 0, y: 1 }], 30)], bomb: null, enemy };
    const next = step(trap);
    expect(next.enemy.status).toBe('dead');
    expect(next.enemy.cells).toEqual(enemy.cells);
  });

  it('never walks into walls, the bomb or the snake, and always leaves a route', () => {
    const barrier = wall(Array.from({ length: 19 }, (_, y) => ({ x: 15, y })), 30);
    let moves = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const rng = seeded(seed);
      let h = {
        walls: [barrier],
        bomb: { cells: [{ x: 18, y: 18 }], age: 30 },
        enemy: { cells: [{ x: 17, y: 12 }, { x: 17, y: 11 }, { x: 17, y: 10 }], age: 0, status: 'alive' },
      };
      for (let i = 0; i < 80; i++) {
        const before = h.enemy.cells[0];
        h = stepHazards(h, { snake, food: foodAt }, rng);
        if (h.enemy.status === 'dead') break;
        if (h.enemy.cells[0].x !== before.x || h.enemy.cells[0].y !== before.y) moves++;
        const blocked = new Set(blockedKeys(h));
        h.enemy.cells.forEach((c) => {
          expect(c.x).toBeGreaterThanOrEqual(0);
          expect(c.x).toBeLessThan(20);
          expect(c.y).toBeGreaterThanOrEqual(0);
          expect(c.y).toBeLessThan(20);
          expect(barrier.cells.some((b) => b.x === c.x && b.y === c.y)).toBe(false);
          expect(c.x === 18 && c.y === 18).toBe(false);
        });
        expect(hasRoute(snake, blocked, foodAt)).toBe(true);
      }
    }
    expect(moves).toBeGreaterThan(0);
  });
});
