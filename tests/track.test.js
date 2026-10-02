import { describe, it, expect } from 'vitest';
import { eventsAt as eventsFor, layersForTier, LAYERS, TOTAL_STEPS, STEPS_PER_BAR } from '../src/core/track.js';

// The tier-based assertions below call eventsAt(step, tier); a tier switches on the layers up to it.
const eventsAt = (step, tier) => eventsFor(step, layersForTier(tier));
const only = (...names) => Object.fromEntries(LAYERS.map((n) => [n, names.includes(n)]));

const stepsAt = (tier) => Array.from({ length: TOTAL_STEPS }, (_, i) => eventsAt(i, tier));
const melodyFrom = (tier, start, count) =>
  stepsAt(tier).slice(start, start + count).map((e) => e.melody);
// A step's index within its bar.
const inBar = (i) => i % STEPS_PER_BAR;

describe('track shape', () => {
  it('is 32 bars of sixteenth-note steps', () => {
    expect(STEPS_PER_BAR).toBe(16);
    expect(TOTAL_STEPS).toBe(512);
  });
  it('wraps around after 32 bars at any tier', () => {
    for (const tier of [0, 5, 10]) {
      expect(eventsAt(TOTAL_STEPS, tier)).toEqual(eventsAt(0, tier));
      expect(eventsAt(TOTAL_STEPS + 37, tier)).toEqual(eventsAt(37, tier));
    }
  });
  it('treats tiers above 10 like tier 10', () => {
    expect(eventsAt(70, 99)).toEqual(eventsAt(70, 10));
  });
});

describe('tier 0: bass and kick only', () => {
  const all = stepsAt(0);
  it('kicks exactly on quarter notes', () => {
    all.forEach((e, i) => expect(e.kick).toBe(i % 4 === 0));
  });
  it('plays the bass only on quarter notes: A root, then F in bar 2', () => {
    all.forEach((e, i) => expect(e.bass !== null).toBe(i % 4 === 0));
    expect(eventsAt(0, 0).bass).toBe(45);
    expect(eventsAt(16, 0).bass).toBe(41);
  });
  it('has no other layer', () => {
    all.forEach((e) => {
      expect(e.hat).toBe(false);
      expect(e.snare).toBe(false);
      expect([e.melody, e.harmony, e.counter, e.arp]).toEqual([null, null, null, null]);
    });
  });
});

describe('tier 1: hi-hat on eighths', () => {
  it('plays the hi-hat exactly on eighth notes and still no melody', () => {
    stepsAt(1).forEach((e, i) => {
      expect(e.hat).toBe(i % 2 === 0);
      expect(e.melody).toBeNull();
    });
  });
});

describe('tier 2: melody', () => {
  it('is silent through the 4-bar intro', () => {
    expect(melodyFrom(2, 0, 64).every((m) => m === null)).toBe(true);
  });
  it('enters at bar 5 on A4', () => {
    expect(eventsAt(64, 2).melody).toBe(69);
  });
  it('plays a different melody in the chorus than in the verse', () => {
    expect(melodyFrom(2, 64, 128)).not.toEqual(melodyFrom(2, 192, 128));
  });
  it('plays the final chorus an octave above the chorus', () => {
    expect(eventsAt(384, 2).melody).toBe(eventsAt(192, 2).melody + 12);
  });
  it('keeps every note in a playable range', () => {
    stepsAt(10).forEach((e) => {
      for (const n of [e.melody, e.harmony, e.counter, e.arp, e.bass]) {
        if (n !== null) {
          expect(n).toBeGreaterThanOrEqual(36);
          expect(n).toBeLessThanOrEqual(110);
        }
      }
    });
  });
});

describe('tier 3: snare', () => {
  it('hits exactly on beats 2 and 4 (steps 4 and 12 of every bar)', () => {
    stepsAt(3).forEach((e, i) => expect(e.snare).toBe(inBar(i) === 4 || inBar(i) === 12));
  });
  it('is absent below tier 3', () => {
    expect(stepsAt(2).some((e) => e.snare)).toBe(false);
  });
});

describe('tier 4: sixteenth hi-hat', () => {
  it('plays the hi-hat on every step', () => {
    expect(stepsAt(4).every((e) => e.hat)).toBe(true);
  });
});

describe('tier 5: arpeggio', () => {
  it('plays a chord tone on every step: A minor arpeggio 57, 60, 64, 60', () => {
    expect([0, 1, 2, 3].map((i) => eventsAt(i, 5).arp)).toEqual([57, 60, 64, 60]);
    expect(stepsAt(5).every((e) => e.arp !== null)).toBe(true);
  });
  it('is absent below tier 5', () => {
    expect(stepsAt(4).some((e) => e.arp !== null)).toBe(false);
  });
});

describe('tier 6: bass pulse', () => {
  it('plays the bass on every eighth, alternating root and octave', () => {
    expect(eventsAt(0, 6).bass).toBe(45);
    expect(eventsAt(1, 6).bass).toBeNull();
    expect(eventsAt(2, 6).bass).toBe(57);
    expect(eventsAt(4, 6).bass).toBe(45);
  });
});

describe('tier 7: harmony', () => {
  it('plays a diatonic third above the melody (A -> C)', () => {
    expect(eventsAt(64, 7).melody).toBe(69);
    expect(eventsAt(64, 7).harmony).toBe(72);
  });
  it('is only present when the melody is', () => {
    stepsAt(7).forEach((e) => expect(e.harmony === null).toBe(e.melody === null));
  });
});

describe('tier 8: counter-melody', () => {
  it('plays the bar pattern shifted two eighth slots, an octave up', () => {
    // verse bar 1, Am pattern [69,0,72,0,76,72,69,0]: slot 0 takes slot 6 -> 69 + 12
    expect(eventsAt(64, 8).counter).toBe(81);
  });
  it('is absent below tier 8', () => {
    expect(stepsAt(7).some((e) => e.counter !== null)).toBe(false);
  });
});

describe('tier 9: drum fill', () => {
  it('rolls the snare on steps 12-15 of every 4th bar', () => {
    // bar index 3 spans steps 48-63
    [60, 61, 62, 63].forEach((i) => expect(eventsAt(i, 9).snare).toBe(true));
    expect(eventsAt(61, 8).snare).toBe(false);
    // not in other bars
    expect(eventsAt(13, 9).snare).toBe(false);
  });
});

describe('tier 10: everything at once', () => {
  it('has every layer on the first step of the verse', () => {
    const e = eventsAt(64, 10);
    expect(e.melody).toBe(69);
    expect(e.harmony).toBe(72);
    expect(e.counter).toBe(81);
    expect(e.arp).toBe(57);
    expect(e.bass).toBe(45);
    expect(e.kick).toBe(true);
    expect(e.hat).toBe(true);
  });
});

describe('layers only accumulate', () => {
  const layers = (e) =>
    [e.melody, e.harmony, e.counter, e.arp, e.bass].filter((n) => n !== null).length +
    [e.kick, e.snare, e.hat].filter(Boolean).length;
  it('never has fewer layers at a higher tier on any step', () => {
    for (let tier = 0; tier < 10; tier++) {
      const lower = stepsAt(tier);
      const higher = stepsAt(tier + 1);
      lower.forEach((e, i) => expect(layers(higher[i])).toBeGreaterThanOrEqual(layers(e)));
    }
  });
  it('lists the layers in the order they enter by default', () => {
    expect(LAYERS).toEqual(['kick', 'bass', 'hat', 'melody', 'snare', 'sixteenthHat', 'arp', 'bassPulse', 'harmony', 'counter', 'fill']);
  });
  it('switches on the first n layers after kick and bass for tier n, kick and bass always on', () => {
    expect(layersForTier(0)).toEqual(only('kick', 'bass'));
    expect(layersForTier(2)).toEqual(only('kick', 'bass', 'hat', 'melody'));
    expect(layersForTier(10)).toEqual(only(...LAYERS));
  });
});

describe('independent layers', () => {
  const steps = (active) => Array.from({ length: TOTAL_STEPS }, (_, i) => eventsFor(i, active));
  it('plays the harmony a third above the melody line while the melody layer is off', () => {
    const e = eventsFor(64, only('harmony'));
    expect(e.melody).toBeNull();
    expect(e.harmony).toBe(72);
  });
  it('plays the counter-melody without the melody layer', () => {
    expect(eventsFor(64, only('counter')).counter).toBe(81);
    expect(eventsFor(64, only('counter')).melody).toBeNull();
  });
  it('rolls the drum fill without the snare layer, and no backbeat', () => {
    [60, 61, 62, 63].forEach((i) => expect(eventsFor(i, only('fill')).snare).toBe(true));
    expect(eventsFor(4, only('fill')).snare).toBe(false);
    expect(steps(only('fill')).filter((e) => e.snare)).toHaveLength(8 * 4);
  });
  it('keeps the backbeat when only the snare layer is on', () => {
    expect(eventsFor(4, only('snare')).snare).toBe(true);
    expect(eventsFor(61, only('snare')).snare).toBe(false);
  });
  it('plays the sixteenth hi-hat without the eighth hi-hat layer', () => {
    steps(only('sixteenthHat')).forEach((e) => expect(e.hat).toBe(true));
  });
  it('plays the eighth hi-hat only when the fast one is off', () => {
    steps(only('hat')).forEach((e, i) => expect(e.hat).toBe(i % 2 === 0));
  });
  it('plays no hi-hat with neither hi-hat layer', () => {
    expect(steps(only('melody')).some((e) => e.hat)).toBe(false);
  });
  it('pulses the bass on eighths with the bassPulse layer alone, on quarters otherwise', () => {
    expect(eventsFor(2, only('bass', 'bassPulse')).bass).toBe(57);
    expect(eventsFor(2, only('bass')).bass).toBeNull();
    expect(eventsFor(4, only('bass')).bass).toBe(45);
  });
  it('plays the kick only when the kick layer is on', () => {
    expect(steps(only('bass')).some((e) => e.kick)).toBe(false);
    steps(only('kick')).forEach((e, i) => expect(e.kick).toBe(i % 4 === 0));
  });
  it('plays no bass until the bass layer is on', () => {
    expect(steps(only('kick')).some((e) => e.bass !== null)).toBe(false);
  });
  it('does not sound the bass pulse without the bass layer', () => {
    expect(steps(only('bassPulse')).some((e) => e.bass !== null)).toBe(false);
  });
});
