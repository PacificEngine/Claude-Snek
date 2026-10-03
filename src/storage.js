import { TRACK_IDS, DEFAULT_TRACK } from './core/track.js';
import { sanitizeThemes, DEFAULT_THEME_ID } from './core/theme.js';
import { DEFAULT_DIFFICULTY, isDifficulty, sanitize, sanitizeAllMusic } from './core/difficulty.js';

export const SCORED = ['easy', 'medium', 'hard', 'frantic'];
const BEST_PREFIX = 'snake.highScore.';
const LEGACY_BEST = 'snake.highScore';
const DIFFICULTY_KEY = 'snake.difficulty';
const CUSTOM_KEY = 'snake.custom';
const MUSIC_KEY = 'snake.music';
const MUSIC_RANDOM_KEY = 'snake.musicRandom';
const TRACK_KEY = 'snake.track';
const TRACK_RANDOM_KEY = 'snake.trackRandom';
const THEMES_KEY = 'snake.themes';
const THEME_CHOICE_KEY = 'snake.themeChoice';
const THEME_MATCH_KEY = 'snake.themeMatch';
const THEME_RANDOM_KEY = 'snake.themeRandom';
const STYLE_RANDOM_KEY = 'snake.styleRandom';

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

// Every track's own triggers. Older saves (one flat set, slot- or instrument-named) are copied to every track by sanitizeAllMusic.
export function loadMusic(storage) {
  return guarded(() => {
    const raw = store(storage)?.getItem(MUSIC_KEY);
    if (!raw) return sanitizeAllMusic({});
    try {
      return sanitizeAllMusic(JSON.parse(raw));
    } catch {
      return sanitizeAllMusic({});
    }
  }, sanitizeAllMusic({}), 'Could not read music settings');
}

export function saveMusic(music, storage) {
  guarded(() => store(storage)?.setItem(MUSIC_KEY, JSON.stringify(sanitizeAllMusic(music))), undefined, 'Could not save music settings');
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

// Every theme, each checked field by field; missing or corrupt ones are that theme's built-in default.
export function loadThemes(storage) {
  return guarded(() => {
    const raw = store(storage)?.getItem(THEMES_KEY);
    if (!raw) return sanitizeThemes({});
    try {
      return sanitizeThemes(JSON.parse(raw));
    } catch {
      return sanitizeThemes({});
    }
  }, sanitizeThemes({}), 'Could not read themes');
}

export function saveThemes(themes, storage) {
  guarded(() => store(storage)?.setItem(THEMES_KEY, JSON.stringify(sanitizeThemes(themes))), undefined, 'Could not save themes');
}

// The theme chosen for editing and for play when Match is off: only a known theme id is believed.
export function loadThemeChoice(storage) {
  return guarded(() => {
    const value = store(storage)?.getItem(THEME_CHOICE_KEY);
    return TRACK_IDS.includes(value) ? value : DEFAULT_THEME_ID;
  }, DEFAULT_THEME_ID, 'Could not read theme choice');
}

export function saveThemeChoice(id, storage) {
  if (!TRACK_IDS.includes(id)) return;
  guarded(() => store(storage)?.setItem(THEME_CHOICE_KEY, id), undefined, 'Could not save theme choice');
}

// "Match Theme with Soundtrack": on unless it was saved as exactly 'false'.
export function loadThemeMatch(storage) {
  return guarded(() => store(storage)?.getItem(THEME_MATCH_KEY) !== 'false', true, 'Could not read theme match setting');
}

export function saveThemeMatch(on, storage) {
  if (typeof on !== 'boolean') return;
  guarded(() => store(storage)?.setItem(THEME_MATCH_KEY, String(on)), undefined, 'Could not save theme match setting');
}

export function loadThemeRandom(storage) {
  return guarded(() => store(storage)?.getItem(THEME_RANDOM_KEY) === 'true', false, 'Could not read theme randomize setting');
}

export function saveThemeRandom(on, storage) {
  if (typeof on !== 'boolean') return;
  guarded(() => store(storage)?.setItem(THEME_RANDOM_KEY, String(on)), undefined, 'Could not save theme randomize setting');
}

export function loadStyleRandom(storage) {
  return guarded(() => store(storage)?.getItem(STYLE_RANDOM_KEY) === 'true', false, 'Could not read style randomize setting');
}

export function saveStyleRandom(on, storage) {
  if (typeof on !== 'boolean') return;
  guarded(() => store(storage)?.setItem(STYLE_RANDOM_KEY, String(on)), undefined, 'Could not save style randomize setting');
}
