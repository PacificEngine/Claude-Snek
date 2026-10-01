// A-minor pentatonic loop as MIDI note numbers (0 = rest).
const MELODY = [69, 72, 76, 72, 69, 67, 64, 67, 69, 72, 76, 79, 76, 72, 69, 0];
const LOOKAHEAD_SECONDS = 0.1;
const TIMER_MS = 25;
const MASTER_VOLUME = 0.15;
const INITIAL_BPM = 100;

const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);

const silent = {
  start() {},
  setBpm() {},
  setMuted() {},
  isMuted: () => false,
};

export function createMusic(
  AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext,
) {
  if (!AudioContextCtor) return silent;

  let ctx = null;
  let master = null;
  let timer = null;
  let bpm = INITIAL_BPM;
  let muted = false;
  let noteIndex = 0;
  let nextNoteTime = 0;

  function playNote(midi, time, duration) {
    if (midi === 0) return;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = midiToHz(midi);
    osc.connect(master);
    osc.start(time);
    osc.stop(time + duration * 0.9);
  }

  function schedule() {
    // A throttled background tab lets nextNoteTime fall behind; skip missed notes.
    nextNoteTime = Math.max(nextNoteTime, ctx.currentTime);
    const eighth = 60 / bpm / 2;
    while (nextNoteTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      playNote(MELODY[noteIndex], nextNoteTime, eighth);
      noteIndex = (noteIndex + 1) % MELODY.length;
      nextNoteTime += eighth;
    }
  }

  return {
    start() {
      if (timer !== null) return;
      try {
        ctx = new AudioContextCtor();
        ctx.resume();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : MASTER_VOLUME;
        master.connect(ctx.destination);
        nextNoteTime = ctx.currentTime;
        schedule();
        timer = setInterval(schedule, TIMER_MS);
      } catch (err) {
        console.error('Audio unavailable, continuing silently', err);
        ctx = null;
      }
    },
    setBpm(next) {
      bpm = next;
    },
    setMuted(next) {
      muted = next;
      if (master) master.gain.value = muted ? 0 : MASTER_VOLUME;
    },
    isMuted: () => muted,
  };
}
