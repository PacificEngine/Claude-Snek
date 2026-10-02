export const DIFFICULTIES = ['easy', 'medium', 'hard', 'custom'];
export const DEFAULT_DIFFICULTY = 'medium';
export const isDifficulty = (value) => DIFFICULTIES.includes(value);

const f = (key, label, group, min, max, step = 1) => ({ key, label, group, min, max, step });

export const FIELDS = [
  f('gridSize', 'Grid Size', 'Board', 10, 50),
  f('speed', 'Game Speed Modifier', 'Board', 0.1, 2, 0.1),
  f('growth', 'Growth Count', 'Board', 0, 4, 0.1),
  f('ghostTime', 'Ghost Time', 'Board', 0, 40),
  f('wallTrigger', 'Wall Trigger', 'Walls', 1, 100),
  f('wallSize', 'Wall Size', 'Walls', 1, 10),
  f('wallCount', 'Wall Count', 'Walls', 1, 20),
  f('bombTrigger', 'Bomb Trigger', 'Bombs', 1, 100),
  f('bombRate', 'Bomb Spawn Rate', 'Bombs', 1, 10),
  f('bombCount', 'Bomb Spawn Count', 'Bombs', 1, 5),
  f('bombMax', 'Bomb Spawn Max', 'Bombs', 1, 25),
  f('wallSpawnTrigger', 'Wall Spawn Trigger', 'Spawning walls', 1, 100),
  f('wallSpawnSize', 'Wall Spawn Size', 'Spawning walls', 1, 10),
  f('wallSpawnRate', 'Wall Spawn Rate', 'Spawning walls', 1, 10),
  f('wallSpawnCount', 'Wall Spawn Count', 'Spawning walls', 1, 5),
  f('wallSpawnMax', 'Wall Spawn Max (cells)', 'Spawning walls', 10, 250),
  f('enemyTrigger', 'Enemy Spawn Trigger', 'Enemies', 1, 100),
  f('enemySize', 'Enemy Spawn Size', 'Enemies', 1, 10),
  f('enemyRate', 'Enemy Spawn Rate', 'Enemies', 1, 10),
  f('enemyMax', 'Enemy Spawn Max', 'Enemies', 1, 5),
  f('movingWallTrigger', 'Moving Wall Trigger', 'Effects', 1, 100),
  f('invisibleTrigger', 'Invisible Hazard Trigger', 'Effects', 1, 100),
  f('invisibleTiming', 'Invisible Hazard Timing', 'Effects', 1, 40),
];

export const PRESETS = Object.freeze({
  easy: Object.freeze({
    gridSize: 16, speed: 0.6, growth: 0.5, ghostTime: 36,
    wallTrigger: 16, wallSize: 2, wallCount: 2,
    bombTrigger: 32, bombRate: 4, bombCount: 1, bombMax: 6,
    wallSpawnTrigger: 48, wallSpawnSize: 1, wallSpawnRate: 2, wallSpawnCount: 1, wallSpawnMax: 40,
    enemyTrigger: 64, enemySize: 2, enemyRate: 5, enemyMax: 1,
    movingWallTrigger: 80, invisibleTrigger: 100, invisibleTiming: 20,
  }),
  medium: Object.freeze({
    gridSize: 20, speed: 1, growth: 1, ghostTime: 24,
    wallTrigger: 16, wallSize: 3, wallCount: 4,
    bombTrigger: 32, bombRate: 4, bombCount: 1, bombMax: 12,
    wallSpawnTrigger: 48, wallSpawnSize: 2, wallSpawnRate: 1, wallSpawnCount: 1, wallSpawnMax: 80,
    enemyTrigger: 64, enemySize: 3, enemyRate: 5, enemyMax: 1,
    movingWallTrigger: 80, invisibleTrigger: 100, invisibleTiming: 16,
  }),
  hard: Object.freeze({
    gridSize: 40, speed: 1.2, growth: 2, ghostTime: 12,
    wallTrigger: 16, wallSize: 6, wallCount: 8,
    bombTrigger: 32, bombRate: 1, bombCount: 2, bombMax: 20,
    wallSpawnTrigger: 48, wallSpawnSize: 4, wallSpawnRate: 1, wallSpawnCount: 2, wallSpawnMax: 200,
    enemyTrigger: 64, enemySize: 6, enemyRate: 5, enemyMax: 4,
    movingWallTrigger: 80, invisibleTrigger: 100, invisibleTiming: 8,
  }),
});

const decimals = (step) => (String(step).split('.')[1] ?? '').length;

// A number inside the field's range and on its step, or undefined if `raw` is not a finite number.
export function clampField(field, raw) {
  let n = raw;
  if (typeof n === 'string') n = n.trim() === '' ? NaN : Number(n);
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  const stepped = Math.round(n / field.step) * field.step;
  const bounded = Math.min(field.max, Math.max(field.min, stepped));
  return Number(bounded.toFixed(decimals(field.step)));
}

// A complete, valid settings object; every bad or missing field comes from `fallback`.
export function sanitize(input, fallback = PRESETS.medium) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return Object.fromEntries(FIELDS.map((fld) => [fld.key, clampField(fld, source[fld.key]) ?? fallback[fld.key]]));
}

export const settingsFor = (difficulty, custom) =>
  difficulty === 'custom' ? sanitize(custom) : Object.hasOwn(PRESETS, difficulty) ? PRESETS[difficulty] : PRESETS.medium;

export function applyEdit(draft, field, raw) {
  const value = clampField(field, raw);
  return value === undefined ? draft : { ...draft, [field.key]: value };
}

export const describeRange = (field) =>
  field.step === 1 ? `${field.min}–${field.max}` : `${field.min}–${field.max}, step ${field.step}`;
