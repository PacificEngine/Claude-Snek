import { describe, it, expect } from 'vitest';
import { FIELDS, MUSIC_FIELDS, randomMusic, randomSettings, sanitize } from '../src/core/difficulty.js';

const seeded = (seed) => {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);
const rolls = SEEDS.map((seed) => randomSettings(seeded(seed)));
const triggers = FIELDS.filter((f) => f.key.endsWith('Trigger'));
const HALF_CAPS = [200, 400, 600, 800];

describe('randomSettings', () => {
  it('returns exactly the 28 difficulty fields and no music triggers, each valid (sanitize leaves them unchanged)', () => {
    rolls.forEach((r) => {
      expect(Object.keys(r).sort()).toEqual(FIELDS.map((f) => f.key).sort());
      expect(FIELDS).toHaveLength(28);
      MUSIC_FIELDS.forEach((f) => expect(r).not.toHaveProperty(f.key));
      expect(sanitize(r)).toEqual(r);
    });
  });
  it('rolls Initial and Final BPM as whole numbers from 60 to 260', () => {
    rolls.forEach((r) => ['initialBpm', 'finalBpm'].forEach((key) => {
      expect(Number.isInteger(r[key])).toBe(true);
      expect(r[key]).toBeGreaterThanOrEqual(60);
      expect(r[key]).toBeLessThanOrEqual(260);
    }));
    ['initialBpm', 'finalBpm'].forEach((key) => {
      expect(randomSettings(() => 0)[key]).toBe(60);
      expect(randomSettings(() => 0.999999)[key]).toBe(260);
    });
  });
  it('is deterministic for a seed and varies across seeds', () => {
    expect(randomSettings(seeded(7))).toEqual(randomSettings(seeded(7)));
    expect(JSON.stringify(randomSettings(seeded(7)))).not.toBe(JSON.stringify(randomSettings(seeded(8))));
  });
  it('returns fresh arrays for the lists', () => {
    const a = randomSettings(seeded(1));
    const b = randomSettings(seeded(1));
    a.ghostHalves.push(5);
    expect(b.ghostHalves).toHaveLength(4);
    expect(a.ghostHalves).not.toBe(a.invisibleHalves);
  });
  it('keeps every trigger below 100', () => {
    expect(triggers).toHaveLength(6);
    rolls.forEach((r) => triggers.forEach((f) => {
      expect(r[f.key]).toBeGreaterThanOrEqual(f.min);
      expect(r[f.key]).toBeLessThanOrEqual(99);
    }));
  });
  it('gives each half-trigger list four values within its per-position cap', () => {
    rolls.forEach((r) => ['ghostHalves', 'invisibleHalves'].forEach((key) => {
      expect(r[key]).toHaveLength(4);
      r[key].forEach((v, i) => {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(HALF_CAPS[i]);
      });
    }));
  });
  it('caps maxLength at half the cells, wallSpawnMax at 20%, bombMax and enemyMax at 10%', () => {
    rolls.forEach((r) => {
      const cells = r.gridSize ** 2;
      expect(r.maxLength).toBeGreaterThanOrEqual(3);
      expect(r.maxLength).toBeLessThanOrEqual(Math.min(1000, Math.max(3, Math.floor(0.5 * cells))));
      expect(r.wallSpawnMax).toBeGreaterThanOrEqual(10);
      expect(r.wallSpawnMax).toBeLessThanOrEqual(Math.min(1000, Math.max(10, Math.floor(0.2 * cells))));
      expect(r.bombMax).toBeGreaterThanOrEqual(1);
      expect(r.bombMax).toBeLessThanOrEqual(Math.min(50, Math.max(1, Math.floor(0.1 * cells))));
      expect(r.enemyMax).toBeGreaterThanOrEqual(1);
      expect(r.enemyMax).toBeLessThanOrEqual(Math.min(10, Math.max(1, Math.floor(0.1 * cells))));
    });
  });
  it('uses the caps on a 10x10 board', () => {
    const small = rolls.filter((r) => r.gridSize === 10);
    expect(small.length).toBeGreaterThan(0);
    small.forEach((r) => {
      expect(r.maxLength).toBeLessThanOrEqual(50);
      expect(r.wallSpawnMax).toBeLessThanOrEqual(20);
      expect(r.wallSpawnMax).toBeGreaterThanOrEqual(10);
      expect(r.bombMax).toBeLessThanOrEqual(10);
      expect(r.enemyMax).toBeLessThanOrEqual(10);
    });
  });
  it('uses the caps on a 50x50 board (cells 2500)', () => {
    const big = rolls.filter((r) => r.gridSize === 50);
    expect(big.length).toBeGreaterThan(0);
    big.forEach((r) => {
      expect(r.maxLength).toBeLessThanOrEqual(1000);
      expect(r.wallSpawnMax).toBeLessThanOrEqual(500);
      expect(r.bombMax).toBeLessThanOrEqual(50);
      expect(r.enemyMax).toBeLessThanOrEqual(10);
    });
  });
  it('reaches the extremes of the capped ranges', () => {
    const lo = randomSettings(() => 0);
    const hi = randomSettings(() => 0.999999);
    expect(lo).toMatchObject({ gridSize: 10, maxLength: 3, wallSpawnMax: 10, bombMax: 1, enemyMax: 1, wallTrigger: 1, bpmScale: 0.1, growth: 0 });
    expect(hi).toMatchObject({ gridSize: 50, maxLength: 1000, wallSpawnMax: 500, bombMax: 50, enemyMax: 10, wallTrigger: 99, bpmScale: 20, growth: 4, initialBpm: 260, finalBpm: 260 });
    expect(hi.ghostHalves).toEqual([200, 400, 600, 800]);
    expect(lo.ghostHalves).toEqual([1, 1, 1, 1]);
  });
  it('spreads other fields uniformly over their whole range', () => {
    const seen = (key) => new Set(rolls.map((r) => r[key]));
    expect(Math.min(...seen('gridSize'))).toBe(10);
    expect(Math.max(...seen('gridSize'))).toBe(50);
    expect(seen('growth').size).toBeGreaterThan(20);
  });
  it('does not use Math.random', () => {
    const real = Math.random;
    Math.random = () => { throw new Error('Math.random used'); };
    try { randomSettings(seeded(3)); } finally { Math.random = real; }
  });
});

describe('randomMusic', () => {
  const musics = SEEDS.map((seed) => randomMusic(seeded(seed)));
  it('returns exactly the eleven music keys', () => {
    musics.forEach((m) => expect(Object.keys(m).sort()).toEqual(MUSIC_FIELDS.map((f) => f.key).sort()));
  });
  it('forms the ramp: whole numbers 0..100, sorted v[0] = 0 and v[k] <= 10k', () => {
    musics.forEach((m) => {
      const sorted = Object.values(m).sort((x, y) => x - y);
      sorted.forEach((v, k) => {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeLessThanOrEqual(10 * k);
      });
      expect(sorted[0]).toBe(0);
    });
  });
  it('is deterministic for a seed and shuffles which instrument is early', () => {
    expect(randomMusic(seeded(5))).toEqual(randomMusic(seeded(5)));
    expect(new Set(musics.map((m) => m.t4)).size).toBeGreaterThan(20);
    expect(new Set(musics.map((m) => JSON.stringify(m))).size).toBeGreaterThan(250);
  });
});
