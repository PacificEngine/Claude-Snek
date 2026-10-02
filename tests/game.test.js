import { describe, it, expect } from 'vitest';
import { createState, placeFood, queueDirection, tick, togglePause } from '../src/core/game.js';
import { GRID_SIZE, START_LENGTH } from '../src/core/config.js';
import { emptyHazards } from '../src/core/hazards.js';
import { PRESETS } from '../src/core/difficulty.js';
import { bpm } from '../src/core/pacing.js';

const rng = () => 0;

const stateWith = (overrides = {}) => ({
  snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }],
  direction: 'right',
  queued: [],
  food: { x: 15, y: 15 },
  score: 0,
  status: 'playing',
  ...overrides,
});

describe('createState', () => {
  it('starts centered, length 3, heading right, playing, score 0', () => {
    const s = createState(rng);
    expect(s.snake).toHaveLength(START_LENGTH);
    expect(s.snake[0]).toEqual({ x: GRID_SIZE / 2, y: GRID_SIZE / 2 });
    expect(s.direction).toBe('right');
    expect(s.status).toBe('playing');
    expect(s.score).toBe(0);
  });
  it('places food off the snake', () => {
    const s = createState(rng);
    expect(s.snake).not.toContainEqual(s.food);
  });
});

describe('tick movement', () => {
  it('moves the snake one cell in its direction, keeping length', () => {
    const s = tick(stateWith(), rng);
    expect(s.snake).toEqual([{ x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }]);
  });
  it('applies a queued turn', () => {
    const s = tick(stateWith({ queued: ['down'] }), rng);
    expect(s.snake[0]).toEqual({ x: 5, y: 6 });
    expect(s.direction).toBe('down');
    expect(s.queued).toEqual([]);
  });
});

describe('queueDirection', () => {
  it('ignores a 180 degree reversal', () => {
    const s = stateWith();
    expect(queueDirection(s, 'left')).toBe(s);
  });
  it('ignores a repeat of the current direction', () => {
    const s = stateWith();
    expect(queueDirection(s, 'right')).toBe(s);
  });
  it('checks reversal against the last queued direction, not the current one', () => {
    const s = queueDirection(stateWith(), 'down');
    expect(queueDirection(s, 'up')).toBe(s);
  });
  it('keeps two quick turns in order', () => {
    const s = queueDirection(queueDirection(stateWith(), 'down'), 'left');
    expect(s.queued).toEqual(['down', 'left']);
  });
  it('holds at most two queued directions', () => {
    const s = queueDirection(queueDirection(stateWith(), 'down'), 'left');
    expect(queueDirection(s, 'up')).toBe(s);
  });
});

describe('placeFood', () => {
  it('returns the only free cell', () => {
    const snake = [];
    for (let y = 0; y < GRID_SIZE; y++)
      for (let x = 0; x < GRID_SIZE; x++)
        if (!(x === 3 && y === 4)) snake.push({ x, y });
    expect(placeFood(snake, () => 0.9)).toEqual({ x: 3, y: 4 });
  });
  it('returns null when the grid is full', () => {
    const snake = [];
    for (let y = 0; y < GRID_SIZE; y++)
      for (let x = 0; x < GRID_SIZE; x++) snake.push({ x, y });
    expect(placeFood(snake, rng)).toBeNull();
  });
});

describe('tick collisions', () => {
  it('ends the game when the head hits the right wall', () => {
    const s = stateWith({
      snake: [{ x: GRID_SIZE - 1, y: 5 }, { x: GRID_SIZE - 2, y: 5 }, { x: GRID_SIZE - 3, y: 5 }],
    });
    expect(tick(s, rng).status).toBe('gameOver');
  });
  it('ends the game when the head hits the top wall', () => {
    const s = stateWith({
      snake: [{ x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 2 }],
      direction: 'up',
    });
    expect(tick(s, rng).status).toBe('gameOver');
  });
  it('ends the game when the head hits the left wall', () => {
    const s = stateWith({
      snake: [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }],
      direction: 'left',
    });
    expect(tick(s, rng).status).toBe('gameOver');
  });
  it('ends the game when the head hits the bottom wall', () => {
    const s = stateWith({
      snake: [{ x: 5, y: GRID_SIZE - 1 }, { x: 5, y: GRID_SIZE - 2 }, { x: 5, y: GRID_SIZE - 3 }],
      direction: 'down',
    });
    expect(tick(s, rng).status).toBe('gameOver');
  });
  it('ends the game when the head hits its own body', () => {
    const s = stateWith({
      snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 4 }],
      direction: 'up',
      queued: ['left'],
    });
    expect(tick(s, rng).status).toBe('gameOver');
  });
  it('allows the head to move into the cell the tail is leaving', () => {
    const s = stateWith({
      snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }],
      direction: 'up',
      queued: ['left'],
    });
    expect(tick(s, rng).status).toBe('playing');
  });
  it('does nothing once the game is over', () => {
    const s = stateWith({ status: 'gameOver' });
    expect(tick(s, rng)).toBe(s);
  });
});

describe('tick eating', () => {
  const eating = () =>
    stateWith({
      snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }],
      food: { x: 6, y: 5 },
    });

  it('grows the snake by one and scores a point', () => {
    const s = tick(eating(), rng);
    expect(s.snake).toHaveLength(4);
    expect(s.snake[0]).toEqual({ x: 6, y: 5 });
    expect(s.score).toBe(1);
    expect(s.status).toBe('playing');
  });
  it('respawns food on a free cell', () => {
    const s = tick(eating(), rng);
    expect(s.snake).not.toContainEqual(s.food);
    expect(s.food).toEqual({ x: 0, y: 0 });
  });
  it('does not grow or score when not eating', () => {
    const s = tick(stateWith(), rng);
    expect(s.snake).toHaveLength(3);
    expect(s.score).toBe(0);
  });
});

describe('filling the board', () => {
  // Serpentine path through every cell, ordered tail to head.
  const path = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row = Array.from({ length: GRID_SIZE }, (_, x) => ({ x, y }));
    path.push(...(y % 2 === 0 ? row : row.reverse()));
  }

  it('uses a connected path that visits every cell once', () => {
    expect(new Set(path.map((c) => `${c.x},${c.y}`)).size).toBe(GRID_SIZE * GRID_SIZE);
    path.slice(1).forEach((c, i) => {
      expect(Math.abs(c.x - path[i].x) + Math.abs(c.y - path[i].y)).toBe(1);
    });
  });

  it('wins by ending the game with no food when the last free cell is eaten', () => {
    const last = path.at(-1);
    const head = path.at(-2);
    const snake = path.slice(0, -1).reverse();
    const direction = last.x > head.x ? 'right' : last.x < head.x ? 'left' : 'down';
    const s = tick(stateWith({ snake, direction, food: last, settings: { ...PRESETS.medium, maxLength: 1000 } }), rng);
    expect(s.snake).toHaveLength(GRID_SIZE * GRID_SIZE); // a Medium snake would stop at its max of 200
    expect(s.status).toBe('gameOver');
    expect(s.food).toBeNull();
  });
});

describe('togglePause', () => {
  it('pauses a playing game and resumes a paused one', () => {
    const paused = togglePause(stateWith());
    expect(paused.status).toBe('paused');
    expect(togglePause(paused).status).toBe('playing');
  });
  it('leaves a finished game alone', () => {
    const s = stateWith({ status: 'gameOver' });
    expect(togglePause(s)).toBe(s);
  });
  it('does not advance while paused', () => {
    const s = stateWith({ status: 'paused' });
    expect(tick(s, rng)).toBe(s);
  });
});

describe('placeFood with blocked and unreachable cells', () => {
  const head = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
  const wallColumn = new Set(Array.from({ length: GRID_SIZE }, (_, y) => `10,${y}`));

  it('never picks a blocked cell', () => {
    expect(placeFood(head, () => 0, new Set(['0,0']))).toEqual({ x: 1, y: 0 });
  });

  it('only picks cells the head can reach', () => {
    const food = placeFood(head, () => 0.999, wallColumn);
    expect(food.x).toBeLessThan(10);
  });

  it('falls back to any free cell when nothing is reachable', () => {
    const boxedIn = new Set(['5,4', '5,6', '6,5']);
    expect(placeFood(head, () => 0, boxedIn)).toEqual({ x: 0, y: 0 });
  });
});

describe('hazards in the game loop', () => {
  const withHazards = (hazards, overrides = {}) => stateWith({ hazards, ...overrides });
  const solidWall = (x, y) => ({ cells: [{ x, y }], age: 30, fades: false });

  it('starts a new game with no hazards', () => {
    expect(createState(rng).hazards).toEqual(emptyHazards());
  });

  it('ends the game when the head hits a solid wall', () => {
    const s = withHazards({ walls: [solidWall(6, 5)], bombs: [], enemies: [] });
    expect(tick(s, rng).status).toBe('gameOver');
  });

  it('ends the game on the solid bomb and on a live or dead enemy', () => {
    const bomb = withHazards({ walls: [], bombs: [{ cells: [{ x: 6, y: 5 }], age: 30 }], enemies: [] });
    expect(tick(bomb, rng).status).toBe('gameOver');
    const enemy = (status) => withHazards({
      walls: [], bombs: [],
      enemies: [{ cells: [{ x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }], age: 0, status }],
    });
    expect(tick(enemy('alive'), rng).status).toBe('gameOver');
    expect(tick(enemy('dead'), rng).status).toBe('gameOver');
  });

  it('lets the snake pass through ghosts', () => {
    const ghostWall = { cells: [{ x: 6, y: 5 }], age: 5, fades: false };
    const s = withHazards({ walls: [ghostWall], bombs: [], enemies: [{ cells: [{ x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }], age: 0, status: 'ghost' }] });
    expect(tick(s, rng).status).toBe('playing');
  });

  it('ages hazards every step', () => {
    const s = withHazards({ walls: [{ cells: [{ x: 1, y: 1 }], age: 3, fades: false }], bombs: [], enemies: [] });
    expect(tick(s, rng).hazards.walls[0].age).toBe(4);
  });

  it('treats a missing hazards field as empty', () => {
    const s = stateWith();
    expect(tick(s, rng).hazards).toEqual(emptyHazards());
  });

  it('spawns the tier-2 walls on the 16th apple, after placing new food', () => {
    const s = stateWith({
      score: 15,
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
      food: { x: 11, y: 10 },
      hazards: emptyHazards(),
    });
    const next = tick(s, () => 0.2);
    expect(next.score).toBe(16);
    expect(next.hazards.walls.length).toBeGreaterThan(0);
    const wallKeys = new Set(next.hazards.walls.flatMap((w) => w.cells.map((c) => `${c.x},${c.y}`)));
    expect(wallKeys.has(`${next.food.x},${next.food.y}`)).toBe(false);
  });

  it('keeps hazards across a non-eating step and across game over', () => {
    const hz = { walls: [solidWall(1, 1)], bombs: [], enemies: [] };
    expect(tick(withHazards(hz), rng).hazards.walls).toHaveLength(1);
    expect(tick(withHazards({ ...hz, walls: [solidWall(6, 5)] }), rng).hazards.walls).toHaveLength(1);
  });
});

describe('grid size from the settings', () => {
  const sized = (gridSize) => ({ ...PRESETS.medium, gridSize });
  it.each([[10, 5], [16, 8], [20, 10], [40, 20], [50, 25]])('starts centred on a %i board at %i', (size, mid) => {
    const s = createState(rng, sized(size));
    expect(s.snake[0]).toEqual({ x: mid, y: mid });
    expect(s.snake).toHaveLength(START_LENGTH);
    expect(s.settings.gridSize).toBe(size);
    expect(s.growth).toEqual({ carry: 0, pending: 0 });
  });
  it('defaults to the medium preset', () => {
    expect(createState(rng).settings).toBe(PRESETS.medium);
  });
  it('ends the game at the edge of a small board', () => {
    const s = stateWith({ snake: [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }], settings: sized(10) });
    expect(tick(s, rng).status).toBe('gameOver');
  });
  it('lets the same move continue on the default board', () => {
    const s = stateWith({ snake: [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }] });
    expect(tick(s, rng).status).toBe('playing');
  });
  it('places food inside a small board', () => {
    for (let i = 0; i < 50; i++) {
      const f = placeFood([{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], () => (i + 0.5) / 50, new Set(), 10);
      expect(f.x).toBeLessThan(10);
      expect(f.y).toBeLessThan(10);
    }
  });
});

describe('growth count', () => {
  const settingsWith = (growth) => ({ ...PRESETS.medium, gridSize: 30, growth });
  const start = (growth) => stateWith({
    snake: [{ x: 3, y: 15 }, { x: 2, y: 15 }, { x: 1, y: 15 }], food: null, settings: settingsWith(growth),
  });
  // put the food right in front of the head and step once
  const eat = (s) => {
    const head = s.snake[0];
    return tick({ ...s, food: { x: head.x + 1, y: head.y } }, rng);
  };
  const steps = (s, n) => { for (let i = 0; i < n; i++) s = tick(s, rng); return s; };

  it('grows one cell per apple at 1 (the old behavior)', () => {
    let s = eat(start(1));
    expect(s.snake).toHaveLength(4);
    expect(s.score).toBe(1);
    s = eat(s);
    expect(s.snake).toHaveLength(5);
  });

  it('never grows at 0, but still scores', () => {
    let s = start(0);
    for (let i = 0; i < 5; i++) s = eat(s);
    expect(s.snake).toHaveLength(3);
    expect(s.score).toBe(5);
  });

  it('needs 2 apples per cell at 0.5', () => {
    let s = eat(start(0.5));
    expect(s.snake).toHaveLength(3);
    s = eat(s);
    expect(s.snake).toHaveLength(4);
    s = eat(eat(s));
    expect(s.snake).toHaveLength(5);
  });

  it('needs 10 apples per cell at 0.1', () => {
    let s = start(0.1);
    for (let i = 0; i < 9; i++) s = eat(s);
    expect(s.snake).toHaveLength(3);
    s = eat(s);
    expect(s.snake).toHaveLength(4);
    expect(s.score).toBe(10);
  });

  it('adds up fractional growth exactly: 0.3 for 10 apples is 3 cells', () => {
    let s = start(0.3);
    for (let i = 0; i < 10; i++) s = eat(s);
    s = steps({ ...s, food: null }, 5);
    expect(s.snake).toHaveLength(6);
  });

  it('adds the new cells one per step at 4', () => {
    let s = eat(start(4));
    expect(s.snake).toHaveLength(4); // grows on the eating step
    s = steps({ ...s, food: null }, 1);
    expect(s.snake).toHaveLength(5);
    s = steps(s, 2);
    expect(s.snake).toHaveLength(7); // 3 + 4
    s = steps(s, 3);
    expect(s.snake).toHaveLength(7); // done
  });

  it('ends 0.3 x 10 apples with no carry left', () => {
    let s = start(0.3);
    for (let i = 0; i < 10; i++) s = eat(s);
    expect(steps({ ...s, food: null }, 5).growth).toEqual({ carry: 0, pending: 0 });
  });

  it('adds to the pending cells when eating again while still growing', () => {
    let s = eat(start(4));
    s = eat(s);
    expect(s.growth.pending).toBe(6);
    expect(s.snake).toHaveLength(5);
  });

  describe('max snake size', () => {
    const capped = (growth, maxLength) => ({ ...start(growth), settings: { ...settingsWith(growth), maxLength } });

    it('never grows past the max when it starts at it, and drops pending and carry', () => {
      let s = capped(4, 3);
      for (let i = 0; i < 4; i++) s = eat(s);
      s = steps({ ...s, food: null }, 5);
      expect(s.snake).toHaveLength(3);
      expect(s.growth).toEqual({ carry: 0, pending: 0 });
    });

    it('drops the carry of fractional growth at the max', () => {
      const s = eat(capped(0.5, 3));
      expect(s.snake).toHaveLength(3);
      expect(s.growth).toEqual({ carry: 0, pending: 0 });
    });

    it('ends exactly at the max when growth would overshoot it', () => {
      let s = eat(capped(4, 6));
      s = steps({ ...s, food: null }, 10);
      expect(s.snake).toHaveLength(6);
      expect(s.growth.pending).toBe(0);
    });

    it('clamps the pending cells when eating again mid-growth', () => {
      let s = eat(capped(4, 6)); // length 4, 2 pending
      expect(s.growth.pending).toBe(2);
      s = eat(s); // 4 more would make 10; room for 6 - 5 = 1
      expect(s.snake).toHaveLength(5);
      expect(s.growth.pending).toBe(1);
    });

    it('still scores one per apple at the max', () => {
      let s = capped(1, 3);
      for (let i = 0; i < 4; i++) s = eat(s);
      expect(s.score).toBe(4);
      expect(s.snake).toHaveLength(3);
      expect(s.food).not.toBeNull();
    });

    it('leaves the tempo alone', () => {
      const s = eat(capped(1, 3));
      expect(bpm(s.score, s.settings)).toBe(bpm(s.score, PRESETS.medium));
      expect(bpm(s.score, s.settings)).toBe(121);
    });

    it('treats a missing max as unlimited', () => {
      const { maxLength, ...rest } = settingsWith(4);
      let s = eat({ ...start(4), settings: rest });
      s = steps({ ...s, food: null }, 5);
      expect(s.snake).toHaveLength(7);
    });
  });

  it('dies on the tail cell while still growing, but may follow it when not', () => {
    const s = stateWith({
      snake: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }],
      direction: 'down', food: null, settings: PRESETS.medium, hazards: emptyHazards(),
    });
    expect(tick({ ...s, growth: { carry: 0, pending: 1 } }, rng).status).toBe('gameOver');
    expect(tick({ ...s, growth: { carry: 0, pending: 0 } }, rng).status).toBe('playing');
  });

  it('keeps old states without settings or growth behaving like medium', () => {
    const s = tick(stateWith({ food: { x: 6, y: 5 } }), rng);
    expect(s.snake).toHaveLength(4);
    expect(s.growth).toEqual({ carry: 0, pending: 0 });
  });
});

describe('settings reach the spawn rules', () => {
  it('spawns the first walls from the wall trigger of the settings', () => {
    const settings = { ...PRESETS.medium, wallTrigger: 3, wallCount: 2, wallSize: 2 };
    const s = stateWith({
      score: 2, settings,
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }], food: { x: 11, y: 10 }, hazards: emptyHazards(),
    });
    const next = tick(s, () => 0.2);
    expect(next.score).toBe(3);
    expect(next.hazards.walls.length).toBeGreaterThan(0);
  });

  it('places food knowing the tail stays put while growth is pending', () => {
    // 3x3 board, snake grows this step so after the move it is (1,1),(1,2),(0,2),(0,1) and
    // walls fence off the top row. With no growth left over the tail clears in time, so only
    // (2,2) is on a route and gets the food. With growth still pending nothing is on a route,
    // so the fallback pool is every free cell and its first, (2,0), is chosen.
    const solid = (x, y) => ({ cells: [{ x, y }], age: 30, fades: false });
    const base = stateWith({
      snake: [{ x: 1, y: 2 }, { x: 0, y: 2 }, { x: 0, y: 1 }], direction: 'up', food: { x: 1, y: 1 },
      settings: { ...PRESETS.medium, gridSize: 3, growth: 0 },
      hazards: { walls: [solid(2, 1), solid(1, 0), solid(0, 0)], bombs: [], enemies: [] },
    });
    const done = tick({ ...base, growth: { carry: 0, pending: 1 } }, rng);
    expect(done.growth.pending).toBe(0);
    expect(done.food).toEqual({ x: 2, y: 2 });
    const growing = tick({ ...base, growth: { carry: 0, pending: 2 } }, rng);
    expect(growing.growth.pending).toBe(1);
    expect(growing.food).toEqual({ x: 2, y: 0 });
  });
});

describe('placeFood avoids dead ends', () => {
  const head = [{ x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }];
  const seeded = (seed) => {
    let a = seed;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // Size 8: the open room is x 0..3 / y 0..3 with a 1-wide corridor along y=1 from x=4 to x=7 (a dead end).
  const room = (size) => {
    const blocked = new Set();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const inRoom = x <= 3 && y <= 3;
      const inCorridor = y === 1 && x >= 4;
      if (!inRoom && !inCorridor) blocked.add(`${x},${y}`);
    }
    return blocked;
  };

  it('never lands in the dead-end corridor while the room has space (many seeds)', () => {
    const blocked = room(8);
    for (let seed = 1; seed <= 200; seed++) {
      const f = placeFood(head, seeded(seed), blocked, 8);
      expect(f.x).toBeLessThanOrEqual(3);
      expect(f.y).toBeLessThanOrEqual(3);
    }
  });
  it('lands on the one open cell when every other free cell is a dead end', () => {
    // free: one open 2x2 block's worth is too many; use a 2x2 room plus a corridor, snake fills three of the room cells
    const blocked = new Set();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const inRoom = x <= 1 && y <= 1;
      const inCorridor = y === 0 && x >= 2 && x <= 6;
      if (!inRoom && !inCorridor) blocked.add(`${x},${y}`);
    }
    const snake = [{ x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }];
    for (let seed = 1; seed <= 50; seed++) expect(placeFood(snake, seeded(seed), blocked, 8)).toEqual({ x: 0, y: 0 });
  });
  it('falls back to a dead end when every free cell is one', () => {
    const blocked = new Set();
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if (!(y === 0 && x >= 2 && x <= 4) && !(x <= 1 && y === 0)) blocked.add(`${x},${y}`);
    // a single straight corridor along y=0, x 0..4: every cell peels
    const snake = [{ x: 0, y: 0 }];
    const f = placeFood(snake, () => 0, blocked, 6);
    expect(f).toEqual({ x: 1, y: 0 });
  });
  it('ignores the snake body when looking for dead ends', () => {
    // open 10x10; the snake's body sits in a column, food next to it is allowed
    const body = Array.from({ length: 8 }, (_, i) => ({ x: 5, y: 8 - i }));
    const seen = new Set();
    for (let seed = 1; seed <= 300; seed++) {
      const f = placeFood(body, seeded(seed), new Set(), 10);
      seen.add(`${f.x},${f.y}`);
    }
    expect(seen.has('4,5')).toBe(true);
    expect(seen.has('6,3')).toBe(true);
  });
  it('is deterministic for a seed', () => {
    const blocked = room(8);
    expect(placeFood(head, seeded(7), blocked, 8)).toEqual(placeFood(head, seeded(7), blocked, 8));
  });
});
