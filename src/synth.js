import { eventsAt } from './core/track.js';

const MASTER_VOLUME = 0.2;
const SILENT_FLOOR = 0.0001;
const PULSE_DUTY = 0.25;
const PULSE_HARMONICS = 32;

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

  // A burst of filtered noise: the building block of snare, hat, clap and shaker.
  function burst(filterType, frequency, time, duration, level) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    src.connect(filter);
    filter.connect(envelope(time, level, duration));
    src.start(time);
    src.stop(time + duration + 0.01);
  }

  // A sine that falls from `from` to `to` Hz: the body of kick and tom.
  function thump(from, to, sweep, decay, time, level) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(from, time);
    osc.frequency.exponentialRampToValueAtTime(to, time + sweep);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, time);
    g.gain.exponentialRampToValueAtTime(SILENT_FLOOR, time + decay);
    osc.connect(g);
    g.connect(bus);
    osc.start(time);
    osc.stop(time + decay + 0.02);
  }

  // A narrow rectangle wave built once from its harmonics; plain square if the browser has no periodic waves.
  let pulseWave = null;
  function pulse(midi, time, duration, level) {
    if (!ctx.createPeriodicWave) return tone('square', midi, time, duration, level);
    if (!pulseWave) {
      const real = new Float32Array(PULSE_HARMONICS + 1);
      for (let n = 1; n <= PULSE_HARMONICS; n++) real[n] = (2 * Math.sin(n * Math.PI * PULSE_DUTY)) / (n * Math.PI);
      pulseWave = ctx.createPeriodicWave(real, new Float32Array(PULSE_HARMONICS + 1));
    }
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(pulseWave);
    osc.frequency.value = midiToHz(midi);
    osc.connect(envelope(time, level, duration));
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  const OSCILLATOR_TYPE = { square: 'square', triangle: 'triangle', saw: 'sawtooth', sine: 'sine' };

  // The one way anything is played: a voice, a MIDI note (null for drums), when, how long (seconds) and how loud.
  function playHit(voice, note, time, length, level) {
    if (!ctx) return;
    if (voice === 'kick') thump(150, 45, 0.12, 0.15, time, level);
    else if (voice === 'tom') thump(midiToHz(note ?? 50) * 1.6, midiToHz(note ?? 50), 0.08, 0.22, time, level);
    else if (voice === 'snare') burst('highpass', 1500, time, 0.12, level);
    else if (voice === 'hat') burst('highpass', 7000, time, 0.04, level);
    else if (voice === 'shaker') burst('bandpass', 6000, time, 0.06, level);
    else if (voice === 'clap') [0, 0.012, 0.024].forEach((d) => burst('bandpass', 1500, time + d, d === 0.024 ? 0.1 : 0.02, level));
    else if (note === null || note === undefined) return;
    else if (voice === 'pulse') pulse(note, time, length, level);
    else if (OSCILLATOR_TYPE[voice]) tone(OSCILLATOR_TYPE[voice], note, time, length, level);
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
    playHit,
    playStep(step, time, dt, active, trackId) {
      if (!ctx) return;
      eventsAt(step, active, trackId).hits.forEach((h) => playHit(h.voice, h.note, time, h.length * dt, h.level));
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
