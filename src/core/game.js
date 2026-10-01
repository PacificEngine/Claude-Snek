import { GRID_SIZE, START_LENGTH } from './config.js';

const VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const MAX_QUEUED = 2;

export function placeFood(snake, rng) {
  const occupied = new Set(snake.map((c) => `${c.x},${c.y}`));
  const free = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(rng() * free.length)];
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
    status: 'playing',
  };
}

export function queueDirection(state, dir) {
  const last = state.queued.at(-1) ?? state.direction;
  if (dir === last || dir === OPPOSITE[last]) return state;
  if (state.queued.length >= MAX_QUEUED) return state;
  return { ...state, queued: [...state.queued, dir] };
}

const isOutOfBounds = ({ x, y }) => x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE;
const sameCell = (a, b) => a.x === b.x && a.y === b.y;

export function togglePause(state) {
  if (state.status === 'playing') return { ...state, status: 'paused' };
  if (state.status === 'paused') return { ...state, status: 'playing' };
  return state;
}

export function tick(state, rng) {
  if (state.status !== 'playing') return state;
  const [next, ...queued] = state.queued;
  const direction = next ?? state.direction;
  const v = VECTORS[direction];
  const head = state.snake[0];
  const newHead = { x: head.x + v.x, y: head.y + v.y };
  const eating = state.food !== null && sameCell(newHead, state.food);
  const bodyAfterMove = eating ? state.snake : state.snake.slice(0, -1);
  if (isOutOfBounds(newHead) || bodyAfterMove.some((c) => sameCell(c, newHead))) {
    return { ...state, direction, queued, status: 'gameOver' };
  }
  const snake = [newHead, ...bodyAfterMove];
  if (!eating) return { ...state, snake, direction, queued };
  const food = placeFood(snake, rng);
  return {
    ...state,
    snake,
    direction,
    queued,
    food,
    score: state.score + 1,
    status: food === null ? 'gameOver' : 'playing',
  };
}
