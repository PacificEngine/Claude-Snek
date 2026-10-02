import { describe, it, expect } from 'vitest';
import { createState, queueDirection, tick } from '../src/core/game.js';
import { blockedKeys } from '../src/core/hazards.js';
import { PRESETS } from '../src/core/difficulty.js';
import { cellKey } from '../src/core/grid.js';
import { reachable } from '../src/core/pathing.js';
import { hasIslands, deadEndCells } from '../src/core/shape.js';
import { readFileSync, readdirSync } from 'node:fs';
import { seeded, choose, early, botRun, LEGACY_BOT } from './placement-helpers.js';

// A fake clock: every call moves time on by `step` ms.
const clock = (step = 1) => { let t = 0; return () => (t += step); };
const PHASES = ['first', 'bombs', 'spawn', 'relay', 'respawn', 'topup'];

// Apple 1 starts every kind of placement on a roomy board: 4 first walls, 3 bombs, 2 spawned walls, a re-lay of all 6 walls, 1 enemy.
const ALL_AT_ONCE = {
  ...PRESETS.medium, gridSize: 30, ghostTime: 40, ghostHalves: [],
  wallTrigger: 1, wallCount: 4, wallSize: 3,
  bombTrigger: 1, bombCount: 3, bombRate: 1, bombMax: 12,
  wallSpawnTrigger: 1, wallSpawnRate: 1, wallSpawnCount: 2, wallSpawnSize: 2,
  movingWallTrigger: 1, enemyTrigger: 1, enemyRate: 1, enemyMax: 1, invisibleTrigger: 99,
};
const ITEMS_FOR_APPLE_1 = 4 + 3 + 2 + 6 + 1;
// The snake on the left, heading right, with the apple right in front of it.
const aboutToEat = (settings = ALL_AT_ONCE) => ({
  ...createState(seeded(1), settings),
  snake: [{ x: 3, y: 15 }, { x: 2, y: 15 }, { x: 1, y: 15 }],
  direction: 'right',
  food: { x: 4, y: 15 },
});
const counts = (h) => ({ walls: h.walls.length, bombs: h.bombs.length, enemies: h.enemies.length });
const cursor = (state) => (state.placement ? `${state.placement.phase}:${state.placement.i}` : 'done');

// Ticks a budgeted game straight ahead until the placements are done; returns every state.
function runBudgeted(start, rng, opts, maxTicks = 40) {
  const states = [tick(start, rng, opts)];
  while (states.at(-1).placement && states.length < maxTicks) states.push(tick(states.at(-1), rng, opts));
  return states;
}

describe('placement state', () => {
  it('starts (and restarts) with no placement work waiting', () => {
    expect(createState(seeded(1), ALL_AT_ONCE).placement).toBeNull();
  });
  it('finishes everything in the apple step when no budget is given', () => {
    const after = tick(aboutToEat(), seeded(2));
    expect(after.score).toBe(1);
    expect(after.placement).toBeNull();
    expect(counts(after.hazards)).toEqual({ walls: 6, bombs: 3, enemies: 1 });
  });
  it('treats an infinite budget like no budget', () => {
    const a = tick(aboutToEat(), seeded(2));
    const b = tick(aboutToEat(), seeded(2), { now: clock(), budgetMs: Infinity });
    expect(b).toEqual(a);
  });
  it('keeps a seeded bot game identical with an infinite budget', () => {
    ['easy', 'medium'].forEach((name) => {
      expect(botRun(early(PRESETS[name]), 5, 1500, () => ({ now: clock(), budgetMs: Infinity }))).toEqual(LEGACY_BOT[name]);
    });
  }, 60000);
});

describe('placement spread over beats', () => {
  it('places the new apple at once and leaves the obstacles waiting', () => {
    const after = tick(aboutToEat(), seeded(2), { now: clock(), budgetMs: 1 });
    expect(after.score).toBe(1);
    expect(after.food).not.toBeNull();
    expect(after.placement).toMatchObject({ apples: 1 });
    expect(counts(after.hazards)).toEqual({ walls: 1, bombs: 0, enemies: 0 });
  });
  it('places one obstacle per beat with a one-call budget, in order first walls, bombs, spawned walls, re-lay, enemies', () => {
    const states = runBudgeted(aboutToEat(), seeded(2), { now: clock(), budgetMs: 1 });
    expect(states).toHaveLength(ITEMS_FOR_APPLE_1);
    states.forEach((s) => expect(s.score).toBe(1));
    const phases = states.map((s) => s.placement?.phase ?? 'done');
    const order = phases.map((p) => (p === 'done' ? PHASES.length : PHASES.indexOf(p)));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect([...new Set(phases)]).toEqual(['first', 'bombs', 'spawn', 'relay', 'topup', 'done']);
    // every beat moved the work on
    expect(new Set(states.map(cursor)).size).toBe(states.length);
  });
  it('still places at least one obstacle per beat when the budget is already spent', () => {
    const states = runBudgeted(aboutToEat(), seeded(2), { now: clock(1000), budgetMs: 0 });
    expect(states).toHaveLength(ITEMS_FOR_APPLE_1);
  });
  it('places several obstacles per beat when the budget allows', () => {
    const states = runBudgeted(aboutToEat(), seeded(2), { now: clock(), budgetMs: 4 });
    expect(states).toHaveLength(Math.ceil(ITEMS_FOR_APPLE_1 / 4));
  });
  it('ends with the same counts as the unbudgeted apple step', () => {
    const whole = tick(aboutToEat(), seeded(2));
    const spread = runBudgeted(aboutToEat(), seeded(2), { now: clock(), budgetMs: 1 }).at(-1);
    expect(spread.placement).toBeNull();
    expect(counts(spread.hazards)).toEqual(counts(whole.hazards));
  });
  it('keeps every waiting obstacle where it is until it is moved, while everything keeps ageing', () => {
    const states = runBudgeted(aboutToEat(), seeded(2), { now: clock(), budgetMs: 1 });
    // the first state whose cursor is on the re-lay is the last one before any wall moves
    const start = states.findIndex((s) => s.placement?.phase === 'relay') + 1;
    const before = states[start - 1].hazards.walls;
    for (let t = start; t < states.length; t++) {
      const { walls } = states[t].hazards;
      expect(walls).toHaveLength(before.length);
      const relaid = states[t].placement?.phase === 'relay' ? states[t].placement.i : walls.length;
      for (let j = relaid; j < walls.length; j++) {
        expect(walls[j].cells).toEqual(before[j].cells);
        expect(walls[j].age).toBe(before[j].age + (t - start + 1));
      }
    }
    // no bomb ever disappears while it waits
    for (let t = 1; t < states.length; t++) expect(states[t].hazards.bombs.length).toBeGreaterThanOrEqual(states[t - 1].hazards.bombs.length);
  });
  it('replaces waiting work with the newest apple\'s work', () => {
    const states = runBudgeted(aboutToEat(), seeded(2), { now: clock(), budgetMs: 1 }, 3);
    const mid = states.at(-1);
    expect(mid.placement.apples).toBe(1);
    const head = mid.snake[0];
    const eatNext = { ...mid, food: { x: head.x + 1, y: head.y } };
    const after = tick(eatNext, seeded(9), { now: clock(), budgetMs: 1 });
    expect(after.score).toBe(2);
    expect(after.placement).toMatchObject({ apples: 2 });
    // apple 2 has no first walls, so its work starts at the bombs
    expect(after.placement.phase).toBe('bombs');
    expect(after.hazards.walls.length).toBe(mid.hazards.walls.length);
  });
  it('gives obstacles the ghost time of the apple that triggered them, not of a later one', () => {
    const settings = { ...ALL_AT_ONCE, ghostHalves: [0, 1] };
    const states = runBudgeted(aboutToEat(settings), seeded(2), { now: clock(), budgetMs: 1 }, 3);
    const mid = states.at(-1);
    mid.hazards.walls.forEach((w) => expect(w.telegraph).toBe(20));
    const head = mid.snake[0];
    const later = runBudgeted({ ...mid, food: { x: head.x + 1, y: head.y } }, seeded(9), { now: clock(), budgetMs: 1 });
    expect(later.at(-1).placement).toBeNull();
    const first = later.at(-1).hazards.bombs;
    first.forEach((b) => expect(b.telegraph).toBe(10));
    // the walls placed for apple 1 and moved for apple 2 now carry apple 2's ghost time
    later.at(-1).hazards.walls.forEach((w) => expect(w.telegraph).toBe(10));
  });
  it('is deterministic for a given random sequence and clock', () => {
    const run = () => botRun(early(PRESETS.hard), 7, 600, () => ({ now: clock(3), budgetMs: 5 }));
    expect(run()).toEqual(run());
  }, 30000);
});

describe('budgeted placement keeps the board rules', () => {
  const wallsAndBombs = (h) => new Set([...h.walls, ...h.bombs].flatMap((o) => o.cells.map(cellKey)));
  it.each(['medium', 'hard', 'frantic'])('never makes islands, never walls off the food, never leaves it in a dead end (%s, early triggers)', (name) => {
    const settings = early(PRESETS[name]);
    const size = settings.gridSize;
    let finished = 0;
    for (let seed = 1; seed <= 1; seed++) {
      const rng = seeded(seed);
      let state = createState(rng, settings);
      for (let step = 0; step < 1500 && state.status === 'playing'; step++) {
        const dir = choose(state);
        if (dir !== state.direction) state = queueDirection(state, dir);
        const waiting = state.placement !== null;
        state = tick(state, rng, { now: clock(), budgetMs: 2 });
        if (state.status !== 'playing') break;
        const h = state.hazards;
        expect(hasIslands(wallsAndBombs(h), size)).toBe(false);
        expect(reachable([state.snake[0]], blockedKeys(h), size).has(cellKey(state.food))).toBe(true);
        if (waiting && state.placement === null) {
          finished += 1;
          expect(deadEndCells(wallsAndBombs(h), size).has(cellKey(state.food))).toBe(false);
        }
      }
    }
    expect(finished).toBeGreaterThan(0);
  }, 60000);
});

describe('the core never reads a clock', () => {
  it('has no performance.now or Date in src/core (the clock is injected)', () => {
    const dir = new URL('../src/core/', import.meta.url);
    readdirSync(dir).filter((f) => f.endsWith('.js')).forEach((f) => {
      const src = readFileSync(new URL(f, dir), 'utf8');
      expect(src, f).not.toMatch(/performance\.now|Date\.now|new Date/);
    });
  });
});
