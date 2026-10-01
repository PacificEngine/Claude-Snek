import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMusic } from '../src/audio.js';

function makeFakeContextClass() {
  const starts = [];
  const gains = [];
  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = {};
      FakeAudioContext.instance = this;
    }
    resume() { return Promise.resolve(); }
    createGain() {
      const g = { gain: { value: 1 }, connect() {} };
      gains.push(g);
      return g;
    }
    createOscillator() {
      return {
        type: '',
        frequency: { value: 0 },
        connect() {},
        start: (t) => starts.push(t),
        stop() {},
      };
    }
  }
  return { FakeAudioContext, starts, gains };
}

describe('createMusic', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is a silent no-op when Web Audio is unavailable', () => {
    const music = createMusic(undefined);
    expect(() => { music.start(); music.setBpm(150); music.setMuted(true); }).not.toThrow();
  });

  it('is a silent no-op when the constructor throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = class { constructor() { throw new Error('blocked'); } };
    const music = createMusic(Boom);
    expect(() => music.start()).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('schedules eighth notes at the starting 100 BPM', () => {
    const { FakeAudioContext, starts } = makeFakeContextClass();
    const music = createMusic(FakeAudioContext);
    music.start();
    for (let i = 1; i <= 40; i++) {
      FakeAudioContext.instance.currentTime = i * 0.025;
      vi.advanceTimersByTime(25);
    }
    expect(starts[1] - starts[0]).toBeCloseTo(0.3);
  });

  it('spaces notes closer together after the BPM rises', () => {
    const { FakeAudioContext, starts } = makeFakeContextClass();
    const music = createMusic(FakeAudioContext);
    music.start();
    music.setBpm(200);
    for (let i = 1; i <= 200; i++) {
      FakeAudioContext.instance.currentTime = i * 0.025;
      vi.advanceTimersByTime(25);
    }
    const gaps = starts.slice(1).map((t, i) => t - starts[i]).slice(1);
    expect(Math.min(...gaps)).toBeCloseTo(0.15);
  });

  it('does not burst-schedule missed notes after a throttled background tab', () => {
    const { FakeAudioContext, starts } = makeFakeContextClass();
    const music = createMusic(FakeAudioContext);
    music.start();
    const before = starts.length;
    FakeAudioContext.instance.currentTime = 10;
    vi.advanceTimersByTime(25);
    expect(starts.length - before).toBeLessThan(5);
  });

  it('does not double-schedule when start is called twice', () => {
    const { FakeAudioContext, starts } = makeFakeContextClass();
    const music = createMusic(FakeAudioContext);
    music.start();
    const afterFirst = starts.length;
    music.start();
    expect(starts.length).toBe(afterFirst);
  });

  it('mutes by setting master gain to 0 and restores it', () => {
    const { FakeAudioContext, gains } = makeFakeContextClass();
    const music = createMusic(FakeAudioContext);
    music.start();
    const master = gains[0];
    music.setMuted(true);
    expect(master.gain.value).toBe(0);
    expect(music.isMuted()).toBe(true);
    music.setMuted(false);
    expect(master.gain.value).toBeGreaterThan(0);
  });
});
