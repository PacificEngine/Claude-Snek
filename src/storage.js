import { SLOT_KEYS, TRACK_IDS, DEFAULT_TRACK } from './core/track.js';
import { DEFAULT_DIFFICULTY, isDifficulty, sanitize, sanitizeMusic } from './core/difficulty.js';

export const SCORED = ['easy', 'medium', 'hard', 'frantic'];
const BEST_PREFIX = 'snake.highScore.';
const LEGACY_BEST = 'snake.highScore';
const DIFFICULTY_KEY = 'snake.difficulty';
const CUSTOM_KEY = 'snake.custom';
const MUSIC_KEY = 'snake.music';
const MUSIC_RANDOM_KEY = 'snake.musicRandom';
const TRACK_KEY = 'snake.track';
const TRACK_RANDOM_KEY = 'snake.trackRandom';

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
    if (!raw) return sanitize({});
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return sanitize({});
    }
    return sanitize(parsed);
  }, sanitize({}), 'Could not read custom settings');
}

export function saveCustom(custom, storage) {
  guarded(() => store(storage)?.setItem(CUSTOM_KEY, JSON.stringify(sanitize(custom))), undefined, 'Could not save custom settings');
}

// Music saved before the triggers belonged to slots used instrument-named keys; they map onto the slots in the old order.
const OLD_MUSIC_KEYS = ['kickTrigger', 'bassTrigger', 'hatTrigger', 'melodyTrigger', 'snareTrigger', 'fastHatTrigger', 'arpTrigger', 'bassPulseTrigger', 'harmonyTrigger', 'counterTrigger', 'fillTrigger'];
function withSlotKeys(saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return saved;
  const converted = Object.fromEntries(OLD_MUSIC_KEYS.filter((old) => old in saved).map((old) => [SLOT_KEYS[OLD_MUSIC_KEYS.indexOf(old)], saved[old]]));
  return { ...converted, ...saved };
}

export function loadMusic(storage) {
  return guarded(() => {
    const raw = store(storage)?.getItem(MUSIC_KEY);
    if (!raw) return sanitizeMusic({});
    try {
      return sanitizeMusic(withSlotKeys(JSON.parse(raw)));
    } catch {
      return sanitizeMusic({});
    }
  }, sanitizeMusic({}), 'Could not read music settings');
}

export function saveMusic(music, storage) {
  guarded(() => store(storage)?.setItem(MUSIC_KEY, JSON.stringify(sanitizeMusic(music))), undefined, 'Could not save music settings');
}

// The "Randomize every game" toggle: stored as 'true' or 'false'; anything else means off.
export function loadMusicRandom(storage) {
  return guarded(() => store(storage)?.getItem(MUSIC_RANDOM_KEY) === 'true', false, 'Could not read music randomize setting');
}

export function saveMusicRandom(on, storage) {
  if (typeof on !== 'boolean') return;
  guarded(() => store(storage)?.setItem(MUSIC_RANDOM_KEY, String(on)), undefined, 'Could not save music randomize setting');
}

// The chosen soundtrack: only a registered id is believed, anything else is Classic.
export function loadTrack(storage) {
  return guarded(() => {
    const value = store(storage)?.getItem(TRACK_KEY);
    return TRACK_IDS.includes(value) ? value : DEFAULT_TRACK;
  }, DEFAULT_TRACK, 'Could not read track');
}

export function saveTrack(id, storage) {
  if (!TRACK_IDS.includes(id)) return;
  guarded(() => store(storage)?.setItem(TRACK_KEY, id), undefined, 'Could not save track');
}

// The "Randomize Track Every Game" toggle: stored as 'true' or 'false'; anything else means off.
export function loadTrackRandom(storage) {
  return guarded(() => store(storage)?.getItem(TRACK_RANDOM_KEY) === 'true', false, 'Could not read track randomize setting');
}

export function saveTrackRandom(on, storage) {
  if (typeof on !== 'boolean') return;
  guarded(() => store(storage)?.setItem(TRACK_RANDOM_KEY, String(on)), undefined, 'Could not save track randomize setting');
}
