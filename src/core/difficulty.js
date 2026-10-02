export const DIFFICULTIES = ['easy', 'medium', 'hard', 'custom'];
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
  f('bombMax', 'Bomb Spawn Max', 'Bombs', 1, 25),
  f('wallSpawnTrigger', 'Wall Spawn Trigger', 'Spawning walls', 1, 1000),
  f('wallSpawnSize', 'Wall Spawn Size', 'Spawning walls', 1, 10),
  f('wallSpawnRate', 'Wall Spawn Rate', 'Spawning walls', 1, 10),
  f('wallSpawnCount', 'Wall Spawn Count', 'Spawning walls', 1, 5),
  f('wallSpawnMax', 'Wall Spawn Max (cells)', 'Spawning walls', 10, 250),
  f('enemyTrigger', 'Enemy Spawn Trigger', 'Enemies', 1, 1000),
  f('enemySize', 'Enemy Spawn Size', 'Enemies', 1, 10),
  f('enemyRate', 'Enemy Spawn Rate', 'Enemies', 1, 10),
  f('enemyMax', 'Enemy Spawn Max', 'Enemies', 1, 5),
  f('movingWallTrigger', 'Moving Wall Trigger', 'Effects', 1, 1000),
  f('invisibleTrigger', 'Invisible Hazard Trigger', 'Effects', 1, 1000),
  f('invisibleTiming', 'Invisible Hazard Timing', 'Effects', 1, 40),
  list('invisibleHalves', 'Invisible Hazard Half Trigger', 'Effects'),
  f('hatTrigger', 'Hi-Hat Trigger', 'Music', 0, 1000),
  f('melodyTrigger', 'Melody Trigger', 'Music', 0, 1000),
  f('snareTrigger', 'Snare Trigger', 'Music', 0, 1000),
  f('fastHatTrigger', 'Fast Hi-Hat Trigger', 'Music', 0, 1000),
  f('arpTrigger', 'Arpeggio Trigger', 'Music', 0, 1000),
  f('bassPulseTrigger', 'Bass Pulse Trigger', 'Music', 0, 1000),
  f('harmonyTrigger', 'Harmony Trigger', 'Music', 0, 1000),
  f('counterTrigger', 'Counter-Melody Trigger', 'Music', 0, 1000),
  f('fillTrigger', 'Drum Fill Trigger', 'Music', 0, 1000),
];

const GHOST_HALVES = Object.freeze([60, 120, 180, 240]);
const INVISIBLE_HALVES = Object.freeze([200, 400, 600, 800]);
const MUSIC = {
  hatTrigger: 8, melodyTrigger: 16, snareTrigger: 24, fastHatTrigger: 32, arpTrigger: 40,
  bassPulseTrigger: 48, harmonyTrigger: 56, counterTrigger: 64, fillTrigger: 72,
};

export const PRESETS = Object.freeze({
  easy: Object.freeze({
    gridSize: 16, initialBpm: 72, finalBpm: 120, bpmScale: 0.6, growth: 0.5, maxLength: 128,
    ghostTime: 36, ghostHalves: GHOST_HALVES,
    wallTrigger: 16, wallSize: 2, wallCount: 2,
    bombTrigger: 32, bombRate: 4, bombCount: 1, bombMax: 6,
    wallSpawnTrigger: 48, wallSpawnSize: 1, wallSpawnRate: 2, wallSpawnCount: 1, wallSpawnMax: 40,
    enemyTrigger: 64, enemySize: 2, enemyRate: 5, enemyMax: 1,
    movingWallTrigger: 80, invisibleTrigger: 100, invisibleTiming: 20, invisibleHalves: INVISIBLE_HALVES,
    ...MUSIC,
  }),
  medium: Object.freeze({
    gridSize: 20, initialBpm: 120, finalBpm: 200, bpmScale: 1, growth: 1, maxLength: 200,
    ghostTime: 24, ghostHalves: GHOST_HALVES,
    wallTrigger: 16, wallSize: 3, wallCount: 4,
    bombTrigger: 32, bombRate: 4, bombCount: 1, bombMax: 12,
    wallSpawnTrigger: 48, wallSpawnSize: 2, wallSpawnRate: 1, wallSpawnCount: 1, wallSpawnMax: 80,
    enemyTrigger: 64, enemySize: 3, enemyRate: 5, enemyMax: 1,
    movingWallTrigger: 80, invisibleTrigger: 100, invisibleTiming: 16, invisibleHalves: INVISIBLE_HALVES,
    ...MUSIC,
  }),
  hard: Object.freeze({
    gridSize: 40, initialBpm: 144, finalBpm: 240, bpmScale: 1.2, growth: 2, maxLength: 800,
    ghostTime: 12, ghostHalves: GHOST_HALVES,
    wallTrigger: 16, wallSize: 6, wallCount: 8,
    bombTrigger: 32, bombRate: 1, bombCount: 2, bombMax: 20,
    wallSpawnTrigger: 48, wallSpawnSize: 4, wallSpawnRate: 1, wallSpawnCount: 2, wallSpawnMax: 200,
    enemyTrigger: 64, enemySize: 6, enemyRate: 5, enemyMax: 4,
    movingWallTrigger: 80, invisibleTrigger: 100, invisibleTiming: 8, invisibleHalves: INVISIBLE_HALVES,
    ...MUSIC,
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

export const settingsFor = (difficulty, custom) =>
  difficulty === 'custom' ? sanitize(custom) : Object.hasOwn(PRESETS, difficulty) ? PRESETS[difficulty] : PRESETS.medium;

export function applyEdit(draft, field, raw) {
  const value = clampField(field, raw);
  return value === undefined ? draft : { ...draft, [field.key]: value };
}

export const describeRange = (field) =>
  field.type === 'list' ? `${field.min}–${field.max} each, comma separated` : field.step === 1 ? `${field.min}–${field.max}` : `${field.min}–${field.max}, step ${field.step}`;

export const formatList = (list) => list.join(', ');
