import { GRID_SIZE, START_LENGTH } from './config.js';
import { VECTORS, cellKey, sameCell, inBounds, manhattan, neighbors } from './grid.js';
import { hasRoute } from './pathing.js';
import { musicTier } from './pacing.js';

export const TELEGRAPH_STEPS = 24;
// Ghost time for an obstacle placed on this apple: it shrinks as the game goes on.
export const telegraphFor = (apples) => (apples > 120 ? 6 : apples > 60 ? 12 : TELEGRAPH_STEPS);
// Each obstacle keeps the ghost time it was created with (24 for older objects).
const ghostTime = (obj) => obj.telegraph ?? TELEGRAPH_STEPS;
export const SAFE_DISTANCE = 5;
export const LANE_LENGTH = 10;
export const PLACEMENT_ATTEMPTS = 50;
export const WALL_CELL_CAP = 80;
export const FADE_STEPS = 40;
export const FADE_APPLES = 100;
export const FLASH_PERIOD = 4;
const ENEMY_MOVE_EVERY = 2;

export const MAX_BOMBS = 12;
const FIRST_BOMB_APPLE = 32;
const APPLES_PER_BOMB = 4;
// How many bombs there should be after this apple: 1 at apple 32, +1 every 4th apple, max 12.
export const bombCountFor = (apples) =>
  apples < FIRST_BOMB_APPLE
    ? 0
    : Math.min(MAX_BOMBS, 1 + Math.floor((apples - FIRST_BOMB_APPLE) / APPLES_PER_BOMB));

export const emptyHazards = () => ({ walls: [], bombs: [], enemy: null });

export function hazardCells(h) {
  return [
    ...h.walls.flatMap((w) => w.cells),
    ...h.bombs.flatMap((b) => b.cells),
    ...(h.enemy ? h.enemy.cells : []),
  ];
}

export const blockedKeys = (h) => new Set(hazardCells(h).map(cellKey));

const overlapsSnake = (cells, snake) => cells.some((c) => snake.some((s) => sameCell(c, s)));

// Ghost time over and no part of the snake is on it.
export const isSolid = (obj, snake) => obj.age >= ghostTime(obj) && !overlapsSnake(obj.cells, snake);

export function hitsHazard(h, cell, snake) {
  const at = (cells) => cells.some((c) => sameCell(c, cell));
  if (h.walls.some((w) => at(w.cells) && isSolid(w, snake))) return true;
  if (h.bombs.some((b) => at(b.cells) && isSolid(b, snake))) return true;
  if (h.enemy && h.enemy.status !== 'ghost' && at(h.enemy.cells)) return true;
  return false;
}

export const isGhostVisible = (age, reducedMotion = false, telegraph = TELEGRAPH_STEPS) =>
  reducedMotion || age >= telegraph - FLASH_PERIOD || Math.floor(age / FLASH_PERIOD) % 2 === 0;

export function wallOpacity(wall) {
  const ghost = ghostTime(wall);
  if (!wall.fades || wall.age < ghost) return 1;
  return Math.max(0, 1 - (wall.age - ghost) / FADE_STEPS);
}

function laneKeys(head, direction) {
  const v = VECTORS[direction];
  const keys = new Set();
  for (let i = 1; i <= LANE_LENGTH; i++) keys.add(cellKey({ x: head.x + v.x * i, y: head.y + v.y * i }));
  return keys;
}

function segmentCandidate(length) {
  return (rng) => {
    const horizontal = rng() < 0.5;
    const x = Math.floor(rng() * (horizontal ? GRID_SIZE - length + 1 : GRID_SIZE));
    const y = Math.floor(rng() * (horizontal ? GRID_SIZE : GRID_SIZE - length + 1));
    return Array.from({ length }, (_, i) => ({
      x: horizontal ? x + i : x,
      y: horizontal ? y : y + i,
    }));
  };
}

const singleCandidate = (rng) => [
  { x: Math.floor(rng() * GRID_SIZE), y: Math.floor(rng() * GRID_SIZE) },
];

// Try up to PLACEMENT_ATTEMPTS random candidates; return the first that is free,
// safe (distance and lane from the head) and leaves a route to the food, else null.
function tryPlace(world, makeCells, rng) {
  const { snake, direction, food, hazards } = world;
  const head = snake[0];
  const lane = laneKeys(head, direction);
  const taken = new Set([...snake.map(cellKey), ...blockedKeys(hazards)]);
  if (food) taken.add(cellKey(food));
  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
    const cells = makeCells(rng);
    const ok = cells.every(
      (c) =>
        inBounds(c) &&
        !taken.has(cellKey(c)) &&
        manhattan(c, head) >= SAFE_DISTANCE &&
        !lane.has(cellKey(c)),
    );
    if (!ok) continue;
    const blocked = new Set([...blockedKeys(hazards), ...cells.map(cellKey)]);
    if (hasRoute(snake, blocked, food)) return cells;
  }
  return null;
}

export const placeSegment = (world, length, rng) => tryPlace(world, segmentCandidate(length), rng);
export const placeCell = (world, rng) => tryPlace(world, singleCandidate, rng);

const INITIAL_SEGMENTS = 4;
const INITIAL_LENGTH = 3;
const PER_APPLE_LENGTH = 2;
const ENEMY_LENGTH = 3;

const wallCellCount = (h) => h.walls.reduce((total, w) => total + w.cells.length, 0);

// Hazards after an apple is eaten. `world.food` is the newly placed food;
// `apples` is the score after eating. Existing hazards are not aged here.
export function spawnForApple(world, hazards, rng, apples) {
  const tierAt = (n) => musicTier(n + START_LENGTH);
  const tier = tierAt(apples);
  const crossed = (t) => tier >= t && tierAt(apples - 1) < t;
  const telegraph = telegraphFor(apples);
  let h = hazards;
  const at = () => ({ ...world, hazards: h });
  const addWall = (length, fades = false) => {
    const cells = placeSegment(at(), length, rng);
    if (cells) h = { ...h, walls: [...h.walls, { cells, age: 0, telegraph, fades }] };
  };

  if (crossed(2)) {
    for (let i = 0; i < INITIAL_SEGMENTS; i++) addWall(INITIAL_LENGTH);
  }

  const wanted = bombCountFor(apples);
  if (wanted > 0) {
    // Every bomb jumps on every apple, one at a time. A bomb that cannot be moved
    // keeps its old cell; a new bomb that cannot be placed is skipped (retried next apple).
    const old = h.bombs;
    const placed = [];
    for (let i = 0; i < wanted; i++) {
      const others = { ...h, bombs: [...placed, ...old.slice(i + 1)] };
      const cells = placeCell({ ...world, hazards: others }, rng);
      if (cells) placed.push({ cells, age: 0, telegraph });
      else if (old[i]) placed.push(old[i]);
    }
    h = { ...h, bombs: placed };
  }

  if (tier >= 6 && wallCellCount(h) + PER_APPLE_LENGTH <= WALL_CELL_CAP) {
    addWall(PER_APPLE_LENGTH);
  }

  if (tier >= 10) {
    // One wall at a time; a wall that cannot be re-laid keeps its old place.
    const fades = apples >= FADE_APPLES;
    const old = h.walls;
    const placed = [];
    old.forEach((wall, i) => {
      const others = { ...h, walls: [...placed, ...old.slice(i + 1)] };
      const cells = placeSegment({ ...world, hazards: others }, wall.cells.length, rng);
      placed.push(cells ? { cells, age: 0, telegraph, fades } : wall);
    });
    h = { ...h, walls: placed };
  }

  if (tier >= 8 && (!h.enemy || h.enemy.status === 'dead')) {
    const without = { ...h, enemy: null };
    const cells = placeSegment({ ...world, hazards: without }, ENEMY_LENGTH, rng);
    if (cells) h = { ...h, enemy: { cells, age: 0, telegraph, status: 'ghost' } };
  }

  return h;
}

function stepEnemy(enemy, { snake, food, walls, bombs }, rng) {
  if (enemy.status === 'dead') return enemy;
  if (enemy.status === 'ghost') {
    const live = enemy.age >= ghostTime(enemy) && !overlapsSnake(enemy.cells, snake);
    return live ? { ...enemy, status: 'alive', age: 0 } : enemy;
  }
  if (enemy.age % ENEMY_MOVE_EVERY !== 0) return enemy;

  const others = blockedKeys({ walls, bombs, enemy: null });
  const snakeKeys = new Set(snake.map(cellKey));
  const ownBody = new Set(enemy.cells.slice(0, -1).map(cellKey)); // the tail cell is vacated
  const options = neighbors(enemy.cells[0]).filter((n) => {
    const key = cellKey(n);
    if (others.has(key) || snakeKeys.has(key) || ownBody.has(key)) return false;
    const moved = [n, ...enemy.cells.slice(0, -1)];
    const withEnemy = new Set([...others, ...moved.map(cellKey)]);
    return hasRoute(snake, withEnemy, food);
  });
  if (options.length === 0) return { ...enemy, status: 'dead' };
  const pick = options[Math.floor(rng() * options.length)];
  return { ...enemy, cells: [pick, ...enemy.cells.slice(0, -1)] };
}

// One game step for every hazard: everything ages, and the enemy may move or die.
export function stepHazards(hazards, { snake, food }, rng) {
  const walls = hazards.walls.map((w) => ({ ...w, age: w.age + 1 }));
  const bombs = hazards.bombs.map((b) => ({ ...b, age: b.age + 1 }));
  let enemy = hazards.enemy && { ...hazards.enemy, age: hazards.enemy.age + 1 };
  if (enemy) enemy = stepEnemy(enemy, { snake, food, walls, bombs }, rng);
  return { walls, bombs, enemy };
}
