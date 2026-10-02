import { describe, it, expect } from 'vitest';
import {
  DIFFICULTIES, FIELDS, PRESETS, clampField, sanitize, settingsFor, applyEdit,
  describeRange, formatList, isDifficulty, DEFAULT_DIFFICULTY,
} from '../src/core/difficulty.js';

const field = (key) => FIELDS.find((f) => f.key === key);

const GHOST = [60, 120, 180, 240];
const INVIS = [200, 400, 600, 800];
const EXPECTED = {
  gridSize: [16, 20, 40],
  initialBpm: [72, 120, 144], finalBpm: [120, 200, 240], bpmScale: [0.6, 1, 1.2],
  growth: [0.5, 1, 2], maxLength: [128, 200, 800],
  ghostTime: [36, 24, 12], ghostHalves: [GHOST, GHOST, GHOST],
  wallTrigger: [16, 16, 16], wallSize: [2, 3, 6], wallCount: [2, 4, 8],
  bombTrigger: [32, 32, 32], bombRate: [4, 4, 1], bombCount: [1, 1, 2], bombMax: [6, 12, 20],
  wallSpawnTrigger: [48, 48, 48], wallSpawnSize: [1, 2, 4], wallSpawnRate: [2, 1, 1],
  wallSpawnCount: [1, 1, 2], wallSpawnMax: [40, 80, 200],
  enemyTrigger: [64, 64, 64], enemySize: [2, 3, 6], enemyRate: [5, 5, 5], enemyMax: [1, 1, 4],
  movingWallTrigger: [80, 80, 80], invisibleTrigger: [100, 100, 100], invisibleTiming: [20, 16, 8],
  invisibleHalves: [INVIS, INVIS, INVIS],
  hatTrigger: [8, 8, 8], melodyTrigger: [16, 16, 16], snareTrigger: [24, 24, 24],
  fastHatTrigger: [32, 32, 32], arpTrigger: [40, 40, 40], bassPulseTrigger: [48, 48, 48],
  harmonyTrigger: [56, 56, 56], counterTrigger: [64, 64, 64], fillTrigger: [72, 72, 72],
};

const RANGES = {
  gridSize: [10, 50, 1],
  initialBpm: [20, 400, 1], finalBpm: [20, 400, 1], bpmScale: [0.1, 20, 0.1],
  growth: [0, 4, 0.1], maxLength: [3, 1000, 1],
  ghostTime: [0, 40, 1], ghostHalves: [1, 1000, 1],
  wallTrigger: [1, 1000, 1], wallSize: [1, 10, 1], wallCount: [1, 20, 1],
  bombTrigger: [1, 1000, 1], bombRate: [1, 10, 1], bombCount: [1, 5, 1], bombMax: [1, 25, 1],
  wallSpawnTrigger: [1, 1000, 1], wallSpawnSize: [1, 10, 1], wallSpawnRate: [1, 10, 1],
  wallSpawnCount: [1, 5, 1], wallSpawnMax: [10, 250, 1],
  enemyTrigger: [1, 1000, 1], enemySize: [1, 10, 1], enemyRate: [1, 10, 1], enemyMax: [1, 5, 1],
  movingWallTrigger: [1, 1000, 1], invisibleTrigger: [1, 1000, 1], invisibleTiming: [1, 40, 1],
  invisibleHalves: [1, 1000, 1],
  hatTrigger: [0, 1000, 1], melodyTrigger: [0, 1000, 1], snareTrigger: [0, 1000, 1],
  fastHatTrigger: [0, 1000, 1], arpTrigger: [0, 1000, 1], bassPulseTrigger: [0, 1000, 1],
  harmonyTrigger: [0, 1000, 1], counterTrigger: [0, 1000, 1], fillTrigger: [0, 1000, 1],
};

const GROUPS = [
  ['Board', ['gridSize']], ['BPM', ['initialBpm', 'finalBpm', 'bpmScale']],
  ['Growth', ['growth', 'maxLength']], ['Ghost', ['ghostTime', 'ghostHalves']],
  ['Walls', ['wallTrigger', 'wallSize', 'wallCount']],
  ['Bombs', ['bombTrigger', 'bombRate', 'bombCount', 'bombMax']],
  ['Spawning walls', ['wallSpawnTrigger', 'wallSpawnSize', 'wallSpawnRate', 'wallSpawnCount', 'wallSpawnMax']],
  ['Enemies', ['enemyTrigger', 'enemySize', 'enemyRate', 'enemyMax']],
  ['Effects', ['movingWallTrigger', 'invisibleTrigger', 'invisibleTiming', 'invisibleHalves']],
  ['Music', ['hatTrigger', 'melodyTrigger', 'snareTrigger', 'fastHatTrigger', 'arpTrigger', 'bassPulseTrigger', 'harmonyTrigger', 'counterTrigger', 'fillTrigger']],
];

describe('field table', () => {
  it('has the 37 fields in spec order: 35 numeric and 2 list', () => {
    expect(FIELDS).toHaveLength(37);
    expect(FIELDS.map((f) => f.key)).toEqual(Object.keys(EXPECTED));
    expect(FIELDS.filter((f) => f.type === 'list').map((f) => f.key)).toEqual(['ghostHalves', 'invisibleHalves']);
    expect(FIELDS.filter((f) => f.type !== 'list')).toHaveLength(35);
  });
  it('has every range and step from the spec', () => {
    expect(Object.fromEntries(FIELDS.map((f) => [f.key, [f.min, f.max, f.step]]))).toEqual(RANGES);
  });
  it('groups fields under the spec headings', () => {
    const groups = [];
    for (const f of FIELDS) {
      if (groups.at(-1)?.[0] !== f.group) groups.push([f.group, []]);
      groups.at(-1)[1].push(f.key);
    }
    expect(groups).toEqual(GROUPS);
  });
  it('labels the new fields', () => {
    expect(field('initialBpm').label).toBe('Initial BPM');
    expect(field('finalBpm').label).toBe('Final BPM');
    expect(field('bpmScale').label).toBe('BPM Scale');
    expect(field('maxLength').label).toBe('Max Snake Size');
    expect(field('ghostHalves').label).toBe('Ghost Time Half Trigger');
    expect(field('invisibleHalves').label).toBe('Invisible Hazard Half Trigger');
  });
  it('allows at most 10 entries in a list field', () => {
    expect(field('ghostHalves').maxItems).toBe(10);
    expect(field('invisibleHalves').maxItems).toBe(10);
  });
});

describe('presets', () => {
  it.each([['easy', 0], ['medium', 1], ['hard', 2]])('%s matches the table exactly', (name, i) => {
    const expected = Object.fromEntries(Object.entries(EXPECTED).map(([k, v]) => [k, v[i]]));
    expect(PRESETS[name]).toEqual(expected);
  });
  it('keeps every preset value inside its own range and step', () => {
    for (const preset of Object.values(PRESETS)) {
      FIELDS.forEach((f) => expect(clampField(f, preset[f.key])).toEqual(preset[f.key]));
    }
  });
  it('freezes the presets and their lists', () => {
    expect(Object.isFrozen(PRESETS.hard)).toBe(true);
    for (const preset of Object.values(PRESETS)) {
      expect(Object.isFrozen(preset.ghostHalves)).toBe(true);
      expect(Object.isFrozen(preset.invisibleHalves)).toBe(true);
    }
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
    expect(clampField(field('bpmScale'), 0.34)).toBe(0.3);
    expect(clampField(field('growth'), 0.3)).toBe(0.3);
    expect(clampField(field('bpmScale'), 20.04)).toBe(20);
    expect(clampField(field('gridSize'), 20.6)).toBe(21);
  });
  it('accepts numeric strings', () => {
    expect(clampField(field('ghostTime'), '17')).toBe(17);
    expect(clampField(field('bpmScale'), ' 0.7 ')).toBe(0.7);
  });
  it('rejects things that are not finite numbers', () => {
    for (const bad of ['', '   ', 'abc', NaN, Infinity, -Infinity, null, undefined, {}, [], true]) {
      expect(clampField(field('gridSize'), bad)).toBeUndefined();
    }
  });
});

describe('clampField for list fields', () => {
  const list = field('ghostHalves');
  it('accepts an array of numbers or comma text, trimmed and rounded', () => {
    expect(clampField(list, [60, 120.4, 180.6])).toEqual([60, 120, 181]);
    expect(clampField(list, ' 60 , 120,180 ')).toEqual([60, 120, 180]);
  });
  it('preserves order and duplicates', () => {
    expect(clampField(list, '240, 60, 60, 120')).toEqual([240, 60, 60, 120]);
  });
  it('drops junk and empty entries', () => {
    expect(clampField(list, '60, abc, , 120,,x1, Infinity')).toEqual([60, 120]);
    expect(clampField(list, [60, 'x', NaN, null, 120])).toEqual([60, 120]);
  });
  it('clamps each entry to 1-1000', () => {
    expect(clampField(list, '0, 5000, -3')).toEqual([1, 1000, 1]);
  });
  it('keeps only the first 10 entries', () => {
    expect(clampField(list, '1,2,3,4,5,6,7,8,9,10,11,12')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
  it('returns undefined when no valid entry remains, so the previous list is kept', () => {
    for (const bad of ['', '  ', 'abc, ,', [], ['x'], null, undefined, {}, true]) {
      expect(clampField(list, bad)).toBeUndefined();
    }
  });
  it('returns a new array', () => {
    const input = [60, 120];
    const out = clampField(list, input);
    expect(out).not.toBe(input);
    expect(out).toEqual(input);
  });
  it('formats a list for the menu', () => {
    expect(formatList([60, 120, 180])).toBe('60, 120, 180');
  });
});

describe('music trigger fields', () => {
  const triggers = FIELDS.filter((f) => f.group === 'Music');
  it('accept 0 and 1000, clamp 1001 down and -5 up', () => {
    for (const f of triggers) {
      expect(clampField(f, 0)).toBe(0);
      expect(clampField(f, 1000)).toBe(1000);
      expect(clampField(f, 1001)).toBe(1000);
      expect(clampField(f, -5)).toBe(0);
    }
  });
  it('fill from medium when an old save lacks them', () => {
    const s = sanitize({ gridSize: 30 });
    for (const f of triggers) expect(s[f.key]).toBe(PRESETS.medium[f.key]);
  });
  it('keep 0 rather than falling back to the default', () => {
    expect(sanitize({ fillTrigger: 0 }).fillTrigger).toBe(0);
  });
});

describe('sanitize and settingsFor', () => {
  it('fills missing and corrupt fields from the fallback, field by field', () => {
    const s = sanitize({ gridSize: 30, bpmScale: 'fast', growth: 99, bogus: 1 });
    expect(s.gridSize).toBe(30);
    expect(s.bpmScale).toBe(PRESETS.medium.bpmScale);
    expect(s.growth).toBe(4);
    expect(s).not.toHaveProperty('bogus');
    expect(Object.keys(s)).toEqual(FIELDS.map((f) => f.key));
  });
  it('fills bad list fields from the fallback and ignores the old speed key', () => {
    const s = sanitize({ speed: 1.7, ghostHalves: 'junk', invisibleHalves: '300, 100' });
    expect(s).not.toHaveProperty('speed');
    expect(s.ghostHalves).toEqual([60, 120, 180, 240]);
    expect(s.invisibleHalves).toEqual([300, 100]);
  });
  it('copies lists instead of sharing them with the fallback or the input', () => {
    const empty = sanitize({});
    expect(empty.ghostHalves).toEqual(PRESETS.medium.ghostHalves);
    expect(empty.ghostHalves).not.toBe(PRESETS.medium.ghostHalves);
    expect(Object.isFrozen(empty.ghostHalves)).toBe(false);
    const input = { ghostHalves: [5, 6] };
    expect(sanitize(input).ghostHalves).not.toBe(input.ghostHalves);
  });
  it('treats non-objects as empty', () => {
    for (const bad of [null, undefined, 'x', 7, [1, 2, 3]]) expect(sanitize(bad)).toEqual(PRESETS.medium);
  });
  it('returns the preset for easy/medium/hard and a sanitized object for custom', () => {
    expect(settingsFor('easy')).toBe(PRESETS.easy);
    for (const name of ['constructor', 'toString', '__proto__']) expect(settingsFor(name)).toBe(PRESETS.medium);
    expect(settingsFor('hard')).toBe(PRESETS.hard);
    expect(settingsFor('custom', { gridSize: 12 }).gridSize).toBe(12);
    expect(settingsFor('custom', { gridSize: 12 }).bpmScale).toBe(1);
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
  it('edits lists and keeps the previous list on invalid text', () => {
    const draft = { ...PRESETS.medium };
    expect(applyEdit(draft, field('ghostHalves'), '10, 5000, x').ghostHalves).toEqual([10, 1000]);
    expect(applyEdit(draft, field('ghostHalves'), 'nope').ghostHalves).toBe(draft.ghostHalves);
    expect(applyEdit(draft, field('ghostHalves'), '').ghostHalves).toBe(draft.ghostHalves);
  });
  it('keeps the old value when the input is not a number', () => {
    const draft = { ...PRESETS.medium };
    expect(applyEdit(draft, field('gridSize'), 'abc').gridSize).toBe(20);
  });
  it('describes ranges for labels', () => {
    expect(describeRange(field('gridSize'))).toBe('10–50');
    expect(describeRange(field('bpmScale'))).toBe('0.1–20, step 0.1');
    expect(describeRange(field('ghostHalves'))).toBe('1–1000 each, comma separated');
  });
});
