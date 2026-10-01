# Rhythm-Synced Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the snake advance exactly one cell per sixteenth note of the music, and replace the 2-bar loop with a 32-bar track (melody, bass, synth kick, synth hi-hat).

**Architecture:** A pure track table (`eventsAt(step)`) says what plays on each sixteenth-note step. A conductor counts steps on a time source (the audio clock, or `performance.now()` when Web Audio is missing) and calls `onStep(step, time, dt)` slightly ahead of each step's time. `main.js` plays the music events at that time and applies the snake's move at the same time, so both ride one grid. Tempo only changes the gap between steps, so the song keeps its place.

**Tech Stack:** Vanilla JavaScript (ES modules, no build step), Web Audio, Vitest (dev-only, via yarn).

**Spec:** `docs/specs/snake-game/snake-game.md` (sections: Core Requirements, Resilience, Performance, Architecture, Data Model, Decisions)

## Global Constraints

- Vanilla JavaScript with ES modules, no build step, zero runtime dependencies; use `yarn` only (never npm, pnpm or bun).
- One snake step per sixteenth note: seconds per step = `60 / BPM / 4` (steps/sec = BPM ÷ 15).
- BPM starts at 120, +4 per food eaten, max 200 (so 8 → 13.3 steps/sec). The old 20 steps/sec cap is dropped.
- The track is 32 bars × 16 steps = 512 steps, then loops: intro 4, verse 8, chorus 8, bridge 4, final chorus 8 (A minor). Melody, bass, synth kick on every quarter note (step % 4 == 0), synth hi-hat on every eighth note (step % 2 == 0).
- No audio files; all sound is synthesized. No network requests. No `innerHTML` or `eval`.
- Music starts only after the first user interaction. Mute silences sound only; it must not change game speed or the beat grid.
- Pause stops the music and the snake; resume continues on the next step. Game over stops the music; restart replays from bar 1 (step 0).
- If Web Audio is unavailable or blocked, the game runs silently on the same step grid, driven by `performance.now()`.
- Throttled background tabs must not cause a burst of notes (clamp scheduling to the clock).
- Controls unchanged: arrows/WASD, `P` pause, `Enter` restart, `M` mute. Ctrl/Cmd/Alt chords are not hijacked.
- Work on branch `feature/rhythm-music`; commit after each red-green cycle; commit messages explain why; no Claude signature; squash into one commit before finishing.

---

### Task 1: Pacing — 120 BPM base and step length

**Files:**
- Modify: `src/core/pacing.js`
- Modify: `tests/pacing.test.js`

**Interfaces:**
- Produces: `bpm(length: number): number` (now 120 base, +4/food, cap 200) and `stepSeconds(beatsPerMinute: number): number` (= `60 / bpm / 4`). `ticksPerSecond` stays for now (removed in Task 5 when `main.js` stops using it).

- [ ] **Step 1: Write the failing tests**

In `tests/pacing.test.js` change the import line to
```js
import { ticksPerSecond, bpm, stepSeconds } from '../src/core/pacing.js';
```
and replace the whole `describe('bpm', ...)` block with:
```js
describe('bpm', () => {
  it('starts at 120 for the starting length', () => {
    expect(bpm(3)).toBe(120);
  });
  it('adds 4 per food eaten', () => {
    expect(bpm(4)).toBe(124);
  });
  it('caps at 200', () => {
    expect(bpm(100)).toBe(200);
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
Expected: FAIL — `bpm(3)` is 100 not 120, and `stepSeconds` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/core/pacing.js` change `const BASE_BPM = 100;` to `const BASE_BPM = 120;`, add `const STEPS_PER_BEAT = 4; // one step per sixteenth note`, and append:
```js
export const stepSeconds = (beatsPerMinute) => 60 / beatsPerMinute / STEPS_PER_BEAT;
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test`
Expected: PASS (whole suite — the old audio tests do not depend on `bpm()`).

- [ ] **Step 5: Commit**

```bash
git add src/core/pacing.js tests/pacing.test.js
git commit -m "feat: pace the game in BPM and define a step as a sixteenth note so movement can ride the beat"
```

---

### Task 2: The 32-bar track (pure data)

**Files:**
- Create: `src/core/track.js`
- Test: `tests/track.test.js`

**Interfaces:**
- Produces: `STEPS_PER_BAR = 16`, `TOTAL_STEPS = 512`, and `eventsAt(step: number): { melody: number|null, bass: number|null, kick: boolean, hat: boolean }` — `melody`/`bass` are MIDI note numbers or `null`. `step` wraps modulo 512 (negative steps wrap too).

- [ ] **Step 1: Write the failing tests** (`tests/track.test.js`)

```js
import { describe, it, expect } from 'vitest';
import { eventsAt, TOTAL_STEPS, STEPS_PER_BAR } from '../src/core/track.js';

const all = Array.from({ length: TOTAL_STEPS }, (_, i) => eventsAt(i));
const melodyFrom = (start, count) => all.slice(start, start + count).map((e) => e.melody);

describe('track shape', () => {
  it('is 32 bars of sixteenth-note steps', () => {
    expect(STEPS_PER_BAR).toBe(16);
    expect(TOTAL_STEPS).toBe(512);
  });
  it('wraps around after 32 bars', () => {
    expect(eventsAt(TOTAL_STEPS)).toEqual(eventsAt(0));
    expect(eventsAt(TOTAL_STEPS + 37)).toEqual(eventsAt(37));
  });
});

describe('drums', () => {
  it('kicks exactly on quarter notes', () => {
    all.forEach((e, i) => expect(e.kick).toBe(i % 4 === 0));
  });
  it('plays the hi-hat exactly on eighth notes', () => {
    all.forEach((e, i) => expect(e.hat).toBe(i % 2 === 0));
  });
});

describe('bass', () => {
  it('plays only on quarter notes', () => {
    all.forEach((e, i) => expect(e.bass !== null).toBe(i % 4 === 0));
  });
  it('starts on the A minor root and moves to F in bar 2', () => {
    expect(eventsAt(0).bass).toBe(45);
    expect(eventsAt(16).bass).toBe(41);
  });
});

describe('melody sections', () => {
  it('is silent through the 4-bar intro', () => {
    expect(melodyFrom(0, 64).every((m) => m === null)).toBe(true);
  });
  it('enters at bar 5 on A4', () => {
    expect(eventsAt(64).melody).toBe(69);
  });
  it('plays a different melody in the chorus than in the verse', () => {
    expect(melodyFrom(64, 128)).not.toEqual(melodyFrom(192, 128));
  });
  it('plays the final chorus an octave above the chorus', () => {
    expect(eventsAt(384).melody).toBe(eventsAt(192).melody + 12);
  });
  it('keeps every note in a playable range', () => {
    all.forEach((e) => {
      if (e.melody !== null) {
        expect(e.melody).toBeGreaterThanOrEqual(60);
        expect(e.melody).toBeLessThanOrEqual(100);
      }
      if (e.bass !== null) {
        expect(e.bass).toBeGreaterThanOrEqual(36);
        expect(e.bass).toBeLessThanOrEqual(70);
      }
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/track.test.js`
Expected: FAIL — cannot find `../src/core/track.js`.

- [ ] **Step 3: Write minimal implementation** (`src/core/track.js`)

```js
export const STEPS_PER_BAR = 16;
export const TOTAL_BARS = 32;
export const TOTAL_STEPS = STEPS_PER_BAR * TOTAL_BARS;

// MIDI roots for the bass (one octave below the melody's home register).
const BASS_ROOT = { Am: 45, F: 41, C: 48, G: 43, E: 40 };
// Bass plays on each quarter note of a bar: root, root, octave up, root.
const BASS_OFFSETS = [0, 0, 12, 0];

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

export function eventsAt(step) {
  const s = ((step % TOTAL_STEPS) + TOTAL_STEPS) % TOTAL_STEPS;
  const bar = Math.floor(s / STEPS_PER_BAR);
  const inBar = s % STEPS_PER_BAR;
  const { section, barInSection } = locate(bar);
  const chord = section.chords[barInSection % section.chords.length];
  const onEighth = inBar % 2 === 0;
  const onQuarter = inBar % 4 === 0;
  const melodyNote = section.melody && onEighth ? section.melody[chord][inBar / 2] : 0;
  return {
    melody: melodyNote ? melodyNote + section.transpose : null,
    bass: onQuarter ? BASS_ROOT[chord] + BASS_OFFSETS[inBar / 4] : null,
    kick: onQuarter,
    hat: onEighth,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test tests/track.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/track.js tests/track.test.js
git commit -m "feat: add a pure 32-bar track table so what plays on each step is testable without audio"
```

---

### Task 3: Conductor — the shared beat clock

**Files:**
- Create: `src/conductor.js`
- Test: `tests/conductor.test.js`

**Interfaces:**
- Consumes: `stepSeconds` from `core/pacing.js`.
- Produces: `createConductor({ now: () => number, getBpm: () => number, onStep: (step: number, time: number, dt: number) => void })` returning `{ start(), pause(), resume(), isRunning() }`. `start()` restarts at step 0; `resume()` continues at the next step number (no-op if already running); `pause()` halts. `onStep` is called up to 0.1 s ahead of `time` (in `now()` seconds); `dt` is that step's length in seconds. Pumps every 25 ms; `nextTime` is clamped to `now()` so a throttled tab skips missed steps instead of bursting.

- [ ] **Step 1: Write the failing tests** (`tests/conductor.test.js`)

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createConductor } from '../src/conductor.js';

function setup(bpm = 120) {
  const clock = { t: 0 };
  const steps = [];
  const tempo = { bpm };
  const conductor = createConductor({
    now: () => clock.t,
    getBpm: () => tempo.bpm,
    onStep: (step, time, dt) => steps.push({ step, time, dt }),
  });
  const advance = (seconds) => {
    const pumps = Math.round(seconds / 0.025);
    for (let i = 0; i < pumps; i++) {
      clock.t += 0.025;
      vi.advanceTimersByTime(25);
    }
  };
  return { clock, steps, tempo, conductor, advance };
}

describe('conductor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires step 0 at the current time when started', () => {
    const { steps, conductor } = setup();
    conductor.start();
    expect(steps).toHaveLength(1);
    expect(steps[0].step).toBe(0);
    expect(steps[0].time).toBe(0);
    expect(steps[0].dt).toBeCloseTo(0.125);
  });

  it('numbers steps consecutively, one sixteenth note apart', () => {
    const { steps, conductor, advance } = setup(120);
    conductor.start();
    advance(2);
    steps.forEach((s, i) => expect(s.step).toBe(i));
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].time - steps[i - 1].time).toBeCloseTo(0.125);
    }
    expect(steps.length).toBeGreaterThan(14);
  });

  it('never schedules more than one look-ahead window past the clock', () => {
    const { clock, steps, conductor, advance } = setup();
    conductor.start();
    advance(1);
    expect(Math.max(...steps.map((s) => s.time))).toBeLessThan(clock.t + 0.1);
  });

  it('spaces later steps closer together after the tempo rises', () => {
    const { steps, tempo, conductor, advance } = setup(120);
    conductor.start();
    advance(1);
    tempo.bpm = 240;
    advance(1);
    const last = steps.at(-1);
    const prev = steps.at(-2);
    expect(last.time - prev.time).toBeCloseTo(0.0625);
    expect(last.step - prev.step).toBe(1);
  });

  it('does not burst-schedule missed steps after a throttled background tab', () => {
    const { clock, steps, conductor } = setup();
    conductor.start();
    const before = steps.length;
    clock.t = 10;
    vi.advanceTimersByTime(25);
    expect(steps.length - before).toBeLessThan(3);
  });

  it('stops scheduling when paused and continues the numbering when resumed', () => {
    const { steps, conductor, advance } = setup();
    conductor.start();
    advance(0.5);
    conductor.pause();
    expect(conductor.isRunning()).toBe(false);
    const countAtPause = steps.length;
    advance(0.5);
    expect(steps.length).toBe(countAtPause);
    conductor.resume();
    expect(conductor.isRunning()).toBe(true);
    expect(steps[countAtPause].step).toBe(steps[countAtPause - 1].step + 1);
  });

  it('does nothing when resumed while already running', () => {
    const { steps, conductor } = setup();
    conductor.start();
    const count = steps.length;
    conductor.resume();
    expect(steps.length).toBe(count);
  });

  it('restarts from step 0 when started again', () => {
    const { steps, conductor, advance } = setup();
    conductor.start();
    advance(0.5);
    conductor.start();
    expect(steps.at(-1).step).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/conductor.test.js`
Expected: FAIL — cannot find `../src/conductor.js`.

- [ ] **Step 3: Write minimal implementation** (`src/conductor.js`)

```js
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test tests/conductor.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/conductor.js tests/conductor.test.js
git commit -m "feat: add a conductor that hands out sixteenth-note steps ahead of time so game and music share one beat grid"
```

---

### Task 4: Synth — plays one step of the track

**Files:**
- Create: `src/synth.js`
- Test: `tests/synth.test.js`

**Interfaces:**
- Consumes: `eventsAt` from `core/track.js`.
- Produces: `createSynth(AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext)` returning:
  - `start(): void` — creates the context (idempotent; call from a user gesture). On failure logs once via `console.error` and never retries.
  - `available` (getter, boolean) — true once a context exists.
  - `now(): number` — audio-clock seconds once started, otherwise `performance.now() / 1000`.
  - `playStep(step, time, dt): void` — schedules the step's melody (square), bass (triangle), kick (sine sweep) and hat (filtered noise) at audio time `time`; no-op when unavailable.
  - `silence(): void` — cuts everything already scheduled (disconnects the current bus, makes a fresh one).
  - `setMuted(muted: boolean)`, `isMuted(): boolean` — mute is a master gain of 0; settable before `start()`.
  The old `src/audio.js` is left untouched here; Task 5 deletes it.

- [ ] **Step 1: Write the failing tests** (`tests/synth.test.js`)

```js
import { describe, it, expect, vi } from 'vitest';
import { createSynth } from '../src/synth.js';

function makeFakeContextClass() {
  const log = { oscillators: [], noiseStarts: [], gains: [], contexts: [] };
  const param = (value = 0) => ({
    value,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.sampleRate = 44100;
      this.destination = {};
      log.contexts.push(this);
    }
    resume() { return Promise.resolve(); }
    createGain() {
      const g = { gain: param(1), connect() {}, disconnect() { g.disconnected = true; } };
      log.gains.push(g);
      return g;
    }
    createOscillator() {
      const o = {
        type: '',
        frequency: param(),
        connect() {},
        start(t) { o.startTime = t; },
        stop() {},
      };
      log.oscillators.push(o);
      return o;
    }
    createBuffer(channels, length) {
      return { getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() {
      return { buffer: null, connect() {}, start(t) { log.noiseStarts.push(t); }, stop() {} };
    }
    createBiquadFilter() {
      return { type: '', frequency: param(), connect() {} };
    }
  }
  return { FakeAudioContext, log };
}

const started = () => {
  const { FakeAudioContext, log } = makeFakeContextClass();
  const synth = createSynth(FakeAudioContext);
  synth.start();
  return { synth, log };
};

describe('createSynth without Web Audio', () => {
  it('is unavailable but every method is a safe no-op', () => {
    const synth = createSynth(null);
    expect(() => {
      synth.start();
      synth.playStep(0, 0, 0.125);
      synth.silence();
      synth.setMuted(true);
    }).not.toThrow();
    expect(synth.available).toBe(false);
    expect(typeof synth.now()).toBe('number');
    expect(synth.isMuted()).toBe(true);
  });

  it('logs once and does not retry when the constructor throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = class { constructor() { throw new Error('blocked'); } };
    const synth = createSynth(Boom);
    synth.start();
    synth.start();
    expect(synth.available).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('createSynth lifecycle', () => {
  it('creates one context even if started twice', () => {
    const { FakeAudioContext, log } = makeFakeContextClass();
    const synth = createSynth(FakeAudioContext);
    synth.start();
    synth.start();
    expect(log.contexts).toHaveLength(1);
    expect(synth.available).toBe(true);
  });

  it('reports the audio clock once started', () => {
    const { synth, log } = started();
    log.contexts[0].currentTime = 3;
    expect(synth.now()).toBe(3);
  });

  it('plays nothing before it is started', () => {
    const { FakeAudioContext, log } = makeFakeContextClass();
    const synth = createSynth(FakeAudioContext);
    synth.playStep(0, 0, 0.125);
    expect(log.oscillators).toHaveLength(0);
  });
});

describe('playStep', () => {
  it('plays kick, hat and bass on the downbeat of the intro, at the given time', () => {
    const { synth, log } = started();
    synth.playStep(0, 1.5, 0.125);
    expect(log.oscillators.map((o) => o.type)).toEqual(['sine', 'triangle']);
    expect(log.oscillators.every((o) => o.startTime === 1.5)).toBe(true);
    expect(log.noiseStarts).toEqual([1.5]);
  });

  it('plays only the hi-hat on an off-eighth drum step', () => {
    const { synth, log } = started();
    synth.playStep(2, 0.25, 0.125);
    expect(log.oscillators).toHaveLength(0);
    expect(log.noiseStarts).toEqual([0.25]);
  });

  it('plays nothing on an odd sixteenth', () => {
    const { synth, log } = started();
    synth.playStep(1, 0.125, 0.125);
    expect(log.oscillators).toHaveLength(0);
    expect(log.noiseStarts).toHaveLength(0);
  });

  it('adds the melody when the verse starts (A4 = 440 Hz, bass A2 = 110 Hz)', () => {
    const { synth, log } = started();
    synth.playStep(64, 0, 0.125);
    expect(log.oscillators.map((o) => o.type)).toEqual(['sine', 'triangle', 'square']);
    expect(log.oscillators[1].frequency.value).toBeCloseTo(110);
    expect(log.oscillators[2].frequency.value).toBeCloseTo(440);
  });
});

describe('mute and silence', () => {
  it('mutes by setting the master gain to 0 and restores it', () => {
    const { synth, log } = started();
    const master = log.gains[0];
    synth.setMuted(true);
    expect(master.gain.value).toBe(0);
    expect(synth.isMuted()).toBe(true);
    synth.setMuted(false);
    expect(master.gain.value).toBeGreaterThan(0);
  });

  it('honours a mute requested before start', () => {
    const { FakeAudioContext, log } = makeFakeContextClass();
    const synth = createSynth(FakeAudioContext);
    synth.setMuted(true);
    synth.start();
    expect(log.gains[0].gain.value).toBe(0);
  });

  it('silence cuts already-scheduled sound by swapping in a fresh bus', () => {
    const { synth, log } = started();
    const oldBus = log.gains[1];
    const gainsBefore = log.gains.length;
    synth.silence();
    expect(oldBus.disconnected).toBe(true);
    expect(log.gains.length).toBe(gainsBefore + 1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/synth.test.js`
Expected: FAIL — cannot find `../src/synth.js`.

- [ ] **Step 3: Write minimal implementation** (`src/synth.js`)

```js
import { eventsAt } from './core/track.js';

const MASTER_VOLUME = 0.2;
const LEVEL = { melody: 0.3, bass: 0.55, kick: 0.9, hat: 0.12 };
const SILENT_FLOOR = 0.0001;

const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);

export function createSynth(
  AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext,
) {
  let ctx = null;
  let master = null;
  let bus = null;
  let noise = null;
  let muted = false;
  let failed = false;

  // Every voice connects to `bus`; silence() swaps the bus to cut scheduled sound.
  function envelope(time, level, duration) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(SILENT_FLOOR, time);
    g.gain.linearRampToValueAtTime(level, time + 0.005);
    g.gain.exponentialRampToValueAtTime(SILENT_FLOOR, time + duration);
    g.connect(bus);
    return g;
  }

  function tone(type, midi, time, duration, level) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = midiToHz(midi);
    osc.connect(envelope(time, level, duration));
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  function kick(time) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(LEVEL.kick, time);
    g.gain.exponentialRampToValueAtTime(SILENT_FLOOR, time + 0.15);
    osc.connect(g);
    g.connect(bus);
    osc.start(time);
    osc.stop(time + 0.17);
  }

  function hat(time) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    src.connect(filter);
    filter.connect(envelope(time, LEVEL.hat, 0.04));
    src.start(time);
    src.stop(time + 0.05);
  }

  function makeNoise() {
    const length = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  return {
    get available() {
      return ctx !== null;
    },
    start() {
      if (ctx !== null || failed || !AudioContextCtor) return;
      let created = null;
      try {
        created = new AudioContextCtor();
        created.resume()?.catch?.(() => {});
        ctx = created;
        master = ctx.createGain();
        master.gain.value = muted ? 0 : MASTER_VOLUME;
        master.connect(ctx.destination);
        bus = ctx.createGain();
        bus.connect(master);
        noise = makeNoise();
      } catch (err) {
        console.error('Audio unavailable, continuing silently', err);
        failed = true;
        ctx = null;
        created?.close?.();
      }
    },
    now: () => (ctx ? ctx.currentTime : performance.now() / 1000),
    playStep(step, time, dt) {
      if (!ctx) return;
      const e = eventsAt(step);
      if (e.kick) kick(time);
      if (e.hat) hat(time);
      if (e.bass !== null) tone('triangle', e.bass, time, dt * 3.6, LEVEL.bass);
      if (e.melody !== null) tone('square', e.melody, time, dt * 1.8, LEVEL.melody);
    },
    silence() {
      if (!ctx) return;
      bus.disconnect();
      bus = ctx.createGain();
      bus.connect(master);
    },
    setMuted(next) {
      muted = next;
      if (master) master.gain.value = muted ? 0 : MASTER_VOLUME;
    },
    isMuted: () => muted,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test`
Expected: PASS (whole suite; old `audio.js` tests still pass because that file is untouched).

- [ ] **Step 5: Commit**

```bash
git add src/synth.js tests/synth.test.js
git commit -m "feat: add a synth that voices melody, bass, kick and hi-hat for one track step on the audio clock"
```

---

### Task 5: Wire the page to the beat clock and remove the old audio

**Files:**
- Modify: `src/main.js` (full replacement below)
- Modify: `src/core/pacing.js` (remove `ticksPerSecond` and its constants)
- Modify: `tests/pacing.test.js` (remove the `ticksPerSecond` describe and import)
- Delete: `src/audio.js`, `tests/audio.test.js`

**Interfaces:**
- Consumes: `createSynth`, `createConductor`, `bpm`, game functions as defined in Tasks 1-4 and the existing game core. `main.js` has no unit tests by design (DOM + audio; verified manually in Task 6).

- [ ] **Step 1: Replace `src/main.js` with**

```js
import { createState, queueDirection, tick, togglePause } from './core/game.js';
import { bpm } from './core/pacing.js';
import { loadHighScore, saveHighScore } from './storage.js';
import { actionForKey } from './input.js';
import { createSynth } from './synth.js';
import { createConductor } from './conductor.js';
import { render } from './renderer.js';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const messageEl = document.getElementById('message');
const muteBtn = document.getElementById('mute');

const synth = createSynth();
let best = loadHighScore();
let state = createState(Math.random);
let started = false;
// Bumped whenever the beat stops, so steps already scheduled ahead are dropped.
let epoch = 0;

const conductor = createConductor({
  now: () => synth.now(),
  getBpm: () => bpm(state.snake.length),
  onStep(step, time, dt) {
    synth.playStep(step, time, dt);
    const scheduledIn = epoch;
    setTimeout(() => {
      if (scheduledIn === epoch) advance();
    }, Math.max(0, (time - synth.now()) * 1000));
  },
});

function updateHud() {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(best);
  muteBtn.setAttribute('aria-pressed', String(synth.isMuted()));
  if (state.status === 'gameOver') messageEl.textContent = 'Game over — press Enter to restart';
  else if (state.status === 'paused') messageEl.textContent = 'Paused — press P to resume';
  else messageEl.textContent = started ? '' : 'Press an arrow key or WASD to start';
}

function draw() {
  render(ctx, state);
  updateHud();
}

function stopBeat() {
  epoch += 1;
  conductor.pause();
  synth.silence();
}

// One snake step, applied on the beat.
function advance() {
  state = tick(state, Math.random);
  if (state.score > best) {
    best = state.score;
    saveHighScore(best);
  }
  if (state.status === 'gameOver') stopBeat();
  draw();
}

function restart() {
  state = createState(Math.random);
  started = false;
  draw();
}

function toggleMute() {
  synth.setMuted(!synth.isMuted());
  updateHud();
}

document.addEventListener('keydown', (event) => {
  if (typeof event.key !== 'string') return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const action = actionForKey(event.key);
  if (!action) return;
  if (event.repeat && action.type !== 'direction') return;
  event.preventDefault();

  if (action.type === 'direction') {
    state = queueDirection(state, action.direction);
    if (!started) {
      started = true;
      synth.start();
      conductor.start();
      draw();
    }
  } else if (action.type === 'pause' && started) {
    state = togglePause(state);
    if (state.status === 'paused') stopBeat();
    else if (state.status === 'playing') conductor.resume();
    draw();
  } else if (action.type === 'restart' && state.status === 'gameOver') {
    restart();
  } else if (action.type === 'mute') {
    toggleMute();
  }
});

muteBtn.addEventListener('click', toggleMute);

draw();
```

- [ ] **Step 2: Remove the old audio module and its tests**

```bash
git rm src/audio.js tests/audio.test.js
```

- [ ] **Step 3: Remove `ticksPerSecond`**

In `src/core/pacing.js` delete the `BASE_TICKS_PER_SEC`, `TICKS_PER_FOOD`, `MAX_TICKS_PER_SEC` constants and the `ticksPerSecond` export. In `tests/pacing.test.js` delete the whole `describe('ticksPerSecond', ...)` block and drop `ticksPerSecond` from the import line. The remaining pacing module must read:

```js
import { START_LENGTH } from './config.js';

const BASE_BPM = 120;
const BPM_PER_FOOD = 4;
const MAX_BPM = 200;
const STEPS_PER_BEAT = 4; // one step per sixteenth note

const foodEaten = (length) => Math.max(0, length - START_LENGTH);

export const bpm = (length) =>
  Math.min(MAX_BPM, BASE_BPM + foodEaten(length) * BPM_PER_FOOD);

export const stepSeconds = (beatsPerMinute) => 60 / beatsPerMinute / STEPS_PER_BEAT;
```

- [ ] **Step 4: Verify**

Run: `node --check src/main.js && yarn test`
Expected: syntax check silent; all suites PASS with no reference to the deleted modules. Also run `grep -rn "audio.js\|ticksPerSecond\|createMusic" src tests index.html` — expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: drive snake steps and music from one beat clock so every move lands on the beat"
```

---

### Task 6: Verify in the browser, then squash

**Files:** none (verification, then history).

- [ ] **Step 1: Serve and load**

```bash
yarn start
```
Open http://localhost:8000. Expected: board loads, no console errors, no CSP violations (the CSP is unchanged; no new resources are loaded).

- [ ] **Step 2: Check the checklist** (report failures; do not assume)

- [ ] Pressing an arrow key starts both the snake and the music together; music starts at bar 1.
- [ ] Snake steps measured with `requestAnimationFrame` sampling of the head cell are ~125 ms apart at the start (8 steps/sec) with low jitter.
- [ ] Eating food raises the tempo (steps get closer together) and the music tempo follows.
- [ ] `P` pauses: snake and music both stop immediately (no stray note on resume); `P` again resumes on the next step.
- [ ] Game over stops the music; `Enter` then an arrow key restarts the track from the beginning.
- [ ] `M` and the Mute button silence the sound but the snake's speed does not change.
- [ ] With Web Audio forced off (e.g. `window.AudioContext = undefined` before load via DevTools snippet or a unit-style check), the snake still steps at the same cadence, silently.
- [ ] Using `import('/src/synth.js')` + `import('/src/conductor.js')` in the page with a spying `AudioContext` subclass: sine kicks start 4 steps apart (0.5 s at 120 BPM), and noise hats 2 steps apart (0.25 s).
- [ ] Switch to another tab for ~10 s and back: no burst of notes.

- [ ] **Step 3: Listen** — the 32-bar track is composed as data and cannot be judged by tests. Ask the user to listen through at least one full loop (about 64 s at 120 BPM) and report which sections to rework; note any requests as follow-ups.

- [ ] **Step 4: Squash into one commit**

```bash
BASE=$(git merge-base feature/rhythm-music feature/snake-game)
git reset --soft "$BASE"
git commit -m "feat: sync snake movement to a 32-bar rhythm track

Movement and music now share one sixteenth-note beat clock so every step lands
on the beat, like a rhythm game. The 2-bar loop becomes a 32-bar arrangement
with bass, kick and hi-hat. Tempo changes only stretch the gaps between steps,
so the song keeps its place as the snake grows."
```
Expected: `git log --oneline` shows one new commit on top of `c8f194a`; `git status` is clean.

---

## Self-Review

**Spec coverage:** one step per sixteenth note, steps/sec = BPM ÷ 15 → Tasks 1, 3, 5; BPM 120/+4/200 cap → Task 1; 32-bar A-minor track with intro/verse/chorus/bridge/final chorus, melody, bass, kick on quarters, hat on eighths → Task 2 (shape, drums, bass, sections tests); synthesized voices, no audio files → Task 4; shared clock, track keeps place on tempo change → Tasks 3, 5; pause stops music and snake, resume next step → Task 5 (`stopBeat`/`conductor.resume`); game over stops music, restart from bar 1 → Task 5 (`stopBeat`, `conductor.start` resets step 0); mute doesn't change speed → Task 4 (gain only) and Task 5; no-Web-Audio fallback on the same grid → Task 4 (`now()` falls back to `performance.now()`), Task 5; no burst on throttled tabs → Task 3 clamp; music only after first interaction → Task 5 (`synth.start()` inside the keydown handler). Carried from earlier reviews: no retry storm after a failed audio start and an unhandled `resume()` rejection → Task 4. Open question (melody tuned by ear) → Task 6 Step 3.

**Placeholder scan:** none; every code step has full code. Task 5 Step 3 shows the full resulting `pacing.js`.

**Type consistency:** `eventsAt(step) → {melody, bass, kick, hat}` (Task 2) is consumed in Task 4; `onStep(step, time, dt)` (Task 3) matches `synth.playStep(step, time, dt)` (Task 4) and `main.js` (Task 5); `stepSeconds`/`bpm` (Task 1) are used in Tasks 3 and 5; `synth.now/start/silence/setMuted/isMuted` used in Task 5 match Task 4's interface.
