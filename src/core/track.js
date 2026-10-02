export const STEPS_PER_BAR = 16;
export const TOTAL_BARS = 32;
export const TOTAL_STEPS = STEPS_PER_BAR * TOTAL_BARS;

// The independent layers, in the order they enter by default (kick and bass first, at trigger 0).
export const LAYERS = ['kick', 'bass', 'hat', 'melody', 'snare', 'sixteenthHat', 'arp', 'bassPulse', 'harmony', 'counter', 'fill'];

// The layers switched on at tier n: kick and bass always, then the first n of the rest (tier 0 is bass + kick only).
export const layersForTier = (tier) => Object.fromEntries(LAYERS.map((name, i) => [name, i < 2 || tier >= i - 1]));

// MIDI roots for the bass (one octave below the melody's home register).
const BASS_ROOT = { Am: 45, F: 41, C: 48, G: 43, E: 40 };
// Without the bass-pulse layer the bass plays each quarter note: root, root, octave up, root.
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

// `active` maps each LAYERS name to a boolean; every layer decides for itself.
export function eventsAt(step, active) {
  const s = ((step % TOTAL_STEPS) + TOTAL_STEPS) % TOTAL_STEPS;
  const bar = Math.floor(s / STEPS_PER_BAR);
  const inBar = s % STEPS_PER_BAR;
  const { section, barInSection } = locate(bar);
  const chord = section.chords[barInSection % section.chords.length];
  const onEighth = inBar % 2 === 0;
  const onQuarter = inBar % 4 === 0;
  const pattern = section.melody ? section.melody[chord] : null;
  const slot = inBar / 2;

  // The melody line exists even when its layer is off: harmony follows the line, not the sound.
  const melodyRaw = onEighth && pattern ? pattern[slot] : 0;
  const counterRaw = active.counter && onEighth && pattern ? pattern[(slot + 6) % 8] : 0;
  const line = melodyRaw ? melodyRaw + section.transpose : null;
  const melody = active.melody ? line : null;
  const counter = counterRaw ? counterRaw + section.transpose + 12 : null;
  const harmony = active.harmony && line !== null ? thirdAbove(line) : null;
  const arp = active.arp ? CHORD_TONES[chord][ARP_ORDER[inBar % 4]] : null;

  // The pulse replaces the quarter-note line, but only while the bass layer itself plays.
  let bass = null;
  if (active.bass) {
    if (active.bassPulse) {
      if (onEighth) bass = BASS_ROOT[chord] + (slot % 2 === 1 ? 12 : 0);
    } else if (onQuarter) {
      bass = BASS_ROOT[chord] + BASS_OFFSETS[inBar / 4];
    }
  }

  const backbeat = inBar === 4 || inBar === 12;
  const fill = bar % 4 === 3 && inBar >= 12;
  const snare = Boolean((active.snare && backbeat) || (active.fill && fill));
  const hat = active.sixteenthHat ? true : Boolean(active.hat) && onEighth;

  return { melody, harmony, counter, arp, bass, kick: Boolean(active.kick) && onQuarter, snare, hat };
}
