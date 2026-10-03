// Midnight: a dark, half-time D minor groove with dorian colour (the B natural over G) and a bluesy A major turn.
// The snare lands on beat 3 only, a syncopated saw bass and toms carry the groove, sine layers stay sparse.
import { hit, triadFrom, rootFrom, chordToneBelow, fromPattern } from './compose.js';

const LEVEL = {
  kick: 0.9, bass: 0.38, hat: 0.1, hatGhost: 0.06, lead: 0.32, snare: 0.4, snareGhost: 0.08, tom: 0.26,
  pluck: 0.12, sub: 0.32, harmony: 0.1, pad: 0.08, fill: 0.28,
};

// Eight eighth-note slots per bar, as MIDI notes; 0 is a rest.
const VERSE = [
  [69, 0, 0, 72, 0, 74, 0, 0], // Dm
  [71, 0, 69, 0, 67, 0, 0, 0], // G
  [69, 0, 0, 72, 0, 77, 74, 0], // Dm
  [74, 0, 71, 0, 0, 0, 67, 0], // G
  [72, 0, 0, 69, 0, 65, 0, 0], // F
  [67, 0, 64, 0, 0, 67, 0, 0], // C
  [71, 0, 0, 74, 0, 72, 71, 0], // G
  [69, 0, 0, 0, 0, 0, 64, 67], // Am
];
const CHORUS = [
  [74, 0, 74, 77, 0, 74, 0, 0], // Bb
  [76, 0, 76, 79, 0, 76, 72, 0], // C
  [74, 0, 0, 72, 0, 69, 65, 0], // Dm
  [62, 0, 0, 0, 0, 65, 67, 69], // Dm
  [74, 0, 74, 77, 0, 74, 0, 0], // Bb
  [79, 0, 77, 76, 0, 72, 0, 0], // C
  [73, 0, 0, 76, 0, 73, 69, 0], // A
  [69, 0, 0, 0, 0, 0, 0, 0], // A
];
const BRIDGE = [
  [67, 0, 0, 0, 71, 0, 0, 0], // Em
  [69, 0, 0, 0, 72, 0, 0, 0], // F
  [71, 0, 0, 0, 74, 0, 0, 0], // G
  [73, 0, 0, 0, 76, 0, 0, 0], // A
];

const CHORUS_CHORDS = ['Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A'];

// 4 + 8 + 8 + 4 + 8 = 32 bars. The final chorus keeps its key; its lead (and what follows the lead) goes up an octave.
export const SECTIONS = [
  { name: 'intro', bars: 4, chords: ['Dm', 'G', 'Dm', 'G'], melody: null, transpose: 0 },
  { name: 'verse', bars: 8, chords: ['Dm', 'G', 'Dm', 'G', 'F', 'C', 'G', 'Am'], melody: VERSE, transpose: 0 },
  { name: 'chorus', bars: 8, chords: CHORUS_CHORDS, melody: CHORUS, transpose: 0 },
  { name: 'bridge', bars: 4, chords: ['Em', 'F', 'G', 'A'], melody: BRIDGE, transpose: 0 },
  { name: 'finale', bars: 8, chords: CHORUS_CHORDS, melody: CHORUS.map((bar) => bar.map((n) => (n ? n + 12 : 0))), transpose: 0 },
];

const BASS_FLOOR = 38;
// [semitones above the root, length in steps] by step in the bar: root, push, octave pop, root, seventh, fifth.
const bassGroove = (seventh) => ({ 0: [0, 3], 3: [0, 1], 6: [12, 1], 10: [0, 2], 13: [seventh, 1], 14: [7, 1.5] });
// The bluesy flat seven, except over F and Bb where it would leave the key: there the sixth (D, G) instead.
const GROOVES = Array.from({ length: 12 }, (_, root) => bassGroove(root === 5 || root === 10 ? 9 : 10));
const TOMS = [{ 3: 50, 11: 45 }, { 6: 50, 13: 45 }];
const ECHO = { 0: 0, 3: 2, 6: 3, 9: 1, 12: 2 };
const FILL = { 10: 57, 11: 55, 12: 52, 13: 50, 14: 47, 15: 45 };

// Half time: the kick on one and the "and" of three, with a pickup on odd bars.
const kick = ({ bar, inBar }) =>
  (inBar === 0 || inBar === 10 || (bar % 2 === 1 && inBar === 7) ? [hit('kick', null, 0, LEVEL.kick)] : []);

const sawBass = ({ inBar, chord }) => fromPattern(GROOVES[chord.root], inBar, rootFrom(chord, BASS_FLOOR), 'saw', LEVEL.bass);

const hiHat = ({ inBar }) => {
  if (inBar % 2 === 0) return [hit('hat', null, 0, LEVEL.hat)];
  return inBar === 7 || inBar === 15 ? [hit('hat', null, 0, LEVEL.hatGhost)] : [];
};

const lead = ({ lead: line }) => (line ? [hit('triangle', line.note, line.length, LEVEL.lead)] : []);

// Beat three only, with a ghost note before the next bar on odd bars.
const snare = ({ bar, inBar }) => {
  if (inBar === 8) return [hit('snare', null, 0, LEVEL.snare)];
  return bar % 2 === 1 && inBar === 15 ? [hit('snare', null, 0, LEVEL.snareGhost)] : [];
};

const toms = ({ bar, inBar }) => {
  const note = TOMS[bar % 2][inBar];
  return note ? [hit('tom', note, 0, LEVEL.tom)] : [];
};

// Dotted-eighth chord tones, like an echo trailing behind the beat.
const echoPluck = ({ inBar, chord }) => {
  if (ECHO[inBar] === undefined) return [];
  const [r, third, fifth] = triadFrom(chord, 62);
  return [hit('sine', [r, third, fifth, r + 12][ECHO[inBar]], 2, LEVEL.pluck)];
};

const subBass = ({ inBar, chord }) => (inBar === 0 ? [hit('sine', rootFrom(chord, BASS_FLOOR), 14, LEVEL.sub)] : []);

// The nearest chord tone under the lead, worked out from the melody line itself.
const harmony = ({ lead: line, chord }) =>
  line ? [hit('pulse', chordToneBelow(line.note, chord), line.length, LEVEL.harmony)] : [];

// Two long high notes a bar, the chord's third then its fifth: a slow counter-line over everything.
const sinePad = ({ inBar, chord }) => {
  if (inBar !== 0 && inBar !== 8) return [];
  const [, third, fifth] = triadFrom(chord, 74);
  return [hit('sine', inBar === 0 ? third : fifth, 7.5, LEVEL.pad)];
};

// Toms falling down the kit at the end of every fourth bar.
const tomFill = ({ bar, inBar }) => (bar % 4 === 3 && FILL[inBar] ? [hit('tom', FILL[inBar], 0, LEVEL.fill)] : []);

export const MIDNIGHT = {
  id: 'midnight',
  name: 'Midnight',
  sections: SECTIONS,
  layers: [
    ['Kick', 'kick', kick],
    ['Saw Bass', 'saw', sawBass],
    ['Hi-Hat', 'hat', hiHat],
    ['Triangle Lead', 'triangle', lead],
    ['Snare', 'snare', snare],
    ['Toms', 'tom', toms],
    ['Echo Pluck', 'sine', echoPluck],
    ['Sub Bass', 'sine', subBass],
    ['Pulse Harmony', 'pulse', harmony],
    ['Sine Pad', 'sine', sinePad],
    ['Tom Fill', 'tom', tomFill],
  ],
};
