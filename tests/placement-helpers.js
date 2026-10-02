// Shared helpers for the placement tests: seeded runs hashed into fixtures, and a simple bot.
import { createState, placeFood, queueDirection, tick } from '../src/core/game.js';
import { emptyHazards, blockedKeys, spawnForApple, stepHazards } from '../src/core/hazards.js';
import { VECTORS, OPPOSITE, cellKey, inBounds, manhattan } from '../src/core/grid.js';

export const seeded = (seed) => {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// FNV-1a over a string, folded into a running 32-bit hash.
const fold = (hash, text) => {
  let h = hash;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
};
const cellsOf = (list) => list.map((o) => o.cells.map(cellKey).join(' ')).join('|');
const boardText = (food, h) =>
  `${food ? cellKey(food) : '-'}#${cellsOf(h.walls)}#${cellsOf(h.bombs)}#${cellsOf(h.enemies)}#` +
  `${h.enemies.map((e) => e.status).join(',')}#${[...h.walls, ...h.bombs, ...h.enemies].map((o) => `${o.age}/${o.telegraph}/${o.fades ? o.fadeSteps : ''}`).join(',')}`;

// 100 apples straight through spawnForApple (food first, then hazards, then a step), with a fixed snake.
export function spawnRun(settings, seed, apples = 100) {
  const rng = seeded(seed);
  const size = settings.gridSize;
  const mid = Math.floor(size / 2);
  const snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }];
  let h = emptyHazards();
  let hash = 2166136261;
  for (let apple = 1; apple <= apples; apple++) {
    const food = placeFood(snake, rng, blockedKeys(h), size);
    h = spawnForApple({ snake, direction: 'right', food, size, pending: 0 }, h, rng, apple, settings);
    h = stepHazards(h, { snake, food, size, pending: 0 }, rng);
    hash = fold(hash, boardText(food, h));
  }
  return { hash, walls: h.walls.length, bombs: h.bombs.length, enemies: h.enemies.length };
}

// A greedy bot that heads for the food while keeping room to move.
function flood(start, blocked, size) {
  const seen = new Set([cellKey(start)]);
  const q = [start];
  while (q.length) {
    const c = q.pop();
    for (const v of Object.values(VECTORS)) {
      const n = { x: c.x + v.x, y: c.y + v.y };
      const k = cellKey(n);
      if (inBounds(n, size) && !blocked.has(k) && !seen.has(k)) { seen.add(k); q.push(n); }
    }
  }
  return seen.size;
}
export function choose(state) {
  const size = state.settings.gridSize;
  const head = state.snake[0];
  const hz = blockedKeys(state.hazards);
  const body = new Set(state.snake.slice(0, -1).map(cellKey));
  const options = [];
  for (const [d, v] of Object.entries(VECTORS)) {
    if (d === OPPOSITE[state.direction]) continue;
    const n = { x: head.x + v.x, y: head.y + v.y };
    const k = cellKey(n);
    if (!inBounds(n, size) || hz.has(k) || body.has(k)) continue;
    options.push({ d, area: flood(n, new Set([...hz, ...body, k]), size), dist: state.food ? manhattan(n, state.food) : 0 });
  }
  if (!options.length) return state.direction;
  const need = state.snake.length + 4;
  const roomy = options.filter((o) => o.area >= need);
  const pool = roomy.length ? roomy : [options.sort((a, b) => b.area - a.area)[0]];
  pool.sort((a, b) => a.dist - b.dist);
  return pool[0].d;
}

// Early triggers so a short bot game goes through every hazard phase.
export const early = (s) => ({ ...s, wallTrigger: 3, bombTrigger: 6, wallSpawnTrigger: 9, movingWallTrigger: 12, enemyTrigger: 15, invisibleTrigger: 18 });

export function botRun(settings, seed, steps = 1500, opts) {
  const rng = seeded(seed);
  let state = createState(rng, settings);
  let hash = 2166136261;
  for (let step = 0; step < steps && state.status === 'playing'; step++) {
    const dir = choose(state);
    if (dir !== state.direction) state = queueDirection(state, dir);
    state = opts ? tick(state, rng, opts()) : tick(state, rng);
    hash = fold(hash, `${state.status}${state.score}${state.snake.map(cellKey).join(' ')}#${boardText(state.food, state.hazards)}`);
  }
  return { hash, score: state.score };
}

export const PRESET_NAMES = ['easy', 'medium', 'hard', 'frantic'];

// Recorded before placement was split into jobs: with no budget the results must stay exactly the same.
export const LEGACY_SPAWN = {"easy":{"hash":381676668,"walls":29,"bombs":6,"enemies":1},"medium":{"hash":1977226436,"walls":44,"bombs":12,"enemies":1},"hard":{"hash":2480104178,"walls":58,"bombs":20,"enemies":4},"frantic":{"hash":101067326,"walls":186,"bombs":30,"enemies":8}};
export const LEGACY_BOT = {"easy":{"hash":2248333830,"score":47},"medium":{"hash":2176380061,"score":42},"hard":{"hash":2885556858,"score":30},"frantic":{"hash":2261450603,"score":22}};
