import { STEPS_PER_BAR } from './track.js';

export function createTierGate(getTier) {
  let held = 0;
  return {
    tierFor(step) {
      if (step % STEPS_PER_BAR === 0) held = getTier();
      return held;
    },
  };
}
