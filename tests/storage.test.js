import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  loadBest, saveBest, loadDifficulty, saveDifficulty, loadCustom, saveCustom, loadMusic, saveMusic, loadMusicRandom, saveMusicRandom, loadTrack, saveTrack, loadTrackRandom, saveTrackRandom, SCORED,
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
    expect(Object.keys(stored)).toHaveLength(29);
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
  it('fills the start size with 3 for a custom saved before it existed', () => {
    const old = fakeStorage({ 'snake.custom': JSON.stringify({ gridSize: 25, growth: 3 }) });
    expect(loadCustom(old).startLength).toBe(3);
  });
  it('lowers a stored start size that no longer fits', () => {
    const bad = fakeStorage({ 'snake.custom': JSON.stringify({ gridSize: 10, maxLength: 900, startLength: 700 }) });
    expect(loadCustom(bad).startLength).toBe(50);
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
    saveCustom({ ...PRESETS.medium, t0: 5, t4: 9 }, s);
    expect(Object.keys(JSON.parse(s.data['snake.custom'])).some((k) => k in DEFAULT_MUSIC)).toBe(false);
  });
  it('ignores music keys in an old saved custom', () => {
    const old = fakeStorage({ 'snake.custom': JSON.stringify({ gridSize: 25, kickTrigger: 7, fillTrigger: 9, t0: 7, t10: 9 }) });
    const loaded = loadCustom(old);
    expect(loaded.gridSize).toBe(25);
    expect(loaded).not.toHaveProperty('kickTrigger');
    expect(loaded).not.toHaveProperty('t0');
    expect(loaded).not.toHaveProperty('fillTrigger');
    expect(loaded).not.toHaveProperty('t10');
  });
});

describe('music triggers', () => {
  it('round-trips under their own key', () => {
    const s = fakeStorage();
    saveMusic({ ...DEFAULT_MUSIC, t4: 5, t0: 0 }, s);
    expect(Object.keys(s.data)).toEqual(['snake.music']);
    expect(loadMusic(s)).toEqual({ ...DEFAULT_MUSIC, t4: 5 });
  });
  it('defaults when nothing or junk is stored', () => {
    expect(loadMusic(fakeStorage())).toEqual(DEFAULT_MUSIC);
    expect(loadMusic(fakeStorage({ 'snake.music': 'not json' }))).toEqual(DEFAULT_MUSIC);
    expect(loadMusic(fakeStorage({ 'snake.music': '[1,2]' }))).toEqual(DEFAULT_MUSIC);
    expect(loadMusic(fakeStorage({ 'snake.music': 'null' }))).toEqual(DEFAULT_MUSIC);
  });
  it('validates field by field, clamping 1001 and replacing bad values', () => {
    const s = fakeStorage({ 'snake.music': JSON.stringify({ t10: 1001, t2: 'x', t0: -3, junk: 1 }) });
    expect(loadMusic(s)).toEqual({ ...DEFAULT_MUSIC, t10: 1000, t0: 0 });
  });
  it('saves the sanitized copy', () => {
    const s = fakeStorage();
    saveMusic({ t10: 5000, junk: 1 }, s);
    const stored = JSON.parse(s.data['snake.music']);
    expect(stored.t10).toBe(1000);
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

describe('randomize-every-game toggle', () => {
  it('round-trips as true/false under its own key', () => {
    const s = fakeStorage();
    saveMusicRandom(true, s);
    expect(s.data).toEqual({ 'snake.musicRandom': 'true' });
    expect(loadMusicRandom(s)).toBe(true);
    saveMusicRandom(false, s);
    expect(s.data['snake.musicRandom']).toBe('false');
    expect(loadMusicRandom(s)).toBe(false);
  });
  it('defaults to off for nothing or junk', () => {
    ['', 'yes', '1', 'TRUE', 'null'].forEach((raw) => expect(loadMusicRandom(fakeStorage({ 'snake.musicRandom': raw }))).toBe(false));
    expect(loadMusicRandom(fakeStorage())).toBe(false);
  });
  it('only stores a real boolean', () => {
    const s = fakeStorage();
    saveMusicRandom('true', s);
    expect(s.data).toEqual({});
  });
  it('survives broken storage', () => {
    const spy = quiet();
    const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    expect(loadMusicRandom(broken)).toBe(false);
    expect(() => saveMusicRandom(true, broken)).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });
});

describe('music saved with the old instrument-named keys', () => {
  const OLD = {
    kickTrigger: 1, bassTrigger: 2, hatTrigger: 3, melodyTrigger: 4, snareTrigger: 5, fastHatTrigger: 6,
    arpTrigger: 7, bassPulseTrigger: 8, harmonyTrigger: 9, counterTrigger: 10, fillTrigger: 11,
  };
  it('loads into the slots in the old order', () => {
    const s = fakeStorage({ 'snake.music': JSON.stringify(OLD) });
    expect(loadMusic(s)).toEqual({ t0: 1, t1: 2, t2: 3, t3: 4, t4: 5, t5: 6, t6: 7, t7: 8, t8: 9, t9: 10, t10: 11 });
  });
  it('validates migrated values like any others and keeps defaults for missing ones', () => {
    const s = fakeStorage({ 'snake.music': JSON.stringify({ snareTrigger: 5000, hatTrigger: 'x' }) });
    expect(loadMusic(s)).toEqual({ ...DEFAULT_MUSIC, t4: 1000 });
  });
  it('prefers a slot key over its old name when both are stored', () => {
    const s = fakeStorage({ 'snake.music': JSON.stringify({ kickTrigger: 9, t0: 3 }) });
    expect(loadMusic(s).t0).toBe(3);
  });
  it('is written back with the new keys only', () => {
    const s = fakeStorage({ 'snake.music': JSON.stringify(OLD) });
    saveMusic(loadMusic(s), s);
    expect(Object.keys(JSON.parse(s.data['snake.music']))).toEqual(['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10']);
  });
});

describe('track choice', () => {
  it('round-trips under its own key', () => {
    const s = fakeStorage();
    saveTrack('classic', s);
    expect(s.data).toEqual({ 'snake.track': 'classic' });
    expect(loadTrack(s)).toBe('classic');
  });
  it('defaults to classic for nothing, junk or an unknown id', () => {
    expect(loadTrack(fakeStorage())).toBe('classic');
    ['', 'disco', 'null', '__proto__'].forEach((raw) => expect(loadTrack(fakeStorage({ 'snake.track': raw }))).toBe('classic'));
  });
  it('does not save an unknown id', () => {
    const s = fakeStorage();
    saveTrack('disco', s);
    expect(s.data).toEqual({});
  });
  it('survives broken storage', () => {
    const spy = quiet();
    const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    expect(loadTrack(broken)).toBe('classic');
    expect(() => saveTrack('classic', broken)).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });
});

describe('randomize-track toggle', () => {
  it('stores true or false under its own key, off by default', () => {
    const s = fakeStorage();
    expect(loadTrackRandom(s)).toBe(false);
    saveTrackRandom(true, s);
    expect(s.data).toEqual({ 'snake.trackRandom': 'true' });
    expect(loadTrackRandom(s)).toBe(true);
    saveTrackRandom(false, s);
    expect(loadTrackRandom(s)).toBe(false);
  });
  it('treats anything but "true" as off and ignores non-boolean saves', () => {
    ['', 'yes', '1', 'TRUE'].forEach((raw) => expect(loadTrackRandom(fakeStorage({ 'snake.trackRandom': raw }))).toBe(false));
    const s = fakeStorage();
    saveTrackRandom('true', s);
    expect(s.data).toEqual({});
  });
  it('survives broken storage', () => {
    const spy = quiet();
    const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    expect(loadTrackRandom(broken)).toBe(false);
    expect(() => saveTrackRandom(true, broken)).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });
});
