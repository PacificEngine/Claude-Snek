import { describe, it, expect } from 'vitest';
import { createState, placeFood, queueDirection, tick, togglePause } from '../src/core/game.js';
import { GRID_SIZE, START_LENGTH } from '../src/core/config.js';
import { emptyHazards } from '../src/core/hazards.js';

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
    const s = tick(stateWith({ snake, direction, food: last }), rng);
    expect(s.snake).toHaveLength(GRID_SIZE * GRID_SIZE);
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
    const s = withHazards({ walls: [solidWall(6, 5)], bomb: null, enemy: null });
    expect(tick(s, rng).status).toBe('gameOver');
  });

  it('ends the game on the solid bomb and on a live or dead enemy', () => {
    const bomb = withHazards({ walls: [], bomb: { cells: [{ x: 6, y: 5 }], age: 30 }, enemy: null });
    expect(tick(bomb, rng).status).toBe('gameOver');
    const enemy = (status) => withHazards({
      walls: [], bomb: null,
      enemy: { cells: [{ x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }], age: 0, status },
    });
    expect(tick(enemy('alive'), rng).status).toBe('gameOver');
    expect(tick(enemy('dead'), rng).status).toBe('gameOver');
  });

  it('lets the snake pass through ghosts', () => {
    const ghostWall = { cells: [{ x: 6, y: 5 }], age: 5, fades: false };
    const s = withHazards({ walls: [ghostWall], bomb: null, enemy: { cells: [{ x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }], age: 0, status: 'ghost' } });
    expect(tick(s, rng).status).toBe('playing');
  });

  it('ages hazards every step', () => {
    const s = withHazards({ walls: [{ cells: [{ x: 1, y: 1 }], age: 3, fades: false }], bomb: null, enemy: null });
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
    const hz = { walls: [solidWall(1, 1)], bomb: null, enemy: null };
    expect(tick(withHazards(hz), rng).hazards.walls).toHaveLength(1);
    expect(tick(withHazards({ ...hz, walls: [solidWall(6, 5)] }), rng).hazards.walls).toHaveLength(1);
  });
});
