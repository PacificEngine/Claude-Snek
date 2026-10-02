const BASE_BPM = 120;
const BPM_PER_RISE = 4;
const APPLES_PER_RISE = 4;
const MAX_BPM = 200;
const APPLES_PER_TIER = 8;
const MAX_TIER = 10;
const STEPS_PER_BEAT = 4; // one step per sixteenth note

// `apples` is apples eaten (the score); `speed` is the Game Speed Modifier setting.
export const bpm = (apples, speed = 1) =>
  Math.min(MAX_BPM, BASE_BPM + Math.floor(Math.max(0, apples) / APPLES_PER_RISE) * BPM_PER_RISE) * speed;

export const musicTier = (apples) =>
  Math.min(MAX_TIER, Math.floor(Math.max(0, apples) / APPLES_PER_TIER));

export const stepSeconds = (beatsPerMinute) => 60 / beatsPerMinute / STEPS_PER_BEAT;
