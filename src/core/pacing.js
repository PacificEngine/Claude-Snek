import { SLOT_KEYS } from './track.js';
import { PRESETS, DEFAULT_MUSIC, withMusic } from './difficulty.js';

const STEPS_PER_BEAT = 4; // one step per sixteenth note

// Tempo after `apples` apples: starts at initialBpm, moves bpmScale per apple toward finalBpm and stops there.
export const bpm = (apples, { initialBpm, finalBpm, bpmScale } = PRESETS.medium) => {
  const moved = bpmScale * Math.max(0, apples);
  const value = finalBpm >= initialBpm ? Math.min(finalBpm, initialBpm + moved) : Math.max(finalBpm, initialBpm - moved);
  return Math.round(value * 10000) / 10000;
};

// Each music slot is active once the apples eaten reach its own trigger (0 means from the start).
export const activeLayers = (apples, settings = withMusic(PRESETS.medium, DEFAULT_MUSIC)) =>
  Object.fromEntries(SLOT_KEYS.map((key) => [key, apples >= settings[key]]));

export const stepSeconds = (beatsPerMinute) => 60 / beatsPerMinute / STEPS_PER_BEAT;

// How long one step may spend placing obstacles (see `tick`): half the step, so the beat keeps time, and at least 2 ms.
export const placementBudgetMs = (beatsPerMinute) => Math.max(2, stepSeconds(beatsPerMinute) * 1000 * 0.5);
