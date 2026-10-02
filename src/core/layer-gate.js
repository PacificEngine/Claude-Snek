import { STEPS_PER_BAR, layersForTier } from './track.js';

// Holds the active layers until the next bar line so a layer always enters on a downbeat.
export function createLayerGate(getLayers) {
  let held = layersForTier(0);
  return {
    layersFor(step) {
      if (step % STEPS_PER_BAR === 0) held = getLayers();
      return held;
    },
  };
}
