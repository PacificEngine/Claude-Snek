import { eventsAt, TIERS } from './core/track.js';

const MASTER_VOLUME = 0.2;
const LEVEL = {
  melody: 0.3, harmony: 0.16, counter: 0.1, arp: 0.07,
  bass: 0.55, kick: 0.9, snare: 0.35, hat: 0.12,
};
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

  function makeNoise() {
    const length = Math.floor(ctx.sampleRate * 0.15);
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
    // Some mobile browsers only unlock audio on a later gesture event; try again.
    unlock() {
      ctx?.resume?.()?.catch?.(() => {});
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
