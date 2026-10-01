import { START_LENGTH } from './config.js';

const BASE_BPM = 120;
const BPM_PER_RISE = 4;
const APPLES_PER_RISE = 4;
const MAX_BPM = 200;
const APPLES_PER_TIER = 8;
const MAX_TIER = 10;
const STEPS_PER_BEAT = 4; // one step per sixteenth note

const applesEaten = (length) => Math.max(0, length - START_LENGTH);

export const bpm = (length) =>
  Math.min(MAX_BPM, BASE_BPM + Math.floor(applesEaten(length) / APPLES_PER_RISE) * BPM_PER_RISE);

export const musicTier = (length) =>
  Math.min(MAX_TIER, Math.floor(applesEaten(length) / APPLES_PER_TIER));

export const stepSeconds = (beatsPerMinute) => 60 / beatsPerMinute / STEPS_PER_BEAT;
