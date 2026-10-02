import { START_LENGTH } from './config.js';
import { VECTORS, OPPOSITE, cellKey, sameCell, inBounds, allCells } from './grid.js';
import { reachable } from './pathing.js';
import { deadEndCells } from './shape.js';
import { PRESETS } from './difficulty.js';
import { emptyHazards, hitsHazard, stepHazards, startPlacement, placeWithin, blockedKeys } from './hazards.js';

const MAX_QUEUED = 2;

export function placeFood(snake, rng, blocked = new Set(), size = PRESETS.medium.gridSize, pending = 0) {
  const occupied = new Set([...snake.map(cellKey), ...blocked]);
  const free = allCells(size).filter((c) => !occupied.has(cellKey(c)));
  if (free.length === 0) return null;
  const reach = reachable(snake, blocked, size, pending);
  const onRoute = free.filter((c) => reach.has(cellKey(c)));
  // Never in a single-tile dead end (the snake's body moves, so only hazards make them); the old pools are the fallback.
  const dead = deadEndCells(blocked, size);
  const open = onRoute.filter((c) => !dead.has(cellKey(c)));
  const pool = open.length > 0 ? open : onRoute.length > 0 ? onRoute : free;
  return pool[Math.floor(rng() * pool.length)];
}

export function createState(rng, settings = PRESETS.medium) {
  const size = settings.gridSize;
  const mid = Math.floor(size / 2);
  const snake = Array.from({ length: START_LENGTH }, (_, i) => ({ x: mid - i, y: mid }));
  return {
    snake,
    direction: 'right',
    queued: [],
    food: placeFood(snake, rng, new Set(), size),
    score: 0,
    hazards: emptyHazards(),
    settings,
    growth: { carry: 0, pending: 0 },
    // Obstacle work for the last apple that has not been placed yet (see `tick`).
    placement: null,
    status: 'playing',
  };
}

export function queueDirection(state, dir) {
  const last = state.queued.at(-1) ?? state.direction;
  if (dir === last || dir === OPPOSITE[last]) return state;
  if (state.queued.length >= MAX_QUEUED) return state;
  return { ...state, queued: [...state.queued, dir] };
}

export function togglePause(state) {
  if (state.status === 'playing') return { ...state, status: 'paused' };
  if (state.status === 'paused') return { ...state, status: 'playing' };
  return state;
}

// Growth Count is tracked in whole tenths so fractional values never drift.
function growthAfterApple(growth, growthSetting) {
  const carry = growth.carry + Math.round(growthSetting * 10);
  const cells = Math.floor(carry / 10);
  return { carry: carry - cells * 10, cells };
}

// One game step. `opts.budgetMs` with an injected clock `opts.now` (ms) spreads an apple's obstacle placement over
// the following steps: after the step, waiting items are placed one at a time until the budget is used (at least one
// per step). Without a budget everything is placed in the apple step.
export function tick(state, rng, opts = {}) {
  if (state.status !== 'playing') return state;
  const settings = state.settings ?? PRESETS.medium;
  const size = settings.gridSize;
  const hazards = state.hazards ?? emptyHazards();
  const [next, ...queued] = state.queued;
  const direction = next ?? state.direction;
  const v = VECTORS[direction];
  const head = state.snake[0];
  const newHead = { x: head.x + v.x, y: head.y + v.y };
  const eating = state.food !== null && sameCell(newHead, state.food);
  let growth = state.growth ?? { carry: 0, pending: 0 };
  if (eating) {
    const gained = growthAfterApple(growth, settings.growth);
    const room = (settings.maxLength ?? Infinity) - state.snake.length;
    growth = room > 0
      ? { carry: gained.carry, pending: Math.min(growth.pending + gained.cells, room) }
      : { carry: 0, pending: 0 }; // at the max size growth stops completely
  }
  const grows = growth.pending > 0;
  const bodyAfterMove = grows ? state.snake : state.snake.slice(0, -1);
  if (grows) growth = { ...growth, pending: growth.pending - 1 };
  if (
    !inBounds(newHead, size) ||
    bodyAfterMove.some((c) => sameCell(c, newHead)) ||
    hitsHazard(hazards, newHead, state.snake)
  ) {
    return { ...state, direction, queued, hazards, status: 'gameOver' };
  }
  const snake = [newHead, ...bodyAfterMove];
  const stepped = stepHazards(hazards, { snake, food: state.food, size, pending: growth.pending }, rng);
  const place = (work, food) =>
    placeWithin(work, { snake, direction, food, size, pending: growth.pending }, stepped, rng, settings, opts);
  if (!eating) {
    const placed = place(state.placement ?? null, state.food);
    return { ...state, snake, direction, queued, hazards: placed.hazards, placement: placed.work, growth };
  }

  const score = state.score + 1;
  // Food first, on a reachable cell; then hazards, checked against that food. A new apple replaces waiting work.
  const food = placeFood(snake, rng, blockedKeys(stepped), size, growth.pending);
  const placed = place(startPlacement(score), food);
  return {
    ...state,
    snake,
    direction,
    queued,
    food,
    score,
    hazards: placed.hazards,
    placement: placed.work,
    growth,
    status: food === null ? 'gameOver' : 'playing',
  };
}
