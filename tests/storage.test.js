import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadHighScore, saveHighScore } from '../src/storage.js';

const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete globalThis.localStorage;
});

const throwingLocalStorage = () =>
  Object.defineProperty(globalThis, 'localStorage', {
    get() { throw new Error('SecurityError: storage disabled'); },
    configurable: true,
  });

describe('loadHighScore', () => {
  it('returns 0 when nothing is stored', () => {
    expect(loadHighScore(fakeStorage())).toBe(0);
  });
  it('returns the stored integer', () => {
    expect(loadHighScore(fakeStorage({ 'snake.highScore': '12' }))).toBe(12);
  });
  it.each(['abc', '-5', 'NaN', '1e999', '1.5', ''])('rejects tampered value %j', (bad) => {
    expect(loadHighScore(fakeStorage({ 'snake.highScore': bad }))).toBe(0);
  });
  it('returns 0 and logs when storage throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { getItem() { throw new Error('denied'); } };
    expect(loadHighScore(broken)).toBe(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
  it('returns 0 when storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadHighScore()).toBe(0);
  });
  it('returns 0 and logs when localStorage getter throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    throwingLocalStorage();
    expect(loadHighScore()).toBe(0);
    expect(spy).toHaveBeenCalled();
  });
});

describe('saveHighScore', () => {
  it('stores the score', () => {
    const s = fakeStorage();
    saveHighScore(7, s);
    expect(s.data['snake.highScore']).toBe('7');
  });
  it('swallows and logs storage errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { setItem() { throw new Error('full'); } };
    expect(() => saveHighScore(7, broken)).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
  it('swallows and logs when localStorage getter throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    throwingLocalStorage();
    expect(() => saveHighScore(5)).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });
  it('is a no-op when storage is undefined and no localStorage', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('localStorage', undefined);
    expect(() => saveHighScore(7)).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
