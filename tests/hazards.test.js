import { describe, it, expect } from 'vitest';
import {
  emptyHazards, hazardCells, blockedKeys, isSolid, hitsHazard,
  isGhostVisible, wallOpacity, placeSegment, placeCell, spawnForApple, stepHazards,
  telegraphFor, bombCountFor, MAX_BOMBS, SAFE_DISTANCE, LANE_LENGTH, WALL_CELL_CAP,
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
// plays the given values once, then 0.5 forever (the snake's head, so placement fails)
const script = (...v) => { let i = 0; return () => (i < v.length ? v[i++] : 0.5); };

const snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
const wall = (cells, age = 0, fades = false) => ({ cells, age, fades });
const world = (overrides = {}) => ({
  snake, direction: 'right', food: { x: 3, y: 3 }, hazards: emptyHazards(), ...overrides,
});

describe('hazard bookkeeping', () => {
  it('starts empty', () => {
    expect(emptyHazards()).toEqual({ walls: [], bombs: [], enemy: null });
  });
  it('lists every hazard cell as blocked', () => {
    const h = {
      walls: [wall([{ x: 1, y: 1 }, { x: 2, y: 1 }])],
      bombs: [{ cells: [{ x: 5, y: 5 }], age: 0 }],
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
    bombs: [{ cells: [{ x: 14, y: 10 }], age: 30 }],
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
      bombs: [{ cells: [{ x: 14, y: 10 }], age: 5 }],
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
    const existing = { walls: [wall([{ x: 15, y: 15 }, { x: 16, y: 15 }, { x: 17, y: 15 }])], bombs: [], enemy: null };
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
    const hazards = { walls: [barrier], bombs: [], enemy: null };
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
    const hazards = { walls: [barrier], bombs: [], enemy: null };
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
    expect(h.bombs).toEqual([]);
  });

  it('adds no more walls on later apples until tier 6', () => {
    const start = spawnForApple(w(), emptyHazards(), seeded(1), 16);
    expect(spawnForApple(w(), start, seeded(2), 17).walls).toEqual(start.walls);
  });

  it('places the bomb at tier 4 and moves it on every later apple', () => {
    const first = spawnForApple(w(), emptyHazards(), seeded(1), 32);
    expect(first.bombs[0].cells).toHaveLength(1);
    expect(first.bombs[0].age).toBe(0);
    const aged = { ...first, bombs: [{ ...first.bombs[0], age: 30 }] };
    const moved = spawnForApple(w(), aged, seeded(5), 33);
    expect(moved.bombs[0].age).toBe(0);
    expect(moved.bombs[0].cells[0]).not.toEqual(first.bombs[0].cells[0]);
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
      bombs: [],
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
    const kept = spawnForApple(w(), { walls, bombs: [], enemy: null }, cycle(0.5, 0.5), 100);
    expect(kept.walls).toEqual(walls);
  });

  it('keeps the old bomb, cells and age, when no new spot can be found', () => {
    const bomb = { cells: [{ x: 15, y: 15 }], age: 30 };
    const kept = spawnForApple(w(), { walls: [], bombs: [bomb], enemy: null }, cycle(0.5, 0.5), 33);
    expect(kept.bombs).toEqual([bomb]);
  });

  it('keeps a dead enemy as an obstacle when no respawn spot can be found', () => {
    const enemy = { cells: [{ x: 15, y: 15 }, { x: 16, y: 15 }, { x: 17, y: 15 }], age: 9, status: 'dead' };
    const kept = spawnForApple(w(), { walls: [], bombs: [], enemy }, cycle(0.5, 0.5), 65);
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

  it('ages walls, every bomb and the enemy by one step', () => {
    const h = {
      walls: [wall([{ x: 1, y: 1 }], 3)],
      bombs: [{ cells: [{ x: 2, y: 2 }], age: 4 }],
      enemy: { cells: [{ x: 17, y: 3 }, { x: 17, y: 2 }, { x: 17, y: 1 }], age: 5, status: 'dead' },
    };
    const next = step(h);
    expect(next.walls[0].age).toBe(4);
    expect(next.bombs[0].age).toBe(5);
    expect(next.enemy.age).toBe(6);
  });

  it('turns a ghost enemy live after 24 steps', () => {
    const enemy = { cells: [{ x: 17, y: 18 }, { x: 17, y: 17 }, { x: 17, y: 16 }], age: 23, status: 'ghost' };
    const next = step({ walls: [], bombs: [], enemy });
    expect(next.enemy.status).toBe('alive');
    expect(next.enemy.age).toBe(0);
  });

  it('keeps a ghost enemy a ghost while the snake is on it', () => {
    const onSnake = { cells: [{ x: 9, y: 10 }, { x: 9, y: 11 }, { x: 9, y: 12 }], age: 30, status: 'ghost' };
    expect(step({ walls: [], bombs: [], enemy: onSnake }).enemy.status).toBe('ghost');
  });

  it('moves a live enemy one cell on even ages only', () => {
    const enemy = { cells: [{ x: 17, y: 18 }, { x: 17, y: 17 }, { x: 17, y: 16 }], age: 0, status: 'alive' };
    const h1 = step({ walls: [], bombs: [], enemy });       // age 1: stays
    expect(h1.enemy.cells).toEqual(enemy.cells);
    const h2 = step(h1);                                       // age 2: moves
    expect(h2.enemy.cells).toHaveLength(3);
    expect(h2.enemy.cells).not.toEqual(enemy.cells);
    expect(manhattan(h2.enemy.cells[0], enemy.cells[0])).toBe(1);
    expect(h2.enemy.cells.slice(1)).toEqual(enemy.cells.slice(0, 2));
  });

  it('dies when trapped and stays on the board', () => {
    const enemy = { cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], age: 1, status: 'alive' };
    const trap = { walls: [wall([{ x: 0, y: 1 }], 30)], bombs: [], enemy };
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
        bombs: [{ cells: [{ x: 18, y: 18 }], age: 30 }],
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

describe('ghost time by apple count', () => {
  it('is 24 steps up to and including apple 60', () => {
    expect(telegraphFor(0)).toBe(24);
    expect(telegraphFor(16)).toBe(24);
    expect(telegraphFor(60)).toBe(24);
  });
  it('is 12 steps from apple 61 to apple 120', () => {
    expect(telegraphFor(61)).toBe(12);
    expect(telegraphFor(120)).toBe(12);
  });
  it('is 6 steps from apple 121 on', () => {
    expect(telegraphFor(121)).toBe(6);
    expect(telegraphFor(500)).toBe(6);
  });
});

describe('each obstacle keeps its own ghost time', () => {
  const cell = [{ x: 1, y: 1 }];
  it('turns solid at its own ghost time, defaulting to 24', () => {
    expect(isSolid({ cells: cell, age: 11, telegraph: 12 }, snake)).toBe(false);
    expect(isSolid({ cells: cell, age: 12, telegraph: 12 }, snake)).toBe(true);
    expect(isSolid({ cells: cell, age: 6, telegraph: 6 }, snake)).toBe(true);
    expect(isSolid({ cells: cell, age: 23 }, snake)).toBe(false);
    expect(isSolid({ cells: cell, age: 24 }, snake)).toBe(true);
  });

  it('stays visible for the last 4 steps of any ghost time, so a 6-step ghost never flashes off', () => {
    const visible = (telegraph) => Array.from({ length: telegraph }, (_, age) => isGhostVisible(age, false, telegraph));
    expect(visible(12)).toEqual([true, true, true, true, false, false, false, false, true, true, true, true]);
    expect(visible(6).every(Boolean)).toBe(true);
    expect(visible(24).slice(20).every(Boolean)).toBe(true);
  });

  it('starts fading when a wall turns solid, using its own ghost time', () => {
    const cells = [{ x: 1, y: 1 }];
    expect(wallOpacity({ cells, age: 12, telegraph: 12, fades: true })).toBe(1);
    expect(wallOpacity({ cells, age: 32, telegraph: 12, fades: true })).toBeCloseTo(0.5);
    expect(wallOpacity({ cells, age: 52, telegraph: 12, fades: true })).toBe(0);
  });

  it('turns a ghost enemy live at its own ghost time', () => {
    const enemy = { cells: [{ x: 17, y: 18 }, { x: 17, y: 17 }, { x: 17, y: 16 }], age: 11, telegraph: 12, status: 'ghost' };
    const next = stepHazards({ walls: [], bombs: [], enemy }, { snake, food: { x: 18, y: 5 } }, seeded(1));
    expect(next.enemy.status).toBe('alive');
  });
});

describe('spawnForApple stamps the ghost time', () => {
  const world = () => ({ snake, direction: 'right', food: { x: 3, y: 3 } });
  it('stamps 24 on the tier-2 walls', () => {
    const h = spawnForApple(world(), emptyHazards(), seeded(1), 16);
    expect(h.walls.length).toBeGreaterThan(0);
    expect(h.walls.every((x) => x.telegraph === 24)).toBe(true);
  });
  it('stamps 12 after apple 60 and 6 after apple 120 on a new bomb and a new wall', () => {
    const at61 = spawnForApple(world(), emptyHazards(), seeded(2), 61);
    expect(at61.bombs[0].telegraph).toBe(12);
    expect(at61.walls).toHaveLength(1);
    expect(at61.walls.every((x) => x.telegraph === 12)).toBe(true);
    const at121 = spawnForApple(world(), emptyHazards(), seeded(3), 121);
    expect(at121.bombs[0].telegraph).toBe(6);
    expect(at121.walls).toHaveLength(1);
    expect(at121.walls.every((x) => x.telegraph === 6)).toBe(true);
  });
  it('stamps the ghost time on a respawned enemy', () => {
    const dead = { walls: [], bombs: [], enemy: { cells: [{ x: 17, y: 12 }, { x: 17, y: 11 }, { x: 17, y: 10 }], age: 9, telegraph: 24, status: 'dead' } };
    const h = spawnForApple(world(), dead, seeded(4), 125);
    expect(h.enemy.status).toBe('ghost');
    expect(h.enemy.telegraph).toBe(6);
  });
  it('re-stamps a re-laid old wall with the current ghost time', () => {
    const old = { cells: [{ x: 15, y: 15 }, { x: 16, y: 15 }], age: 40, telegraph: 24, fades: false };
    [[81, 12], [125, 6]].forEach(([apples, t]) => {
      const h = spawnForApple(world(), { walls: [old], bombs: [], enemy: null }, seeded(4), apples);
      expect(h.walls).toHaveLength(2);
      expect(h.walls.every((x) => x.age === 0 && x.telegraph === t)).toBe(true);
    });
  });
  it('lets a wall that could not be re-laid keep its old ghost time', () => {
    const old = { cells: [{ x: 15, y: 15 }, { x: 16, y: 15 }], age: 40, telegraph: 24, fades: false };
    const kept = spawnForApple(world(), { walls: [old], bombs: [], enemy: null }, cycle(0.5, 0.5), 125);
    expect(kept.walls).toContainEqual(old);
  });
});

describe('bombCountFor', () => {
  it('is 0 before apple 32', () => {
    expect(bombCountFor(0)).toBe(0);
    expect(bombCountFor(31)).toBe(0);
  });
  it('is 1 at apple 32 and adds one every 4th apple', () => {
    expect(bombCountFor(32)).toBe(1);
    expect(bombCountFor(35)).toBe(1);
    expect(bombCountFor(36)).toBe(2);
    expect(bombCountFor(40)).toBe(3);
    expect(bombCountFor(60)).toBe(8);
  });
  it('caps at 12, reached at apple 76', () => {
    expect(MAX_BOMBS).toBe(12);
    expect(bombCountFor(72)).toBe(11);
    expect(bombCountFor(76)).toBe(12);
    expect(bombCountFor(500)).toBe(12);
  });
});

describe('bomb swarm', () => {
  const world = () => ({ snake, direction: 'right', food: { x: 3, y: 3 } });
  // n bombs parked in the top-right, away from the snake, food and its lane
  const parked = (n, age = 30) => Array.from({ length: n }, (_, i) => ({
    cells: [{ x: 12 + (i % 8), y: 2 + Math.floor(i / 8) * 2 }], age, telegraph: 24,
  }));
  const withBombs = (bombs) => ({ walls: [], bombs, enemy: null });

  it('places the first bomb on apple 32 and none before', () => {
    expect(spawnForApple(world(), emptyHazards(), seeded(1), 31).bombs).toEqual([]);
    const first = spawnForApple(world(), emptyHazards(), seeded(1), 32).bombs;
    expect(first).toHaveLength(1);
    expect(first[0].age).toBe(0);
  });

  it('adds one more bomb on every 4th apple and not in between', () => {
    expect(spawnForApple(world(), withBombs(parked(1)), seeded(2), 33).bombs).toHaveLength(1);
    expect(spawnForApple(world(), withBombs(parked(1)), seeded(2), 35).bombs).toHaveLength(1);
    expect(spawnForApple(world(), withBombs(parked(1)), seeded(2), 36).bombs).toHaveLength(2);
    expect(spawnForApple(world(), withBombs(parked(2)), seeded(2), 40).bombs).toHaveLength(3);
  });

  it('moves every bomb on every apple (fresh ghosts, new cells)', () => {
    const before = parked(3);
    const after = spawnForApple(world(), withBombs(before), seeded(3), 40).bombs;
    expect(after).toHaveLength(3);
    expect(after.every((b) => b.age === 0)).toBe(true);
    const oldKeys = new Set(before.map((b) => cellKey(b.cells[0])));
    expect(after.every((b) => !oldKeys.has(cellKey(b.cells[0])))).toBe(true);
  });

  it('keeps a bomb that cannot be moved, and skips a new one that cannot be placed', () => {
    const before = parked(1);
    // an rng that always lands on the snake's head makes every placement fail
    let i = 0;
    const alwaysFails = () => [0.5, 0.5][i++ % 2];
    const after = spawnForApple(world(), withBombs(before), alwaysFails, 36).bombs;
    expect(after).toEqual(before); // old bomb kept (cells, age), the new second bomb skipped
  });

  it('keeps every bomb that cannot be moved', () => {
    const before = parked(3);
    let i = 0;
    const after = spawnForApple(world(), withBombs(before), () => [0.5, 0.5][i++ % 2], 40).bombs;
    expect(after).toEqual(before);
  });

  it('retries a skipped bomb on the next apple', () => {
    const skipped = spawnForApple(world(), withBombs(parked(1)), cycle(0.5, 0.5), 36);
    expect(skipped.bombs).toHaveLength(1);
    const after = spawnForApple(world(), skipped, seeded(5), 37).bombs;
    expect(after).toHaveLength(2); // target at 37 is 2
  });

  it('never puts a new bomb on an old bomb that has not moved yet', () => {
    const old = [
      { cells: [{ x: 12, y: 2 }], age: 30, telegraph: 24 },
      { cells: [{ x: 13, y: 2 }], age: 30, telegraph: 24 },
    ];
    // bomb 0 first tries (13,2) = bomb 1's cell, then (16,16); bomb 1 can never move
    const after = spawnForApple(world(), withBombs(old), script(0.675, 0.125, 0.825, 0.825), 37).bombs;
    expect(after).toEqual([{ cells: [{ x: 16, y: 16 }], age: 0, telegraph: 24 }, old[1]]);
  });

  it('keeps a route to the food across several bomb moves', () => {
    const barrier = wall(Array.from({ length: 18 }, (_, y) => ({ x: 15, y })), 30);
    const food = { x: 18, y: 5 };
    const old = [
      { cells: [{ x: 3, y: 15 }], age: 30, telegraph: 24 },
      { cells: [{ x: 15, y: 18 }], age: 30, telegraph: 24 },
    ];
    const h = spawnForApple({ snake, direction: 'right', food }, { walls: [barrier], bombs: old, enemy: null },
      script(0.775, 0.975, 0.275, 0.775), 37);
    expect(h.bombs[0].cells).toEqual([{ x: 5, y: 15 }]);
    expect(hasRoute(snake, blockedKeys(h), food)).toBe(true);
  });

  it('never has more than 12 bombs', () => {
    const after = spawnForApple(world(), withBombs(parked(12)), seeded(6), 80).bombs;
    expect(after).toHaveLength(MAX_BOMBS);
  });

  it('stamps new bombs with the current ghost time', () => {
    [[40, 3, 24], [80, 12, 12], [130, 12, 6]].forEach(([apples, count, t]) => {
      const bombs = spawnForApple(world(), emptyHazards(), seeded(7), apples).bombs;
      expect(bombs).toHaveLength(count);
      expect(bombs.every((b) => b.telegraph === t)).toBe(true);
    });
  });

  it('kills the snake on any solid bomb and ignores ghost bombs', () => {
    const h = withBombs([
      { cells: [{ x: 12, y: 10 }], age: 30, telegraph: 24 },
      { cells: [{ x: 14, y: 10 }], age: 3, telegraph: 24 },
    ]);
    expect(hitsHazard(h, { x: 12, y: 10 }, snake)).toBe(true);
    expect(hitsHazard(h, { x: 14, y: 10 }, snake)).toBe(false);
  });

  it('ages every bomb each step', () => {
    const next = stepHazards(withBombs(parked(3, 4)), { snake, food: { x: 18, y: 5 } }, seeded(1));
    expect(next.bombs.map((b) => b.age)).toEqual([5, 5, 5]);
  });
});
