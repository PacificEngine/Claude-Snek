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
