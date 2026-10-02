import { PRESETS } from './difficulty.js';

const APPLES_PER_TIER = 8;
const MAX_TIER = 10;
const STEPS_PER_BEAT = 4; // one step per sixteenth note

// Tempo after `apples` apples: starts at initialBpm, moves bpmScale per apple toward finalBpm and stops there.
export const bpm = (apples, { initialBpm, finalBpm, bpmScale } = PRESETS.medium) => {
  const moved = bpmScale * Math.max(0, apples);
  const value = finalBpm >= initialBpm ? Math.min(finalBpm, initialBpm + moved) : Math.max(finalBpm, initialBpm - moved);
  return Math.round(value * 10000) / 10000;
};

export const musicTier = (apples) =>
  Math.min(MAX_TIER, Math.floor(Math.max(0, apples) / APPLES_PER_TIER));

export const stepSeconds = (beatsPerMinute) => 60 / beatsPerMinute / STEPS_PER_BEAT;
