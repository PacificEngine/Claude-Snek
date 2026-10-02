import { describe, it, expect } from 'vitest';
import { PRESETS } from '../src/core/difficulty.js';
import { spawnRun, botRun, early, PRESET_NAMES, LEGACY_SPAWN, LEGACY_BOT } from './placement-helpers.js';

describe('legacy placement fixtures (no budget)', () => {
  it.each(PRESET_NAMES)('100 apples of %s spawn exactly as before', (name) => {
    expect(spawnRun(PRESETS[name], 11)).toEqual(LEGACY_SPAWN[name]);
  }, 60000);
  it.each(PRESET_NAMES)('a seeded bot game on %s (early triggers) plays exactly as before', (name) => {
    expect(botRun(early(PRESETS[name]), 5)).toEqual(LEGACY_BOT[name]);
  }, 60000);
});


