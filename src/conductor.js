import { stepSeconds } from './core/pacing.js';

const LOOKAHEAD_SECONDS = 0.1;
const PUMP_MS = 25;

export function createConductor({ now, getBpm, onStep }) {
  let step = 0;
  let nextTime = 0;
  let timer = null;

  function pump() {
    // A throttled background tab lets nextTime fall behind; skip missed steps.
    nextTime = Math.max(nextTime, now());
    while (nextTime < now() + LOOKAHEAD_SECONDS) {
      const dt = stepSeconds(getBpm());
      onStep(step, nextTime, dt);
      step += 1;
      nextTime += dt;
    }
  }

  function resume() {
    if (timer !== null) return;
    nextTime = now();
    pump();
    timer = setInterval(pump, PUMP_MS);
  }

  function pause() {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  }

  return {
    start() {
      pause();
      step = 0;
      resume();
    },
    pause,
    resume,
    isRunning: () => timer !== null,
  };
}
