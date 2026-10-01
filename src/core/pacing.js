import { START_LENGTH } from './config.js';

const BASE_TICKS_PER_SEC = 8;
const TICKS_PER_FOOD = 0.5;
const MAX_TICKS_PER_SEC = 20;
const BASE_BPM = 100;
const BPM_PER_FOOD = 4;
const MAX_BPM = 200;

const foodEaten = (length) => Math.max(0, length - START_LENGTH);

export const ticksPerSecond = (length) =>
  Math.min(MAX_TICKS_PER_SEC, BASE_TICKS_PER_SEC + foodEaten(length) * TICKS_PER_FOOD);

export const bpm = (length) =>
  Math.min(MAX_BPM, BASE_BPM + foodEaten(length) * BPM_PER_FOOD);
