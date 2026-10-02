import { PRESETS, DEFAULT_MUSIC, withMusic } from './difficulty.js';

const STEPS_PER_BEAT = 4; // one step per sixteenth note

// Tempo after `apples` apples: starts at initialBpm, moves bpmScale per apple toward finalBpm and stops there.
export const bpm = (apples, { initialBpm, finalBpm, bpmScale } = PRESETS.medium) => {
  const moved = bpmScale * Math.max(0, apples);
  const value = finalBpm >= initialBpm ? Math.min(finalBpm, initialBpm + moved) : Math.max(finalBpm, initialBpm - moved);
  return Math.round(value * 10000) / 10000;
};

// Which setting holds the apple count at which each music layer enters.
const LAYER_TRIGGERS = {
  kick: 'kickTrigger',
  bass: 'bassTrigger',
  hat: 'hatTrigger',
  melody: 'melodyTrigger',
  snare: 'snareTrigger',
  sixteenthHat: 'fastHatTrigger',
  arp: 'arpTrigger',
  bassPulse: 'bassPulseTrigger',
  harmony: 'harmonyTrigger',
  counter: 'counterTrigger',
  fill: 'fillTrigger',
};

// Each music layer is active once the apples eaten reach its own trigger (0 means from the start).
export const activeLayers = (apples, settings = withMusic(PRESETS.medium, DEFAULT_MUSIC)) =>
  Object.fromEntries(Object.entries(LAYER_TRIGGERS).map(([layer, key]) => [layer, apples >= settings[key]]));

export const stepSeconds = (beatsPerMinute) => 60 / beatsPerMinute / STEPS_PER_BEAT;

// How long one step may spend placing obstacles (see `tick`): half the step, so the beat keeps time, and at least 2 ms.
export const placementBudgetMs = (beatsPerMinute) => Math.max(2, stepSeconds(beatsPerMinute) * 1000 * 0.5);
