import { GRID_SIZE } from './config.js';
import { VECTORS, cellKey, sameCell, inBounds, manhattan, neighbors } from './grid.js';
import { hasRoute } from './pathing.js';
import { PRESETS } from './difficulty.js';

export const TELEGRAPH_STEPS = 24;
// Each obstacle keeps the ghost time it was created with (24 for older objects).
const ghostTime = (obj) => obj.telegraph ?? TELEGRAPH_STEPS;
export const SAFE_DISTANCE = 5;
export const LANE_LENGTH = 10;
export const PLACEMENT_ATTEMPTS = 50;
// Fallback only, for objects created without a `fadeSteps` of their own.
export const FADE_STEPS = 40;
export const FLASH_PERIOD = 4;
const ENEMY_MOVE_EVERY = 2;

const MEDIUM = PRESETS.medium;

// Halve `base` once for every entry of `halves` that is below `apples`; each halving rounds up.
export const halveFor = (base, apples, halves = []) =>
  halves.reduce((value, trigger) => (trigger < apples ? Math.ceil(value / 2) : value), base);

// How many bombs there should be after this apple.
export const bombCountFor = (apples, s = MEDIUM) =>
  apples < s.bombTrigger
    ? 0
    : Math.min(s.bombMax, s.bombCount * (1 + Math.floor((apples - s.bombTrigger) / s.bombRate)));

// How many enemies there should be after this apple.
export const enemyTargetFor = (apples, s = MEDIUM) =>
  apples < s.enemyTrigger ? 0 : Math.min(s.enemyMax, 1 + Math.floor((apples - s.enemyTrigger) / s.enemyRate));

export const emptyHazards = () => ({ walls: [], bombs: [], enemies: [] });

export function hazardCells(h) {
  return [
    ...h.walls.flatMap((w) => w.cells),
    ...h.bombs.flatMap((b) => b.cells),
    ...h.enemies.flatMap((e) => e.cells),
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
  if (h.enemies.some((e) => e.status !== 'ghost' && at(e.cells))) return true;
  return false;
}

export const isGhostVisible = (age, reducedMotion = false, telegraph = TELEGRAPH_STEPS) =>
  reducedMotion || age >= telegraph - FLASH_PERIOD || Math.floor(age / FLASH_PERIOD) % 2 === 0;

export function fadeOpacity(obj) {
  const ghost = ghostTime(obj);
  if (!obj.fades || obj.age < ghost) return 1;
  return Math.max(0, 1 - (obj.age - ghost) / (obj.fadeSteps ?? FADE_STEPS));
}

const sizeOf = (world) => world.size ?? GRID_SIZE;

function laneKeys(head, direction) {
  const v = VECTORS[direction];
  const keys = new Set();
  for (let i = 1; i <= LANE_LENGTH; i++) keys.add(cellKey({ x: head.x + v.x * i, y: head.y + v.y * i }));
  return keys;
}

function segmentCandidate(length, size) {
  return (rng) => {
    const horizontal = rng() < 0.5;
    const x = Math.floor(rng() * (horizontal ? size - length + 1 : size));
    const y = Math.floor(rng() * (horizontal ? size : size - length + 1));
    return Array.from({ length }, (_, i) => ({
      x: horizontal ? x + i : x,
      y: horizontal ? y : y + i,
    }));
  };
}

const singleCandidate = (size) => (rng) => [
  { x: Math.floor(rng() * size), y: Math.floor(rng() * size) },
];

// Try up to PLACEMENT_ATTEMPTS random candidates; return the first that is free,
// safe (distance and lane from the head) and leaves a route to the food, else null.
function tryPlace(world, makeCells, rng) {
  const { snake, direction, food, hazards } = world;
  const size = sizeOf(world);
  const head = snake[0];
  const lane = laneKeys(head, direction);
  const taken = new Set([...snake.map(cellKey), ...blockedKeys(hazards)]);
  if (food) taken.add(cellKey(food));
  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
    const cells = makeCells(rng);
    const ok = cells.every(
      (c) =>
        inBounds(c, size) &&
        !taken.has(cellKey(c)) &&
        manhattan(c, head) >= SAFE_DISTANCE &&
        !lane.has(cellKey(c)),
    );
    if (!ok) continue;
    const blocked = new Set([...blockedKeys(hazards), ...cells.map(cellKey)]);
    if (hasRoute(snake, blocked, food, size, world.pending ?? 0)) return cells;
  }
  return null;
}

export const placeSegment = (world, length, rng) => tryPlace(world, segmentCandidate(length, sizeOf(world)), rng);
export const placeCell = (world, rng) => tryPlace(world, singleCandidate(sizeOf(world)), rng);

const spawnedWallCells = (h) =>
  h.walls.filter((w) => w.origin === 'spawn').reduce((total, w) => total + w.cells.length, 0);

// Hazards after an apple is eaten. `world.food` is the newly placed food; `apples` is the score
// after eating; `s` is the active settings. Existing hazards are not aged here.
export function spawnForApple(world, hazards, rng, apples, s = MEDIUM) {
  const telegraph = halveFor(s.ghostTime, apples, s.ghostHalves);
  const fadeSteps = Math.max(1, halveFor(s.invisibleTiming, apples, s.invisibleHalves));
  const fade = { fades: apples >= s.invisibleTrigger, fadeSteps };
  let h = hazards;
  const at = () => ({ ...world, hazards: h });
  const addWall = (length, origin) => {
    const cells = placeSegment(at(), length, rng);
    if (cells) h = { ...h, walls: [...h.walls, { cells, age: 0, telegraph, origin, ...fade }] };
  };

  if (apples === s.wallTrigger) {
    for (let i = 0; i < s.wallCount; i++) addWall(s.wallSize, 'first');
  }

  const wanted = bombCountFor(apples, s);
  if (wanted > 0) {
    // Every bomb jumps on every apple, one at a time. A bomb that cannot be moved
    // keeps its old cell; a new bomb that cannot be placed is skipped (retried next apple).
    const old = h.bombs;
    const placed = [];
    for (let i = 0; i < wanted; i++) {
      const others = { ...h, bombs: [...placed, ...old.slice(i + 1)] };
      const cells = placeCell({ ...world, hazards: others }, rng);
      if (cells) placed.push({ cells, age: 0, telegraph, ...fade });
      else if (old[i]) placed.push(old[i]);
    }
    h = { ...h, bombs: placed };
  }

  if (apples >= s.wallSpawnTrigger && (apples - s.wallSpawnTrigger) % s.wallSpawnRate === 0) {
    for (let i = 0; i < s.wallSpawnCount; i++) {
      if (spawnedWallCells(h) + s.wallSpawnSize > s.wallSpawnMax) break;
      addWall(s.wallSpawnSize, 'spawn');
    }
  }

  if (apples >= s.movingWallTrigger) {
    // One wall at a time; a wall that cannot be re-laid keeps its old place.
    const old = h.walls;
    const placed = [];
    old.forEach((wall, i) => {
      const others = { ...h, walls: [...placed, ...old.slice(i + 1)] };
      const cells = placeSegment({ ...world, hazards: others }, wall.cells.length, rng);
      placed.push(cells ? { ...wall, cells, age: 0, telegraph, ...fade } : wall);
    });
    h = { ...h, walls: placed };
  }

  const enemyTarget = enemyTargetFor(apples, s);
  if (enemyTarget > 0) {
    const fresh = (cells) => ({ cells, age: 0, telegraph, status: 'ghost' });
    const old = h.enemies;
    const placed = [];
    old.forEach((enemy, i) => {
      if (enemy.status !== 'dead') {
        placed.push(enemy);
        return;
      }
      // replace a dead enemy with a fresh ghost; keep it as an obstacle if no spot is found
      const others = { ...h, enemies: [...placed, ...old.slice(i + 1)] };
      const cells = placeSegment({ ...world, hazards: others }, s.enemySize, rng);
      placed.push(cells ? fresh(cells) : enemy);
    });
    while (placed.length < enemyTarget) {
      const cells = placeSegment({ ...world, hazards: { ...h, enemies: placed } }, s.enemySize, rng);
      if (!cells) break;
      placed.push(fresh(cells));
    }
    h = { ...h, enemies: placed };
  }

  return h;
}

function stepEnemy(enemy, { snake, food, others, size = GRID_SIZE, pending = 0 }, rng) {
  if (enemy.status === 'dead') return enemy;
  if (enemy.status === 'ghost') {
    const live = enemy.age >= ghostTime(enemy) && !overlapsSnake(enemy.cells, snake);
    return live ? { ...enemy, status: 'alive', age: 0 } : enemy;
  }
  if (enemy.age % ENEMY_MOVE_EVERY !== 0) return enemy;

  const snakeKeys = new Set(snake.map(cellKey));
  const ownBody = new Set(enemy.cells.slice(0, Math.max(2, enemy.cells.length - 1)).map(cellKey)); // the tail is vacated, but the neck never is
  const options = neighbors(enemy.cells[0], size).filter((n) => {
    const key = cellKey(n);
    if (others.has(key) || snakeKeys.has(key) || ownBody.has(key)) return false;
    const moved = [n, ...enemy.cells.slice(0, -1)];
    const withEnemy = new Set([...others, ...moved.map(cellKey)]);
    return hasRoute(snake, withEnemy, food, size, pending);
  });
  if (options.length === 0) return { ...enemy, status: 'dead' };
  const pick = options[Math.floor(rng() * options.length)];
  return { ...enemy, cells: [pick, ...enemy.cells.slice(0, -1)] };
}

// One game step for every hazard: everything ages, and each enemy may move or die.
// Enemies move one after another, so later ones see where earlier ones now are.
export function stepHazards(hazards, { snake, food, size, pending }, rng) {
  const walls = hazards.walls.map((w) => ({ ...w, age: w.age + 1 }));
  const bombs = hazards.bombs.map((b) => ({ ...b, age: b.age + 1 }));
  const enemies = hazards.enemies.map((e) => ({ ...e, age: e.age + 1 }));
  for (let i = 0; i < enemies.length; i++) {
    const rest = enemies.filter((_, j) => j !== i);
    const others = blockedKeys({ walls, bombs, enemies: rest });
    enemies[i] = stepEnemy(enemies[i], { snake, food, others, size, pending }, rng);
  }
  return { walls, bombs, enemies };
}
