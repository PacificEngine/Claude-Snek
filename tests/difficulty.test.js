import { describe, it, expect } from 'vitest';
import {
  DIFFICULTIES, FIELDS, PRESETS, clampField, sanitize, settingsFor, applyEdit,
  describeRange, isDifficulty, DEFAULT_DIFFICULTY,
} from '../src/core/difficulty.js';

const field = (key) => FIELDS.find((f) => f.key === key);

const EXPECTED = {
  gridSize: [16, 20, 40], speed: [0.6, 1, 1.2], growth: [0.5, 1, 2], ghostTime: [36, 24, 12],
  wallTrigger: [16, 16, 16], wallSize: [2, 3, 6], wallCount: [2, 4, 8],
  bombTrigger: [32, 32, 32], bombRate: [4, 4, 1], bombCount: [1, 1, 2], bombMax: [6, 12, 20],
  wallSpawnTrigger: [48, 48, 48], wallSpawnSize: [1, 2, 4], wallSpawnRate: [2, 1, 1],
  wallSpawnCount: [1, 1, 2], wallSpawnMax: [40, 80, 200],
  enemyTrigger: [64, 64, 64], enemySize: [2, 3, 6], enemyRate: [5, 5, 5], enemyMax: [1, 1, 4],
  movingWallTrigger: [80, 80, 80], invisibleTrigger: [100, 100, 100], invisibleTiming: [20, 16, 8],
};

const RANGES = {
  gridSize: [10, 50, 1], speed: [0.1, 2, 0.1], growth: [0, 4, 0.1], ghostTime: [0, 40, 1],
  wallTrigger: [1, 100, 1], wallSize: [1, 10, 1], wallCount: [1, 20, 1],
  bombTrigger: [1, 100, 1], bombRate: [1, 10, 1], bombCount: [1, 5, 1], bombMax: [1, 25, 1],
  wallSpawnTrigger: [1, 100, 1], wallSpawnSize: [1, 10, 1], wallSpawnRate: [1, 10, 1],
  wallSpawnCount: [1, 5, 1], wallSpawnMax: [10, 250, 1],
  enemyTrigger: [1, 100, 1], enemySize: [1, 10, 1], enemyRate: [1, 10, 1], enemyMax: [1, 5, 1],
  movingWallTrigger: [1, 100, 1], invisibleTrigger: [1, 100, 1], invisibleTiming: [1, 40, 1],
};

describe('field table', () => {
  it('has the 23 fields in order with their ranges', () => {
    expect(FIELDS).toHaveLength(23);
    expect(FIELDS.map((f) => f.key)).toEqual(Object.keys(EXPECTED));
  });
  it('has every range and step from the spec', () => {
    expect(Object.fromEntries(FIELDS.map((f) => [f.key, [f.min, f.max, f.step]]))).toEqual(RANGES);
  });
});

describe('presets', () => {
  it.each([['easy', 0], ['medium', 1], ['hard', 2]])('%s matches the table exactly', (name, i) => {
    const expected = Object.fromEntries(Object.entries(EXPECTED).map(([k, v]) => [k, v[i]]));
    expect(PRESETS[name]).toEqual(expected);
  });
  it('keeps every preset value inside its own range and step', () => {
    for (const preset of Object.values(PRESETS)) {
      FIELDS.forEach((f) => expect(clampField(f, preset[f.key])).toBe(preset[f.key]));
    }
  });
  it('freezes the presets', () => {
    expect(Object.isFrozen(PRESETS.hard)).toBe(true);
  });
  it('lists the four difficulties and defaults to medium', () => {
    expect(DIFFICULTIES).toEqual(['easy', 'medium', 'hard', 'custom']);
    expect(DEFAULT_DIFFICULTY).toBe('medium');
    expect(isDifficulty('hard')).toBe(true);
    expect(isDifficulty('nightmare')).toBe(false);
  });
});

describe('clampField', () => {
  it('clamps to the range', () => {
    expect(clampField(field('gridSize'), 5)).toBe(10);
    expect(clampField(field('gridSize'), 99)).toBe(50);
    expect(clampField(field('growth'), -1)).toBe(0);
  });
  it('rounds to the step without float noise', () => {
    expect(clampField(field('speed'), 0.34)).toBe(0.3);
    expect(clampField(field('growth'), 0.3)).toBe(0.3);
    expect(clampField(field('speed'), 1.96)).toBe(2);
    expect(clampField(field('gridSize'), 20.6)).toBe(21);
  });
  it('accepts numeric strings', () => {
    expect(clampField(field('ghostTime'), '17')).toBe(17);
    expect(clampField(field('speed'), ' 0.7 ')).toBe(0.7);
  });
  it('rejects things that are not finite numbers', () => {
    for (const bad of ['', '   ', 'abc', NaN, Infinity, -Infinity, null, undefined, {}, [], true]) {
      expect(clampField(field('gridSize'), bad)).toBeUndefined();
    }
  });
});

describe('sanitize and settingsFor', () => {
  it('fills missing and corrupt fields from the fallback, field by field', () => {
    const s = sanitize({ gridSize: 30, speed: 'fast', growth: 99, bogus: 1 });
    expect(s.gridSize).toBe(30);
    expect(s.speed).toBe(PRESETS.medium.speed);
    expect(s.growth).toBe(4);
    expect(s).not.toHaveProperty('bogus');
    expect(Object.keys(s)).toEqual(FIELDS.map((f) => f.key));
  });
  it('treats non-objects as empty', () => {
    for (const bad of [null, undefined, 'x', 7, [1, 2, 3]]) expect(sanitize(bad)).toEqual(PRESETS.medium);
  });
  it('returns the preset for easy/medium/hard and a sanitized object for custom', () => {
    expect(settingsFor('easy')).toBe(PRESETS.easy);
    for (const name of ['constructor', 'toString', '__proto__']) expect(settingsFor(name)).toBe(PRESETS.medium);
    expect(settingsFor('hard')).toBe(PRESETS.hard);
    expect(settingsFor('custom', { gridSize: 12 }).gridSize).toBe(12);
    expect(settingsFor('custom', { gridSize: 12 }).speed).toBe(1);
  });
  it('falls back to medium for an unknown difficulty', () => {
    expect(settingsFor('nightmare')).toBe(PRESETS.medium);
  });
});

describe('applyEdit and describeRange', () => {
  it('returns a new draft with the corrected value', () => {
    const draft = { ...PRESETS.medium };
    const next = applyEdit(draft, field('gridSize'), '999');
    expect(next.gridSize).toBe(50);
    expect(next).not.toBe(draft);
    expect(draft.gridSize).toBe(20);
  });
  it('keeps the old value when the input is not a number', () => {
    const draft = { ...PRESETS.medium };
    expect(applyEdit(draft, field('gridSize'), 'abc').gridSize).toBe(20);
  });
  it('describes ranges for labels', () => {
    expect(describeRange(field('gridSize'))).toBe('10–50');
    expect(describeRange(field('speed'))).toBe('0.1–2, step 0.1');
  });
});
