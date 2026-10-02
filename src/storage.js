import { DEFAULT_DIFFICULTY, PRESETS, isDifficulty, sanitize } from './core/difficulty.js';

export const SCORED = ['easy', 'medium', 'hard'];
const BEST_PREFIX = 'snake.highScore.';
const LEGACY_BEST = 'snake.highScore';
const DIFFICULTY_KEY = 'snake.difficulty';
const CUSTOM_KEY = 'snake.custom';

// Resolve storage inside the try: reading localStorage itself can throw when it is blocked.
function guarded(action, fallback, message) {
  try {
    return action();
  } catch (err) {
    console.error(message, err);
    return fallback;
  }
}

const store = (storage) => storage ?? globalThis.localStorage;

const parseScore = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

// Custom has no best score: it is never read and never written.
export function loadBest(difficulty, storage) {
  if (!SCORED.includes(difficulty)) return 0;
  return guarded(() => {
    const s = store(storage);
    const own = parseScore(s?.getItem(BEST_PREFIX + difficulty));
    if (own !== null) return own;
    if (difficulty === 'medium') return parseScore(s?.getItem(LEGACY_BEST)) ?? 0;
    return 0;
  }, 0, 'Could not read best score');
}

export function saveBest(difficulty, score, storage) {
  if (!SCORED.includes(difficulty)) return;
  guarded(() => store(storage)?.setItem(BEST_PREFIX + difficulty, String(score)), undefined, 'Could not save best score');
}

export function loadDifficulty(storage) {
  return guarded(() => {
    const value = store(storage)?.getItem(DIFFICULTY_KEY);
    return isDifficulty(value) ? value : DEFAULT_DIFFICULTY;
  }, DEFAULT_DIFFICULTY, 'Could not read difficulty');
}

export function saveDifficulty(difficulty, storage) {
  if (!isDifficulty(difficulty)) return;
  guarded(() => store(storage)?.setItem(DIFFICULTY_KEY, difficulty), undefined, 'Could not save difficulty');
}

export function loadCustom(storage) {
  return guarded(() => {
    const raw = store(storage)?.getItem(CUSTOM_KEY);
    if (!raw) return { ...PRESETS.medium };
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ...PRESETS.medium };
    }
    return sanitize(parsed);
  }, { ...PRESETS.medium }, 'Could not read custom settings');
}

export function saveCustom(custom, storage) {
  guarded(() => store(storage)?.setItem(CUSTOM_KEY, JSON.stringify(sanitize(custom))), undefined, 'Could not save custom settings');
}
