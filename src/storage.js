const KEY = 'snake.highScore';

export function loadHighScore(storage) {
  try {
    const s = storage ?? globalThis.localStorage;
    const raw = s?.getItem(KEY);
    if (raw === null || raw === undefined || raw === '') return 0;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch (err) {
    console.error('Could not read high score', err);
    return 0;
  }
}

export function saveHighScore(score, storage) {
  try {
    const s = storage ?? globalThis.localStorage;
    s?.setItem(KEY, String(score));
  } catch (err) {
    console.error('Could not save high score', err);
  }
}
