# Apple-Driven Tempo and Music Tiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise tempo/speed once per 4 apples (120 → 200 BPM at apple 80) and layer in more music as apples are eaten, in 10 tiers (one per 8 apples), so apple 80 plays a very complex loop.

**Architecture:** `pacing.js` derives BPM and a music tier from apples eaten (snake length − 3). `eventsAt(step, tier)` gates each musical layer by tier. A small tier gate holds the tier until the next bar line so new layers enter on a downbeat. The synth voices the extra layers (snare, arpeggio, harmony, counter-melody, bass pulse, fills). `main.js` passes the gated tier into `synth.playStep`.

**Tech Stack:** Vanilla JavaScript (ES modules, no build step), Web Audio, Vitest (dev-only, via yarn).

**Spec:** `docs/specs/snake-game/snake-game.md` (Core Requirements: pacing and tier list; Data Model "Derived"; Decisions)

## Global Constraints

- Vanilla JavaScript with ES modules, no build step, zero runtime dependencies; use `yarn` only (never npm, pnpm or bun).
- Apples eaten = snake length − 3 (`START_LENGTH`).
- BPM = `min(200, 120 + 4 × floor(apples ÷ 4))`; reaches 200 at apple 80. One snake step is still one sixteenth note (`60 / BPM / 4` s).
- Music tier = `min(10, floor(apples ÷ 8))`. Layers by the tier at which they enter: 0 bass + kick only; 1 hi-hat on eighths; 2 melody (sections apply; the intro stays melody-free); 3 snare on beats 2 and 4 (steps 4 and 12 of a bar); 4 hi-hat on every sixteenth; 5 chord arpeggio; 6 bass becomes an eighth-note pulse; 7 harmony a diatonic third above the melody; 8 counter-melody an octave up, offset two eighth slots; 9 drum fill (snare on steps 12–15) in every 4th bar; 10 everything.
- A tier change takes effect at the next bar line (step % 16 == 0). Restart resets to tier 0 and 0 apples.
- The 32-bar structure (intro 4, verse 8, chorus 8, bridge 4, final chorus 8; 512 steps) is unchanged.
- No audio files; all sound synthesized. No network requests. No `innerHTML` or `eval`.
- Mute must not change speed or the beat grid. Pause/game over stop the music. Silent fallback on `performance.now()` when Web Audio is missing.
- Work on branch `feature/rhythm-music`; commit after each red-green cycle; commit messages explain why; no Claude signature; squash into one commit before finishing.

---

### Task 1: Pacing — tempo per 4 apples and the music tier

**Files:**
- Modify: `src/core/pacing.js`
- Modify: `tests/pacing.test.js`

**Interfaces:**
- Produces: `bpm(length)` (stepwise: +4 per 4 apples, cap 200), `musicTier(length): number` (0–10), `stepSeconds(bpm)` (unchanged). `length` is the snake's length.

- [ ] **Step 1: Write the failing tests** — replace the whole of `tests/pacing.test.js` with:

```js
import { describe, it, expect } from 'vitest';
import { bpm, musicTier, stepSeconds } from '../src/core/pacing.js';

// length = 3 + apples eaten
describe('bpm', () => {
  it('starts at 120 for the starting length', () => {
    expect(bpm(3)).toBe(120);
  });
  it('does not rise for the first three apples', () => {
    expect(bpm(4)).toBe(120);
    expect(bpm(6)).toBe(120);
  });
  it('rises 4 on every 4th apple', () => {
    expect(bpm(7)).toBe(124);
    expect(bpm(10)).toBe(124);
    expect(bpm(11)).toBe(128);
  });
  it('reaches 200 exactly at the 80th apple', () => {
    expect(bpm(82)).toBe(196);
    expect(bpm(83)).toBe(200);
  });
  it('stays at 200 afterwards', () => {
    expect(bpm(500)).toBe(200);
  });
});

describe('musicTier', () => {
  it('is 0 for the first seven apples', () => {
    expect(musicTier(3)).toBe(0);
    expect(musicTier(10)).toBe(0);
  });
  it('rises by one for every 8 apples', () => {
    expect(musicTier(11)).toBe(1);
    expect(musicTier(18)).toBe(1);
    expect(musicTier(19)).toBe(2);
  });
  it('is 9 on apple 79 and 10 on apple 80', () => {
    expect(musicTier(82)).toBe(9);
    expect(musicTier(83)).toBe(10);
  });
  it('caps at 10', () => {
    expect(musicTier(500)).toBe(10);
  });
});

describe('stepSeconds', () => {
  it('is one sixteenth note: 0.125s at 120 BPM', () => {
    expect(stepSeconds(120)).toBeCloseTo(0.125);
  });
  it('shrinks as the tempo rises: 0.075s at 200 BPM', () => {
    expect(stepSeconds(200)).toBeCloseTo(0.075);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/pacing.test.js`
Expected: FAIL — `musicTier` is not exported; `bpm(4)`/`bpm(7)` do not match the stepwise rule.

- [ ] **Step 3: Write minimal implementation** — replace `src/core/pacing.js` with:

```js
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test`
Expected: PASS (whole suite).

- [ ] **Step 5: Commit**

```bash
git add src/core/pacing.js tests/pacing.test.js
git commit -m "feat: raise tempo once per 4 apples and derive a music tier per 8 so difficulty and sound escalate in steps"
```

---

### Task 2: Tiered track — gate every layer by tier (and thread the tier through the synth)

**Files:**
- Modify: `src/core/track.js` (full replacement below)
- Modify: `tests/track.test.js` (full replacement below)
- Modify: `src/synth.js` (`playStep` only)
- Modify: `tests/synth.test.js` (pass a tier to `playStep` calls)

**Interfaces:**
- Produces: `eventsAt(step, tier)` → `{ melody, harmony, counter, arp, bass, kick, snare, hat }` where the first five are MIDI note numbers or `null`, and `kick`, `snare`, `hat` are booleans; `TIERS` — `{ hat: 1, melody: 2, snare: 3, sixteenthHat: 4, arp: 5, bassPulse: 6, harmony: 7, counter: 8, fill: 9 }` (the tier at which each layer enters); plus the existing `STEPS_PER_BAR`, `TOTAL_STEPS`. `synth.playStep(step, time, dt, tier)` passes `tier` to `eventsAt` (new voices come in Task 4).

- [ ] **Step 1: Write the failing tests** — replace `tests/track.test.js` with:

```js
import { describe, it, expect } from 'vitest';
import { eventsAt, TOTAL_STEPS, STEPS_PER_BAR, TIERS } from '../src/core/track.js';

const stepsAt = (tier) => Array.from({ length: TOTAL_STEPS }, (_, i) => eventsAt(i, tier));
const melodyFrom = (tier, start, count) =>
  stepsAt(tier).slice(start, start + count).map((e) => e.melody);
// A bar's step index within its bar.
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
  it('exports the tier each layer enters at', () => {
    expect(TIERS).toEqual({
      hat: 1, melody: 2, snare: 3, sixteenthHat: 4, arp: 5,
      bassPulse: 6, harmony: 7, counter: 8, fill: 9,
    });
  });
});
```

Also update `tests/synth.test.js`: in the `playStep` describe and wherever `playStep` is called, pass the tier as a 4th argument — `synth.playStep(0, 1.5, 0.125, 1)` (the downbeat test), `synth.playStep(2, 0.25, 0.125, 1)` (off-eighth hat), `synth.playStep(1, 0.125, 0.125, 1)` (odd sixteenth), `synth.playStep(64, 0, 0.125, 2)` (melody enters at tier 2), and `synth.playStep(0, 0, 0.125, 0)` in the "no Web Audio" and "plays nothing before it is started" tests. Assertions stay exactly as they are.

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/track.test.js tests/synth.test.js`
Expected: FAIL — `TIERS` is not exported and `eventsAt` ignores the tier (tier 0 still has hats/melody).

- [ ] **Step 3: Write the implementation**

Replace `src/core/track.js` with:

```js
export const STEPS_PER_BAR = 16;
export const TOTAL_BARS = 32;
export const TOTAL_STEPS = STEPS_PER_BAR * TOTAL_BARS;

// The music tier at which each layer enters (tier 0 is bass + kick only).
export const TIERS = {
  hat: 1,
  melody: 2,
  snare: 3,
  sixteenthHat: 4,
  arp: 5,
  bassPulse: 6,
  harmony: 7,
  counter: 8,
  fill: 9,
};

// MIDI roots for the bass (one octave below the melody's home register).
const BASS_ROOT = { Am: 45, F: 41, C: 48, G: 43, E: 40 };
// Below the bass-pulse tier the bass plays each quarter note: root, root, octave up, root.
const BASS_OFFSETS = [0, 0, 12, 0];

// Chord tones for the arpeggio, in the register just under the melody.
const CHORD_TONES = {
  Am: [57, 60, 64],
  F: [53, 57, 60],
  C: [60, 64, 67],
  G: [55, 59, 62],
  E: [52, 56, 59],
};
const ARP_ORDER = [0, 1, 2, 1];

// A natural minor as pitch classes, ascending from A.
const A_MINOR = [9, 11, 0, 2, 4, 5, 7];

// Eight eighth-note slots per bar, as MIDI notes; 0 is a rest.
const VERSE = {
  Am: [69, 0, 72, 0, 76, 72, 69, 0],
  F: [69, 0, 72, 0, 77, 72, 69, 0],
  C: [72, 0, 76, 0, 79, 76, 72, 0],
  G: [71, 0, 74, 0, 67, 71, 74, 0],
};
const CHORUS = {
  Am: [76, 76, 79, 76, 72, 76, 69, 72],
  F: [77, 77, 81, 77, 72, 77, 69, 72],
  C: [79, 79, 76, 79, 72, 76, 79, 84],
  G: [74, 74, 79, 74, 71, 74, 67, 71],
};
const BRIDGE = {
  ...VERSE,
  E: [71, 0, 76, 0, 80, 76, 71, 0],
};

const PROGRESSION = ['Am', 'F', 'C', 'G'];

// Bars per section add up to TOTAL_BARS (4 + 8 + 8 + 4 + 8 = 32).
const SECTIONS = [
  { name: 'intro', bars: 4, chords: PROGRESSION, melody: null, transpose: 0 },
  { name: 'verse', bars: 8, chords: PROGRESSION, melody: VERSE, transpose: 0 },
  { name: 'chorus', bars: 8, chords: PROGRESSION, melody: CHORUS, transpose: 0 },
  { name: 'bridge', bars: 4, chords: ['F', 'G', 'Am', 'E'], melody: BRIDGE, transpose: 0 },
  { name: 'finale', bars: 8, chords: PROGRESSION, melody: CHORUS, transpose: 12 },
];

function locate(bar) {
  let start = 0;
  for (const section of SECTIONS) {
    if (bar < start + section.bars) return { section, barInSection: bar - start };
    start += section.bars;
  }
  throw new Error(`bar ${bar} is outside the track`);
}

// The note a diatonic third above `midi` in A minor (+3 if it is outside the scale).
function thirdAbove(midi) {
  const pc = midi % 12;
  const i = A_MINOR.indexOf(pc);
  if (i === -1) return midi + 3;
  const up = A_MINOR[(i + 2) % 7];
  return midi + ((up - pc + 12) % 12);
}

export function eventsAt(step, tier) {
  const s = ((step % TOTAL_STEPS) + TOTAL_STEPS) % TOTAL_STEPS;
  const bar = Math.floor(s / STEPS_PER_BAR);
  const inBar = s % STEPS_PER_BAR;
  const { section, barInSection } = locate(bar);
  const chord = section.chords[barInSection % section.chords.length];
  const onEighth = inBar % 2 === 0;
  const onQuarter = inBar % 4 === 0;
  const pattern = section.melody ? section.melody[chord] : null;
  const slot = inBar / 2;

  const melodyRaw = tier >= TIERS.melody && onEighth && pattern ? pattern[slot] : 0;
  const counterRaw = tier >= TIERS.counter && onEighth && pattern ? pattern[(slot + 6) % 8] : 0;
  const melody = melodyRaw ? melodyRaw + section.transpose : null;
  const counter = counterRaw ? counterRaw + section.transpose + 12 : null;
  const harmony = melody !== null && tier >= TIERS.harmony ? thirdAbove(melody) : null;
  const arp = tier >= TIERS.arp ? CHORD_TONES[chord][ARP_ORDER[inBar % 4]] : null;

  let bass = null;
  if (tier >= TIERS.bassPulse) {
    if (onEighth) bass = BASS_ROOT[chord] + (slot % 2 === 1 ? 12 : 0);
  } else if (onQuarter) {
    bass = BASS_ROOT[chord] + BASS_OFFSETS[inBar / 4];
  }

  const backbeat = inBar === 4 || inBar === 12;
  const fill = tier >= TIERS.fill && bar % 4 === 3 && inBar >= 12;
  const snare = tier >= TIERS.snare && (backbeat || fill);
  const hat = tier >= TIERS.sixteenthHat ? true : tier >= TIERS.hat && onEighth;

  return { melody, harmony, counter, arp, bass, kick: onQuarter, snare, hat };
}
```

In `src/synth.js`, change the `playStep` signature and its `eventsAt` call only:

```js
    playStep(step, time, dt, tier) {
      if (!ctx) return;
      const e = eventsAt(step, tier);
```
(the voice calls below it stay as they are for now).

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test`
Expected: PASS (whole suite).

- [ ] **Step 5: Commit**

```bash
git add src/core/track.js tests/track.test.js src/synth.js tests/synth.test.js
git commit -m "feat: gate each musical layer by tier so the arrangement can grow as apples are eaten"
```

---

### Task 3: Tier gate — new layers enter on a bar line

**Files:**
- Create: `src/core/tier-gate.js`
- Test: `tests/tier-gate.test.js`

**Interfaces:**
- Consumes: `STEPS_PER_BAR` from `core/track.js`.
- Produces: `createTierGate(getTier: () => number)` returning `{ tierFor(step: number): number }`. It starts holding tier 0, re-reads `getTier()` only when `step % STEPS_PER_BAR === 0`, and returns the held tier for every other step.

- [ ] **Step 1: Write the failing tests** (`tests/tier-gate.test.js`)

```js
import { describe, it, expect } from 'vitest';
import { createTierGate } from '../src/core/tier-gate.js';

describe('tier gate', () => {
  it('holds tier 0 until the first bar line', () => {
    const gate = createTierGate(() => 3);
    expect(gate.tierFor(5)).toBe(0);
  });

  it('adopts the current tier on a downbeat', () => {
    const gate = createTierGate(() => 3);
    expect(gate.tierFor(0)).toBe(3);
  });

  it('holds the tier through the bar even if it rises mid-bar', () => {
    let tier = 1;
    const gate = createTierGate(() => tier);
    expect(gate.tierFor(0)).toBe(1);
    tier = 2;
    expect(gate.tierFor(5)).toBe(1);
    expect(gate.tierFor(15)).toBe(1);
    expect(gate.tierFor(16)).toBe(2);
  });

  it('drops back to 0 on the next downbeat after a restart', () => {
    let tier = 4;
    const gate = createTierGate(() => tier);
    expect(gate.tierFor(32)).toBe(4);
    tier = 0;
    expect(gate.tierFor(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/tier-gate.test.js`
Expected: FAIL — cannot find `../src/core/tier-gate.js`.

- [ ] **Step 3: Write minimal implementation** (`src/core/tier-gate.js`)

```js
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/tier-gate.js tests/tier-gate.test.js
git commit -m "feat: hold the music tier until the next bar line so new layers enter on a downbeat"
```

---

### Task 4: Synth voices for the new layers

**Files:**
- Modify: `src/synth.js`
- Modify: `tests/synth.test.js`

**Interfaces:**
- Consumes: `eventsAt` and `TIERS` from `core/track.js`.
- Produces: `playStep(step, time, dt, tier)` now also voices `snare` (high-passed noise burst), `arp` (short square), `harmony` (square), `counter` (sawtooth). Oscillator creation order per step is: kick (sine), bass (triangle), arp (square), melody (square), harmony (square), counter (sawtooth). Noise sources per step are created in order: snare, hat. At tier ≥ `TIERS.bassPulse` the bass note is an eighth long (`dt * 1.8`); below it a quarter long (`dt * 3.6`).

- [ ] **Step 1: Write the failing tests** — append to `tests/synth.test.js` (the helpers `makeFakeContextClass` and `started` already exist in the file):

```js
describe('tiered layers', () => {
  it('plays only kick and bass on the downbeat at tier 0 (no hat)', () => {
    const { synth, log } = started();
    synth.playStep(0, 0, 0.125, 0);
    expect(log.oscillators.map((o) => o.type)).toEqual(['sine', 'triangle']);
    expect(log.noiseStarts).toHaveLength(0);
  });

  it('adds a snare burst on beat 2 from tier 3 (snare then hat)', () => {
    const { synth, log } = started();
    synth.playStep(4, 0.5, 0.125, 3);
    expect(log.noiseStarts).toEqual([0.5, 0.5]);
    expect(log.oscillators.map((o) => o.type)).toEqual(['sine', 'triangle']);
  });

  it('does not snare below tier 3', () => {
    const { synth, log } = started();
    synth.playStep(4, 0.5, 0.125, 2);
    expect(log.noiseStarts).toEqual([0.5]);
  });

  it('adds an arpeggio tone from tier 5 (second arp note on step 1: C4 = 261.6 Hz)', () => {
    const { synth, log } = started();
    synth.playStep(1, 0.1, 0.125, 5);
    expect(log.oscillators.map((o) => o.type)).toEqual(['square']);
    expect(log.oscillators[0].frequency.value).toBeCloseTo(261.63, 1);
  });

  it('voices every layer at tier 10 in a fixed order', () => {
    const { synth, log } = started();
    synth.playStep(64, 0, 0.125, 10);
    expect(log.oscillators.map((o) => o.type)).toEqual([
      'sine', 'triangle', 'square', 'square', 'square', 'sawtooth',
    ]);
    const hz = log.oscillators.map((o) => o.frequency.value);
    expect(hz[1]).toBeCloseTo(110); // bass A2
    expect(hz[2]).toBeCloseTo(220); // arp A3
    expect(hz[3]).toBeCloseTo(440); // melody A4
    expect(hz[4]).toBeCloseTo(523.25, 1); // harmony C5
    expect(hz[5]).toBeCloseTo(880); // counter A5
    expect(log.noiseStarts).toEqual([0]);
  });
});
```

(Frequency checks: arp step 1 at Am is MIDI 60 = 261.63 Hz; at step 64 the arp is MIDI 57 = 220 Hz, harmony MIDI 72 = 523.25 Hz, counter MIDI 81 = 880 Hz.)

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/synth.test.js`
Expected: FAIL — no snare, arp, harmony or counter voices yet.

- [ ] **Step 3: Write the implementation** — in `src/synth.js`:

Change the import and the levels:
```js
import { eventsAt, TIERS } from './core/track.js';

const LEVEL = {
  melody: 0.3, harmony: 0.16, counter: 0.1, arp: 0.07,
  bass: 0.55, kick: 0.9, snare: 0.35, hat: 0.12,
};
```
Make the noise buffer long enough for a snare — in `makeNoise` change `ctx.sampleRate * 0.05` to `ctx.sampleRate * 0.15`.

Add a `snare` function next to `hat`:
```js
  function snare(time) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1500;
    src.connect(filter);
    filter.connect(envelope(time, LEVEL.snare, 0.12));
    src.start(time);
    src.stop(time + 0.14);
  }
```
Replace `playStep` with:
```js
    playStep(step, time, dt, tier) {
      if (!ctx) return;
      const e = eventsAt(step, tier);
      if (e.kick) kick(time);
      if (e.snare) snare(time);
      if (e.hat) hat(time);
      if (e.bass !== null) {
        const bassLength = tier >= TIERS.bassPulse ? dt * 1.8 : dt * 3.6;
        tone('triangle', e.bass, time, bassLength, LEVEL.bass);
      }
      if (e.arp !== null) tone('square', e.arp, time, dt * 0.9, LEVEL.arp);
      if (e.melody !== null) tone('square', e.melody, time, dt * 1.8, LEVEL.melody);
      if (e.harmony !== null) tone('square', e.harmony, time, dt * 1.8, LEVEL.harmony);
      if (e.counter !== null) tone('sawtooth', e.counter, time, dt * 1.8, LEVEL.counter);
    },
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test`
Expected: PASS (whole suite, including the earlier synth tests unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/synth.js tests/synth.test.js
git commit -m "feat: voice the snare, arpeggio, harmony and counter-melody so higher tiers sound fuller"
```

---

### Task 5: Wire the tier into the page

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `musicTier` (pacing), `createTierGate` (tier-gate), `synth.playStep(step, time, dt, tier)`. `main.js` has no unit tests by design (verified in Task 6).

- [ ] **Step 1: Edit `src/main.js`**

Change the pacing import and add the tier-gate import:
```js
import { bpm, musicTier } from './core/pacing.js';
import { createTierGate } from './core/tier-gate.js';
```
Add, right after `let epoch = 0;`:
```js
// New layers enter on the next bar line, not the moment an apple is eaten.
const tierGate = createTierGate(() => musicTier(state.snake.length));
```
In the conductor's `onStep`, replace the `synth.playStep(step, time, dt);` line with:
```js
    synth.playStep(step, time, dt, tierGate.tierFor(step));
```

- [ ] **Step 2: Verify**

Run: `node --check src/main.js && yarn test`
Expected: syntax check silent; all suites PASS.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: feed the apple-driven music tier into playback so the song grows as you eat"
```

---

### Task 6: Verify in the browser, listen, then squash

**Files:** none (verification, then history).

- [ ] **Step 1: Serve** — `yarn start`, open http://localhost:8000. Expected: no console errors, CSP unchanged.

- [ ] **Step 2: Check** (report failures; do not assume)

- [ ] At 0 apples: only kick and bass play (no hi-hat, no melody) and steps are ~125 ms apart.
- [ ] After 4 apples the step gap shrinks to ~121 ms (124 BPM); after 3 apples it has not changed.
- [ ] After 8 apples the hi-hat enters, and only at the next bar line (up to ~2 s after the apple).
- [ ] Driving the page with a bot that eats apples (read food from the canvas), hat/oscillator counts per bar rise at the tier boundaries 8, 16, 24 apples.
- [ ] Restart (Enter + arrow key) returns to kick + bass only and 120 BPM.
- [ ] Mute does not change step speed; pause/game-over stop the music.

- [ ] **Step 3: Listen** — the layers and the tier order are composed data; the top tiers need a long run to reach (80 apples). Ask the user to play, and offer a temporary debug hook (not committed) to jump the tier for listening if they want to hear tier 10 without eating 80 apples. Record feedback as follow-ups.

- [ ] **Step 4: Squash into one commit** (this branch already holds the beat-sync work; squash all of it onto the first feature commit)

```bash
BASE=$(git merge-base feature/rhythm-music feature/snake-game)
git reset --soft "$BASE"
git commit -m "feat: sync snake movement to a 32-bar rhythm track that grows with apples

Movement and music share one sixteenth-note beat clock so every step lands on
the beat. Tempo rises once per 4 apples (120 to 200 BPM at apple 80) and the
arrangement gains a layer every 8 apples, ending in a full, complex loop. New
layers enter on the next bar line so they land on a downbeat."
```
Expected: `git log --oneline` shows one new commit on top of `c8f194a`; `git status` is clean.

---

## Self-Review

**Spec coverage:** tempo +4 BPM per 4 apples, 200 at apple 80 → Task 1; steps/sec follow BPM → unchanged `stepSeconds` (Task 1); 10 tiers one per 8 apples, tier 10 at apple 80 → Task 1 (`musicTier`); each layer by tier (bass+kick, hat eighths, melody, snare 2&4, sixteenth hat, arpeggio, bass pulse, harmony, counter-melody, drum fill, all) → Task 2 (`eventsAt`) and voiced in Tasks 2/4; layers accumulate → Task 2 test; tier change at the next bar line → Task 3; restart resets to tier 0 / 0 apples → Tasks 3 and 5 (new state → tier 0 at step 0); intro stays melody-free → Task 2 test; mute/pause/fallback behavior unchanged → covered by existing tests and Task 6. Open question (tune by ear) → Task 6 Step 3.

**Placeholder scan:** none; every code step has full code. The synth test edits in Task 2 list each call and tier explicitly.

**Type consistency:** `eventsAt(step, tier)` (Task 2) matches `synth.playStep(step, time, dt, tier)` (Tasks 2, 4, 5); `TIERS` exported in Task 2 is imported in Task 4; `musicTier`/`bpm` (Task 1) are used in Task 5; `createTierGate` (Task 3) returns `tierFor` used in Task 5.
