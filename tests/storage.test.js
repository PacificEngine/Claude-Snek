import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  loadBest, saveBest, loadDifficulty, saveDifficulty, loadCustom, saveCustom, loadMusic, saveMusic, SCORED,
} from '../src/storage.js';
import { PRESETS, DEFAULT_MUSIC } from '../src/core/difficulty.js';

const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
};
const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('best scores', () => {
  it('keeps a separate best for each preset difficulty', () => {
    const s = fakeStorage();
    saveBest('easy', 7, s);
    saveBest('medium', 12, s);
    saveBest('hard', 3, s);
    expect(s.data).toMatchObject({ 'snake.highScore.easy': '7', 'snake.highScore.medium': '12', 'snake.highScore.hard': '3' });
    expect(['easy', 'medium', 'hard'].map((d) => loadBest(d, s))).toEqual([7, 12, 3]);
  });
  it('keeps frantic apart from the other bests under its own key', () => {
    const s = fakeStorage();
    saveBest('frantic', 9, s);
    saveBest('hard', 4, s);
    expect(s.data).toMatchObject({ 'snake.highScore.frantic': '9', 'snake.highScore.hard': '4' });
    expect(loadBest('frantic', s)).toBe(9);
    expect(loadBest('hard', s)).toBe(4);
    expect(SCORED).toEqual(['easy', 'medium', 'hard', 'frantic']);
  });
  it('never reads or writes a random score', () => {
    const s = fakeStorage({ 'snake.highScore.random': '99' });
    saveBest('random', 5, s);
    expect(loadBest('random', s)).toBe(0);
    expect(s.data).toEqual({ 'snake.highScore.random': '99' });
    expect(SCORED).not.toContain('random');
  });
  it('returns 0 when nothing is stored', () => {
    expect(loadBest('easy', fakeStorage())).toBe(0);
  });
  it('never reads or writes a custom score', () => {
    const s = fakeStorage({ 'snake.highScore.custom': '99' });
    expect(loadBest('custom', s)).toBe(0);
    saveBest('custom', 50, s);
    expect(Object.keys(s.data)).toEqual(['snake.highScore.custom']);
    expect(s.data['snake.highScore.custom']).toBe('99'); // untouched
  });
  it('ignores unknown difficulties', () => {
    const s = fakeStorage();
    saveBest('nightmare', 5, s);
    expect(s.data).toEqual({});
    expect(loadBest('nightmare', s)).toBe(0);
  });
  it('uses the old single saved score as medium once', () => {
    expect(loadBest('medium', fakeStorage({ 'snake.highScore': '21' }))).toBe(21);
    expect(loadBest('easy', fakeStorage({ 'snake.highScore': '21' }))).toBe(0);
    expect(loadBest('medium', fakeStorage({ 'snake.highScore': '21', 'snake.highScore.medium': '4' }))).toBe(4);
  });
  it.each(['abc', '-5', 'NaN', '1e999', '1.5', ''])('rejects tampered value %j', (bad) => {
    expect(loadBest('hard', fakeStorage({ 'snake.highScore.hard': bad }))).toBe(0);
  });
  it('survives storage that throws, and storage that is missing', () => {
    const spy = quiet();
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };
    expect(loadBest('easy', broken)).toBe(0);
    expect(() => saveBest('easy', 3, broken)).not.toThrow();
    expect(spy).toHaveBeenCalled();
    vi.stubGlobal('localStorage', undefined);
    expect(loadBest('easy')).toBe(0);
    expect(() => saveBest('easy', 1)).not.toThrow();
  });
  it('survives a localStorage getter that throws', () => {
    const spy = quiet();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    try {
      expect(loadBest('easy')).toBe(0);
      expect(() => saveBest('easy', 1)).not.toThrow();
      expect(spy).toHaveBeenCalled();
    } finally { delete globalThis.localStorage; }
  });
});

describe('chosen difficulty', () => {
  it('round-trips a valid difficulty', () => {
    const s = fakeStorage();
    saveDifficulty('hard', s);
    expect(loadDifficulty(s)).toBe('hard');
    saveDifficulty('custom', s);
    expect(loadDifficulty(s)).toBe('custom');
    saveDifficulty('frantic', s);
    expect(loadDifficulty(s)).toBe('frantic');
    saveDifficulty('random', s);
    expect(loadDifficulty(s)).toBe('random');
    expect(s.data).toEqual({ 'snake.difficulty': 'random' });
  });
  it('defaults to medium for missing or invalid values', () => {
    expect(loadDifficulty(fakeStorage())).toBe('medium');
    expect(loadDifficulty(fakeStorage({ 'snake.difficulty': 'nightmare' }))).toBe('medium');
  });
  it('does not save an invalid difficulty', () => {
    const s = fakeStorage();
    saveDifficulty('nightmare', s);
    expect(s.data).toEqual({});
  });
});

describe('custom settings', () => {
  it('round-trips and validates every field', () => {
    const s = fakeStorage();
    saveCustom({ ...PRESETS.medium, gridSize: 33, bpmScale: 1.7, ghostHalves: [30, 90, 90] }, s);
    const loaded = loadCustom(s);
    expect(loaded.gridSize).toBe(33);
    expect(loaded.bpmScale).toBe(1.7);
    expect(loaded.ghostHalves).toEqual([30, 90, 90]);
    expect(loaded.invisibleHalves).toEqual(PRESETS.medium.invisibleHalves);
    expect(loaded.growth).toBe(PRESETS.medium.growth);
  });
  it('stores the sanitized copy, not what it was given', () => {
    const s = fakeStorage();
    saveCustom({ gridSize: 9999, junk: 1 }, s);
    const stored = JSON.parse(s.data['snake.custom']);
    expect(stored.gridSize).toBe(50);
    expect(stored).not.toHaveProperty('junk');
    expect(Object.keys(stored)).toHaveLength(28);
  });
  it('replaces bad fields with medium defaults and ignores junk', () => {
    const bad = fakeStorage({ 'snake.custom': JSON.stringify({ gridSize: 9999, bpmScale: 'x', growth: 2 }) });
    const loaded = loadCustom(bad);
    expect(loaded.gridSize).toBe(50);
    expect(loaded.bpmScale).toBe(1);
    expect(loaded.growth).toBe(2);
    expect(loadCustom(fakeStorage({ 'snake.custom': 'not json' }))).toEqual(PRESETS.medium);
    expect(loadCustom(fakeStorage({ 'snake.custom': '[1,2]' }))).toEqual(PRESETS.medium);
    expect(loadCustom(fakeStorage())).toEqual(PRESETS.medium);
  });
  it('migrates an old save with speed and no new keys, filling from medium', () => {
    const old = fakeStorage({ 'snake.custom': JSON.stringify({ gridSize: 25, speed: 1.5, growth: 3, ghostTime: 10 }) });
    const loaded = loadCustom(old);
    expect(loaded).not.toHaveProperty('speed');
    expect(loaded).toMatchObject({ gridSize: 25, growth: 3, ghostTime: 10 });
    expect(loaded).toMatchObject({
      initialBpm: 120, finalBpm: 200, bpmScale: 1, maxLength: 200,
      ghostHalves: [60, 120, 180, 240], invisibleHalves: [200, 400, 600, 800],
    });
  });
  it('does not share the preset arrays with what it loads', () => {
    const loaded = loadCustom(fakeStorage());
    expect(loaded.ghostHalves).not.toBe(PRESETS.medium.ghostHalves);
    expect(Object.isFrozen(loaded.ghostHalves)).toBe(false);
  });
  it('survives broken storage', () => {
    const spy = quiet();
    const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    expect(loadCustom(broken)).toEqual(PRESETS.medium);
    expect(() => saveCustom(PRESETS.medium, broken)).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });
});

describe('custom settings and music', () => {
  it('does not store music keys with the custom settings', () => {
    const s = fakeStorage();
    saveCustom({ ...PRESETS.medium, kickTrigger: 5, snareTrigger: 9 }, s);
    expect(Object.keys(JSON.parse(s.data['snake.custom'])).some((k) => k in DEFAULT_MUSIC)).toBe(false);
  });
  it('ignores music keys in an old saved custom', () => {
    const old = fakeStorage({ 'snake.custom': JSON.stringify({ gridSize: 25, kickTrigger: 7, fillTrigger: 9 }) });
    const loaded = loadCustom(old);
    expect(loaded.gridSize).toBe(25);
    expect(loaded).not.toHaveProperty('kickTrigger');
    expect(loaded).not.toHaveProperty('fillTrigger');
  });
});

describe('music triggers', () => {
  it('round-trips under their own key', () => {
    const s = fakeStorage();
    saveMusic({ ...DEFAULT_MUSIC, snareTrigger: 5, kickTrigger: 0 }, s);
    expect(Object.keys(s.data)).toEqual(['snake.music']);
    expect(loadMusic(s)).toEqual({ ...DEFAULT_MUSIC, snareTrigger: 5 });
  });
  it('defaults when nothing or junk is stored', () => {
    expect(loadMusic(fakeStorage())).toEqual(DEFAULT_MUSIC);
    expect(loadMusic(fakeStorage({ 'snake.music': 'not json' }))).toEqual(DEFAULT_MUSIC);
    expect(loadMusic(fakeStorage({ 'snake.music': '[1,2]' }))).toEqual(DEFAULT_MUSIC);
    expect(loadMusic(fakeStorage({ 'snake.music': 'null' }))).toEqual(DEFAULT_MUSIC);
  });
  it('validates field by field, clamping 1001 and replacing bad values', () => {
    const s = fakeStorage({ 'snake.music': JSON.stringify({ fillTrigger: 1001, hatTrigger: 'x', kickTrigger: -3, junk: 1 }) });
    expect(loadMusic(s)).toEqual({ ...DEFAULT_MUSIC, fillTrigger: 1000, kickTrigger: 0 });
  });
  it('saves the sanitized copy', () => {
    const s = fakeStorage();
    saveMusic({ fillTrigger: 5000, junk: 1 }, s);
    const stored = JSON.parse(s.data['snake.music']);
    expect(stored.fillTrigger).toBe(1000);
    expect(stored).not.toHaveProperty('junk');
    expect(Object.keys(stored)).toHaveLength(11);
  });
  it('survives broken storage', () => {
    const spy = quiet();
    const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    expect(loadMusic(broken)).toEqual(DEFAULT_MUSIC);
    expect(() => saveMusic(DEFAULT_MUSIC, broken)).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });
});
