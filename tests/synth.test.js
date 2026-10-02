import { describe, it, expect, vi } from 'vitest';
import { createSynth } from '../src/synth.js';
import { layersForTier } from '../src/core/track.js';

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
      synth.playStep(0, 0, 0.125, layersForTier(0));
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
    synth.playStep(0, 0, 0.125, layersForTier(0));
    expect(log.oscillators).toHaveLength(0);
  });
});

describe('playStep', () => {
  it('plays kick, hat and bass on the downbeat of the intro, at the given time', () => {
    const { synth, log } = started();
    synth.playStep(0, 1.5, 0.125, layersForTier(1));
    expect(log.oscillators.map((o) => o.type)).toEqual(['sine', 'triangle']);
    expect(log.oscillators.every((o) => o.startTime === 1.5)).toBe(true);
    expect(log.noiseStarts).toEqual([1.5]);
  });

  it('plays only the hi-hat on an off-eighth drum step', () => {
    const { synth, log } = started();
    synth.playStep(2, 0.25, 0.125, layersForTier(1));
    expect(log.oscillators).toHaveLength(0);
    expect(log.noiseStarts).toEqual([0.25]);
  });

  it('plays nothing on an odd sixteenth', () => {
    const { synth, log } = started();
    synth.playStep(1, 0.125, 0.125, layersForTier(1));
    expect(log.oscillators).toHaveLength(0);
    expect(log.noiseStarts).toHaveLength(0);
  });

  it('adds the melody when the verse starts (A4 = 440 Hz, bass A2 = 110 Hz)', () => {
    const { synth, log } = started();
    synth.playStep(64, 0, 0.125, layersForTier(2));
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

describe('layers by tier', () => {
  it('plays only kick and bass on the downbeat at tier 0 (no hat)', () => {
    const { synth, log } = started();
    synth.playStep(0, 0, 0.125, layersForTier(0));
    expect(log.oscillators.map((o) => o.type)).toEqual(['sine', 'triangle']);
    expect(log.noiseStarts).toHaveLength(0);
  });

  it('adds a snare burst on beat 2 from tier 3 (snare then hat)', () => {
    const { synth, log } = started();
    synth.playStep(4, 0.5, 0.125, layersForTier(3));
    expect(log.noiseStarts).toEqual([0.5, 0.5]);
    expect(log.oscillators.map((o) => o.type)).toEqual(['sine', 'triangle']);
  });

  it('does not snare below tier 3', () => {
    const { synth, log } = started();
    synth.playStep(4, 0.5, 0.125, layersForTier(2));
    expect(log.noiseStarts).toEqual([0.5]);
  });

  it('adds an arpeggio tone from tier 5 (second arp note on step 1: C4 = 261.6 Hz)', () => {
    const { synth, log } = started();
    synth.playStep(1, 0.1, 0.125, layersForTier(5));
    expect(log.oscillators.map((o) => o.type)).toEqual(['square']);
    expect(log.oscillators[0].frequency.value).toBeCloseTo(261.63, 1);
  });

  it('voices every layer at tier 10 in a fixed order', () => {
    const { synth, log } = started();
    synth.playStep(64, 0, 0.125, layersForTier(10));
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

describe('independent layers', () => {
  it('plays a drum fill snare on step 60 with only the fill layer active', () => {
    const { synth, log } = started();
    synth.playStep(60, 0.5, 0.125, { fill: true });
    expect(log.noiseStarts).toEqual([0.5]);
  });

  it('plays the fast hi-hat on an odd step without the hi-hat layer', () => {
    const { synth, log } = started();
    synth.playStep(1, 0.1, 0.125, { sixteenthHat: true });
    expect(log.noiseStarts).toEqual([0.1]);
  });
});

describe('unlock', () => {
  it('is a safe no-op before start and with no Web Audio', () => {
    expect(() => createSynth(null).unlock()).not.toThrow();
    const { FakeAudioContext } = makeFakeContextClass();
    expect(() => createSynth(FakeAudioContext).unlock()).not.toThrow();
  });

  it('asks a started context to resume again', () => {
    const { FakeAudioContext, log } = makeFakeContextClass();
    const synth = createSynth(FakeAudioContext);
    synth.start();
    let resumed = 0;
    log.contexts[0].resume = () => { resumed += 1; return Promise.resolve(); };
    synth.unlock();
    expect(resumed).toBe(1);
  });
});
