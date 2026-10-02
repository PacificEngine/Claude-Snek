import { STEPS_PER_BAR, LAYERS } from './track.js';

// Holds the active layers until the next bar line so a layer always enters on a downbeat.
export function createLayerGate(getLayers) {
  // Nothing is held before the first bar line; step 0 is one, so a trigger of 0 plays from the start.
  let held = Object.fromEntries(LAYERS.map((name) => [name, false]));
  return {
    layersFor(step) {
      if (step % STEPS_PER_BAR === 0) held = getLayers();
      return held;
    },
  };
}
