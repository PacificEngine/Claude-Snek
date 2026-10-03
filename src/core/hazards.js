import { GRID_SIZE } from './config.js';
import { VECTORS, cellKey, sameCell, inBounds, manhattan, neighbors } from './grid.js';
import { hasRoute } from './pathing.js';
import { PRESETS } from './difficulty.js';
import { freeGridOfCells, gridHasIslands, cutsGrid, peel } from './shape.js';

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
// A move that continues the enemy's direction is this many times as likely as each turn.
export const STRAIGHT_WEIGHT = 6;

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
// With `solid` (walls and bombs, not enemies) the candidate must also keep the board in one piece and must not
// turn the food's cell into a dead end it was not already. The cheap grid checks run before the route search.
function tryPlace(world, makeCells, rng, solid) {
  const { snake, direction, food, hazards } = world;
  const size = sizeOf(world);
  const head = snake[0];
  const lane = laneKeys(head, direction);
  // Built once per placement, not once per attempt: the hazards do not change while candidates are tried.
  const hazardKeys = blockedKeys(hazards);
  const taken = new Set([...snake.map(cellKey), ...hazardKeys]);
  if (food) taken.add(cellKey(food));
  const baseSolid = solid ? freeGridOfCells([...hazards.walls, ...hazards.bombs].flatMap((o) => o.cells), size) : null;
  const baseAll = solid && food ? freeGridOfCells(hazardCells(hazards), size) : null;
  const foodAt = food ? food.y * size + food.x : -1;
  const connected = solid && !gridHasIslands(baseSolid, size);
  const checkFood = baseAll !== null && !peel(baseAll, size)[foodAt];
  const without = (grid, cells) => {
    const copy = grid.slice();
    cells.forEach((c) => { copy[c.y * size + c.x] = 0; });
    return copy;
  };
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
    if (solid) {
      const idx = cells.map((c) => c.y * size + c.x);
      // A connected board only needs the cut test; one that already has a hole must be fully re-checked.
      if (connected ? cutsGrid(baseSolid, size, idx) : gridHasIslands(without(baseSolid, cells), size)) continue;
    }
    if (checkFood && peel(without(baseAll, cells), size)[foodAt]) continue;
    const cellKeys = new Set(cells.map(cellKey));
    const blocked = { has: (key) => hazardKeys.has(key) || cellKeys.has(key) };
    if (hasRoute(snake, blocked, food, size, world.pending ?? 0)) return cells;
  }
  return null;
}

// `solid` is true for walls and bombs (the shape rules apply) and false for enemies.
export const placeSegment = (world, length, rng, solid = true) => tryPlace(world, segmentCandidate(length, sizeOf(world)), rng, solid);
export const placeCell = (world, rng) => tryPlace(world, singleCandidate(sizeOf(world)), rng, true);

const spawnedWallCells = (h) =>
  h.walls.filter((w) => w.origin === 'spawn').reduce((total, w) => total + w.cells.length, 0);

// The obstacle work for one apple, as a cursor over its items. Plain data, so it can wait in the game state between
// beats. Phases run in this order; each phase's item count is fixed when the phase starts (from the board then).
export const PLACEMENT_PHASES = ['first', 'bombs', 'spawn', 'relay', 'respawn', 'topup'];

export const startPlacement = (apples) => ({ apples, phase: PLACEMENT_PHASES[0], i: 0, count: null });

const wallsSpawnOn = (apples, s) => apples >= s.wallSpawnTrigger && (apples - s.wallSpawnTrigger) % s.wallSpawnRate === 0;

// How many items a phase has, from the board as it is when the phase starts.
function phaseSize(phase, apples, h, s) {
  switch (phase) {
    case 'first': return apples === s.wallTrigger ? s.wallCount : 0;
    case 'bombs': return bombCountFor(apples, s);
    case 'spawn': return wallsSpawnOn(apples, s) ? s.wallSpawnCount : 0;
    case 'relay': return apples >= s.movingWallTrigger ? h.walls.length : 0;
    case 'respawn': return enemyTargetFor(apples, s) > 0 ? h.enemies.length : 0;
    default: return enemyTargetFor(apples, s); // topup: up to the target count
  }
}

// Is the item under the cursor real work? (A live enemy needs no respawn; spawned walls stop at their maximum.)
function isItem(work, h, s) {
  const { phase, i, count } = work;
  if (phase === 'spawn') return i < count && spawnedWallCells(h) + s.wallSpawnSize <= s.wallSpawnMax;
  if (phase === 'respawn') return i < count && h.enemies[i].status === 'dead';
  if (phase === 'topup') return h.enemies.length < count;
  return i < count;
}

// Moves the cursor onto the next real item, or returns null when the apple's work is done.
function settle(work, h, s) {
  let w = work;
  while (w) {
    if (w.count === null) {
      w = { ...w, count: phaseSize(w.phase, w.apples, h, s) };
      if (w.phase === 'bombs') w.old = h.bombs.length; // bombs up to here move; the rest are new
    }
    if (isItem(w, h, s)) return w;
    const skippable = w.phase === 'respawn' && w.i < w.count;
    if (skippable) w = { ...w, i: w.i + 1 };
    else {
      const next = PLACEMENT_PHASES[PLACEMENT_PHASES.indexOf(w.phase) + 1];
      w = next ? { apples: w.apples, phase: next, i: 0, count: null } : null;
    }
  }
  return null;
}

const without = (list, i) => list.filter((_, j) => j !== i);
const replaceAt = (list, i, item) => list.map((x, j) => (j === i ? item : x));

// Places the one item under the cursor. Each placement is checked against `world` (the live snake, direction, food,
// size and pending growth) and the hazards as they are now; an item being moved keeps its old place until then.
function placeItem(work, world, h, rng, s) {
  const { apples, phase, i } = work;
  const telegraph = halveFor(s.ghostTime, apples, s.ghostHalves);
  const fadeSteps = Math.max(1, halveFor(s.invisibleTiming, apples, s.invisibleHalves));
  const fade = { fades: apples >= s.invisibleTrigger, fadeSteps };
  const on = (hazards) => ({ ...world, hazards });
  const addWall = (length, origin) => {
    const cells = placeSegment(on(h), length, rng);
    return cells ? { ...h, walls: [...h.walls, { cells, age: 0, telegraph, origin, ...fade }] } : h;
  };
  const fresh = (cells) => ({ cells, age: 0, telegraph, status: 'ghost' });

  if (phase === 'first') return { h: addWall(s.wallSize, 'first') };
  if (phase === 'spawn') return { h: addWall(s.wallSpawnSize, 'spawn') };
  if (phase === 'bombs') {
    // Every bomb jumps on every apple, one at a time. A bomb that cannot be moved
    // keeps its old cell; a new bomb that cannot be placed is skipped (retried next apple).
    const moving = i < work.old;
    const cells = placeCell(on({ ...h, bombs: moving ? without(h.bombs, i) : h.bombs }), rng);
    const bomb = { cells, age: 0, telegraph, ...fade };
    let bombs = h.bombs;
    if (cells) bombs = moving ? replaceAt(bombs, i, bomb) : [...bombs, bomb];
    if (i === work.count - 1) bombs = bombs.slice(0, work.count); // bombs beyond the count are dropped
    return { h: { ...h, bombs } };
  }
  if (phase === 'relay') {
    // One wall at a time; a wall that cannot be re-laid keeps its old place.
    const wall = h.walls[i];
    const cells = placeSegment(on({ ...h, walls: without(h.walls, i) }), wall.cells.length, rng);
    return { h: cells ? { ...h, walls: replaceAt(h.walls, i, { ...wall, cells, age: 0, telegraph, ...fade }) } : h };
  }
  if (phase === 'respawn') {
    // replace a dead enemy with a fresh ghost; keep it as an obstacle if no spot is found
    const cells = placeSegment(on({ ...h, enemies: without(h.enemies, i) }), s.enemySize, rng, false);
    return { h: cells ? { ...h, enemies: replaceAt(h.enemies, i, fresh(cells)) } : h };
  }
  // topup: add one enemy; when none fits, stop topping up for this apple
  const cells = placeSegment(on(h), s.enemySize, rng, false);
  return cells ? { h: { ...h, enemies: [...h.enemies, fresh(cells)] } } : { h, stop: true };
}

// Places the next item of `work` and moves the cursor on. Returns the new hazards and the work left (null when done).
export function placeNext(work, world, hazards, rng, s = MEDIUM) {
  const current = settle(work, hazards, s);
  if (!current) return { work: null, hazards };
  const { h, stop } = placeItem(current, world, hazards, rng, s);
  // topping up is the last phase, so a stop there ends the work
  return { work: stop ? null : settle({ ...current, i: current.i + 1 }, h, s), hazards: h };
}

// Places items of `work` one at a time until `now() - start` reaches `budgetMs` (at least one item when any is
// waiting). With no budget everything is placed. `now` is injected so the core never reads a clock itself.
export function placeWithin(work, world, hazards, rng, s = MEDIUM, { now = () => 0, budgetMs = Infinity } = {}) {
  let next = { work, hazards };
  if (!work) return next;
  const start = now();
  do {
    next = placeNext(next.work, world, next.hazards, rng, s);
  } while (next.work && now() - start < budgetMs);
  return next;
}

// Hazards after an apple is eaten, all placed at once. `world.food` is the newly placed food; `apples` is the score
// after eating; `s` is the active settings. Existing hazards are not aged here.
export const spawnForApple = (world, hazards, rng, apples, s = MEDIUM) =>
  placeWithin(startPlacement(apples), world, hazards, rng, s).hazards;

// One draw from `rng` picks among the safe moves. Straight on (head minus the second cell; a one-cell enemy has no
// direction) weighs STRAIGHT_WEIGHT, every other move 1. The draw, scaled to the total weight, falls into consecutive
// slots: straight on first, then the turns in neighbour order. Without a straight move all weights are 1, which is
// the plain uniform pick.
function weightedMove(options, cells, rng) {
  const [head, neck] = cells;
  const ahead = neck ? { x: 2 * head.x - neck.x, y: 2 * head.y - neck.y } : null;
  const straight = ahead ? options.find((o) => sameCell(o, ahead)) : undefined;
  const ordered = straight ? [straight, ...options.filter((o) => o !== straight)] : options;
  const weight = (o) => (o === straight ? STRAIGHT_WEIGHT : 1);
  let draw = rng() * ordered.reduce((total, o) => total + weight(o), 0);
  for (const o of ordered) {
    draw -= weight(o);
    if (draw < 0) return o;
  }
  return ordered.at(-1);
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
  const pick = weightedMove(options, enemy.cells, rng);
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
