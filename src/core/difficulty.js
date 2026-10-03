import { SLOT_KEYS, TRACK_IDS, DEFAULT_TRACK } from './track.js';

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'frantic', 'random', 'custom'];
export const DEFAULT_DIFFICULTY = 'medium';
export const isDifficulty = (value) => DIFFICULTIES.includes(value);

const f = (key, label, group, min, max, step = 1) => ({ key, label, group, min, max, step });
const list = (key, label, group) => ({ ...f(key, label, group, 1, 1000), type: 'list', maxItems: 10 });

export const FIELDS = [
  f('gridSize', 'Grid Size', 'Board', 10, 50),
  f('initialBpm', 'Initial BPM', 'BPM', 20, 400),
  f('finalBpm', 'Final BPM', 'BPM', 20, 400),
  f('bpmScale', 'BPM Scale', 'BPM', 0.1, 20, 0.1),
  f('growth', 'Growth Count', 'Growth', 0, 4, 0.1),
  f('maxLength', 'Max Snake Size', 'Growth', 3, 1000),
  f('ghostTime', 'Ghost Time', 'Ghost', 0, 40),
  list('ghostHalves', 'Ghost Time Half Trigger', 'Ghost'),
  f('wallTrigger', 'Wall Trigger', 'Walls', 1, 1000),
  f('wallSize', 'Wall Size', 'Walls', 1, 10),
  f('wallCount', 'Wall Count', 'Walls', 1, 20),
  f('bombTrigger', 'Bomb Trigger', 'Bombs', 1, 1000),
  f('bombRate', 'Bomb Spawn Rate', 'Bombs', 1, 10),
  f('bombCount', 'Bomb Spawn Count', 'Bombs', 1, 5),
  f('bombMax', 'Bomb Spawn Max', 'Bombs', 1, 50),
  f('wallSpawnTrigger', 'Wall Spawn Trigger', 'Spawning walls', 1, 1000),
  f('wallSpawnSize', 'Wall Spawn Size', 'Spawning walls', 1, 10),
  f('wallSpawnRate', 'Wall Spawn Rate', 'Spawning walls', 1, 10),
  f('wallSpawnCount', 'Wall Spawn Count', 'Spawning walls', 1, 5),
  f('wallSpawnMax', 'Wall Spawn Max (cells)', 'Spawning walls', 10, 1000),
  f('enemyTrigger', 'Enemy Spawn Trigger', 'Enemies', 1, 1000),
  f('enemySize', 'Enemy Spawn Size', 'Enemies', 1, 25),
  f('enemyRate', 'Enemy Spawn Rate', 'Enemies', 1, 10),
  f('enemyMax', 'Enemy Spawn Max', 'Enemies', 1, 10),
  f('movingWallTrigger', 'Moving Wall Trigger', 'Effects', 1, 1000),
  f('invisibleTrigger', 'Invisible Hazard Trigger', 'Effects', 1, 1000),
  f('invisibleTiming', 'Invisible Hazard Timing', 'Effects', 1, 40),
  list('invisibleHalves', 'Invisible Hazard Half Trigger', 'Effects'),
];

// The eleven music triggers are a global setting set: not per difficulty, always editable, stored on their own.
// Slot keys, not instrument names: the tracks give each slot its instrument (see core/track.js), the values stay with the slot.
export const MUSIC_FIELDS = SLOT_KEYS.map((key, i) => f(key, `Layer ${i + 1}`, 'Music', 0, 1000));

const GHOST_HALVES = Object.freeze([60, 120, 180, 240]);
const INVISIBLE_HALVES = Object.freeze([200, 400, 600, 800]);
export const DEFAULT_MUSIC = Object.freeze(Object.fromEntries(SLOT_KEYS.map((key, i) => [key, i < 2 ? 0 : (i - 1) * 8])));

export const PRESETS = Object.freeze({
  easy: Object.freeze({
    gridSize: 16, initialBpm: 72, finalBpm: 120, bpmScale: 0.6, growth: 0.5, maxLength: 128,
    ghostTime: 36, ghostHalves: GHOST_HALVES,
    wallTrigger: 16, wallSize: 2, wallCount: 2,
    bombTrigger: 32, bombRate: 4, bombCount: 1, bombMax: 6,
    wallSpawnTrigger: 48, wallSpawnSize: 1, wallSpawnRate: 2, wallSpawnCount: 1, wallSpawnMax: 40,
    enemyTrigger: 64, enemySize: 2, enemyRate: 5, enemyMax: 1,
    movingWallTrigger: 80, invisibleTrigger: 100, invisibleTiming: 20, invisibleHalves: INVISIBLE_HALVES,
  }),
  medium: Object.freeze({
    gridSize: 20, initialBpm: 120, finalBpm: 200, bpmScale: 1, growth: 1, maxLength: 200,
    ghostTime: 24, ghostHalves: GHOST_HALVES,
    wallTrigger: 16, wallSize: 3, wallCount: 4,
    bombTrigger: 32, bombRate: 4, bombCount: 1, bombMax: 12,
    wallSpawnTrigger: 48, wallSpawnSize: 2, wallSpawnRate: 1, wallSpawnCount: 1, wallSpawnMax: 80,
    enemyTrigger: 64, enemySize: 3, enemyRate: 5, enemyMax: 1,
    movingWallTrigger: 80, invisibleTrigger: 100, invisibleTiming: 16, invisibleHalves: INVISIBLE_HALVES,
  }),
  hard: Object.freeze({
    gridSize: 40, initialBpm: 144, finalBpm: 240, bpmScale: 1.2, growth: 2, maxLength: 800,
    ghostTime: 12, ghostHalves: GHOST_HALVES,
    wallTrigger: 16, wallSize: 6, wallCount: 8,
    bombTrigger: 32, bombRate: 1, bombCount: 2, bombMax: 20,
    wallSpawnTrigger: 48, wallSpawnSize: 4, wallSpawnRate: 1, wallSpawnCount: 2, wallSpawnMax: 200,
    enemyTrigger: 64, enemySize: 6, enemyRate: 5, enemyMax: 4,
    movingWallTrigger: 80, invisibleTrigger: 100, invisibleTiming: 8, invisibleHalves: INVISIBLE_HALVES,
  }),
  frantic: Object.freeze({
    gridSize: 50, initialBpm: 160, finalBpm: 280, bpmScale: 1.4, growth: 2, maxLength: 1000,
    ghostTime: 6, ghostHalves: GHOST_HALVES,
    wallTrigger: 16, wallSize: 10, wallCount: 20,
    bombTrigger: 32, bombRate: 1, bombCount: 5, bombMax: 30,
    wallSpawnTrigger: 48, wallSpawnSize: 6, wallSpawnRate: 1, wallSpawnCount: 4, wallSpawnMax: 1000,
    enemyTrigger: 64, enemySize: 10, enemyRate: 3, enemyMax: 8,
    movingWallTrigger: 80, invisibleTrigger: 100, invisibleTiming: 8, invisibleHalves: INVISIBLE_HALVES,
  }),
});

const decimals = (step) => (String(step).split('.')[1] ?? '').length;

const toNumber = (raw) => {
  if (typeof raw === 'string') return raw.trim() === '' ? NaN : Number(raw);
  return raw;
};

// A list of whole numbers inside the field's range (first maxItems kept), or undefined if none is valid.
function clampList(field, raw) {
  const entries = typeof raw === 'string' ? raw.split(',') : Array.isArray(raw) ? raw : [];
  const values = entries
    .map(toNumber)
    .filter((n) => typeof n === 'number' && Number.isFinite(n))
    .map((n) => Math.min(field.max, Math.max(field.min, Math.round(n))))
    .slice(0, field.maxItems);
  return values.length > 0 ? values : undefined;
}

// A value inside the field's range and on its step (a list for list fields), or undefined if `raw` is unusable.
export function clampField(field, raw) {
  if (field.type === 'list') return clampList(field, raw);
  let n = raw;
  if (typeof n === 'string') n = n.trim() === '' ? NaN : Number(n);
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  const stepped = Math.round(n / field.step) * field.step;
  const bounded = Math.min(field.max, Math.max(field.min, stepped));
  return Number(bounded.toFixed(decimals(field.step)));
}

const copy = (value) => (Array.isArray(value) ? [...value] : value);

// A complete, valid settings object; every bad or missing field comes from `fallback`.
export function sanitize(input, fallback = PRESETS.medium) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return Object.fromEntries(FIELDS.map((fld) => [fld.key, clampField(fld, source[fld.key]) ?? copy(fallback[fld.key])]));
}

// A complete, valid music object; every bad or missing trigger takes its default.
export function sanitizeMusic(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return Object.fromEntries(MUSIC_FIELDS.map((fld) => [fld.key, clampField(fld, source[fld.key]) ?? DEFAULT_MUSIC[fld.key]]));
}

// The full settings the engine reads: the difficulty's settings plus the global music triggers.
export const withMusic = (settings, music) => ({ ...settings, ...music });

// A uniform pick from min..max on `step` (float steps rounded the same way as clampField).
const pick = (rng, min, max, step = 1) => {
  const steps = Math.floor((max - min) / step + 1e-9);
  const index = Math.min(steps, Math.floor(rng() * (steps + 1)));
  return Number((min + index * step).toFixed(decimals(step)));
};

const HALF_CAPS = [200, 400, 600, 800];
const BPM_RANGE = [60, 260];
const RAMP_STEP = 10;
const CELL_CAPS = { maxLength: [3, 0.5], wallSpawnMax: [10, 0.2], bombMax: [1, 0.1], enemyMax: [1, 0.1] };
// Highest value a Random roll may use: triggers stay below 100, counts scale with the board's cells.
const randomCap = (field, cells) => {
  if (field.key.endsWith('Trigger')) return 99;
  const cap = CELL_CAPS[field.key];
  return cap ? Math.min(field.max, Math.max(cap[0], Math.floor(cap[1] * cells))) : field.max;
};

// The eleven music triggers as a build-up: the k-th earliest is at most 10k (so one is 0, two are within 10 ... all within 100),
// then a Fisher-Yates shuffle decides which instrument gets which value.
export function randomMusic(rng) {
  const ramp = MUSIC_FIELDS.map((_, k) => pick(rng, 0, RAMP_STEP * k));
  for (let i = ramp.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [ramp[i], ramp[j]] = [ramp[j], ramp[i]];
  }
  return Object.fromEntries(MUSIC_FIELDS.map((field, i) => [field.key, ramp[i]]));
}

// A complete, valid settings object with every field rolled from the injected `rng` (() => [0, 1)).
// Grid size is rolled first (it leads FIELDS) because the caps on snake length and hazard counts depend on it.
export function randomSettings(rng) {
  const settings = {};
  FIELDS.forEach((field) => {
    if (field.type === 'list') {
      settings[field.key] = HALF_CAPS.map((cap) => pick(rng, 1, cap));
      return;
    }
    const cells = (settings.gridSize ?? 0) ** 2;
    const [min, max] = field.key.endsWith('Bpm') ? BPM_RANGE : [field.min, randomCap(field, cells)];
    settings[field.key] = pick(rng, min, max, field.step);
  });
  return settings;
}

// The music one game uses: the player's saved music, or (when "Randomize Triggers Every Game" is on) a fresh ramp roll.
// The saved object is never touched.
export const musicForGame = (saved, randomizeOn, rng) => (randomizeOn ? randomMusic(rng) : { ...saved });

// The track one game uses: the player's pick, or (when "Randomize Track Every Game" is on) a uniform draw from the
// registered tracks. An unknown id plays Classic. The saved pick is never touched.
export const trackForGame = (selectedId, randomOn, rng) =>
  randomOn ? TRACK_IDS[Math.min(TRACK_IDS.length - 1, Math.floor(rng() * TRACK_IDS.length))] : (TRACK_IDS.includes(selectedId) ? selectedId : DEFAULT_TRACK);

// Settings for a difficulty. Stays pure: Random needs the caller's injected `rng` (main.js passes Math.random);
// without one it falls back to Medium rather than rolling from a hidden source.
export function settingsFor(difficulty, custom, rng) {
  if (difficulty === 'custom') return sanitize(custom);
  if (difficulty === 'random') return typeof rng === 'function' ? randomSettings(rng) : PRESETS.medium;
  return Object.hasOwn(PRESETS, difficulty) ? PRESETS[difficulty] : PRESETS.medium;
}

export function applyEdit(draft, field, raw) {
  const value = clampField(field, raw);
  return value === undefined ? draft : { ...draft, [field.key]: value };
}

export const describeRange = (field) =>
  field.type === 'list' ? `${field.min}–${field.max} each, comma separated` : field.step === 1 ? `${field.min}–${field.max}` : `${field.min}–${field.max}, step ${field.step}`;

export const formatList = (list) => list.join(', ');
