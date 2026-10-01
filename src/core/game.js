import { GRID_SIZE, START_LENGTH } from './config.js';
import { VECTORS, OPPOSITE, cellKey, sameCell, inBounds, allCells } from './grid.js';
import { reachable } from './pathing.js';
import { emptyHazards, hitsHazard, stepHazards, spawnForApple, blockedKeys } from './hazards.js';

const MAX_QUEUED = 2;

export function placeFood(snake, rng, blocked = new Set()) {
  const occupied = new Set([...snake.map(cellKey), ...blocked]);
  const free = allCells().filter((c) => !occupied.has(cellKey(c)));
  if (free.length === 0) return null;
  const reach = reachable(snake, blocked);
  const onRoute = free.filter((c) => reach.has(cellKey(c)));
  const pool = onRoute.length > 0 ? onRoute : free;
  return pool[Math.floor(rng() * pool.length)];
}

export function createState(rng) {
  const mid = Math.floor(GRID_SIZE / 2);
  const snake = Array.from({ length: START_LENGTH }, (_, i) => ({ x: mid - i, y: mid }));
  return {
    snake,
    direction: 'right',
    queued: [],
    food: placeFood(snake, rng),
    score: 0,
    hazards: emptyHazards(),
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

export function tick(state, rng) {
  if (state.status !== 'playing') return state;
  const hazards = state.hazards ?? emptyHazards();
  const [next, ...queued] = state.queued;
  const direction = next ?? state.direction;
  const v = VECTORS[direction];
  const head = state.snake[0];
  const newHead = { x: head.x + v.x, y: head.y + v.y };
  const eating = state.food !== null && sameCell(newHead, state.food);
  const bodyAfterMove = eating ? state.snake : state.snake.slice(0, -1);
  if (
    !inBounds(newHead) ||
    bodyAfterMove.some((c) => sameCell(c, newHead)) ||
    hitsHazard(hazards, newHead, state.snake)
  ) {
    return { ...state, direction, queued, hazards, status: 'gameOver' };
  }
  const snake = [newHead, ...bodyAfterMove];
  let nextHazards = stepHazards(hazards, { snake, food: state.food }, rng);
  if (!eating) return { ...state, snake, direction, queued, hazards: nextHazards };

  const score = state.score + 1;
  // Food first, on a reachable cell; then hazards, checked against that food.
  const food = placeFood(snake, rng, blockedKeys(nextHazards));
  nextHazards = spawnForApple({ snake, direction, food }, nextHazards, rng, score);
  return {
    ...state,
    snake,
    direction,
    queued,
    food,
    score,
    hazards: nextHazards,
    status: food === null ? 'gameOver' : 'playing',
  };
}
