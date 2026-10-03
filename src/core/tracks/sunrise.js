// Sunrise: a bright, bouncy G major song. A tresillo kick (3+3+2) and a hopping pulse bass, shaker sixteenths,
// claps on the backbeat and a syncopated pulse lead. The last chorus lifts a whole tone into A major.
import { hit, triadFrom, rootFrom, diatonic, transposeScale, fromPattern } from './compose.js';

const G_MAJOR = [7, 9, 11, 0, 2, 4, 6];

const LEVEL = {
  kick: 0.85, bass: 0.45, shaker: 0.05, shakerAccent: 0.1, lead: 0.26, clap: 0.28, bongo: 0.22,
  arp: 0.13, walk: 0.3, harmony: 0.14, bell: 0.12,
};

// Eight eighth-note slots per bar, as MIDI notes; 0 is a rest.
const VERSE = [
  [71, 0, 74, 0, 0, 74, 76, 74], // G
  [74, 0, 69, 0, 0, 66, 69, 0], // D
  [71, 0, 67, 0, 0, 71, 74, 71], // Em
  [72, 0, 71, 69, 0, 67, 0, 0], // C
  [71, 0, 74, 0, 0, 74, 79, 78], // G
  [78, 0, 74, 0, 0, 69, 74, 0], // D
  [76, 0, 72, 0, 0, 76, 74, 72], // C
  [74, 0, 0, 0, 69, 0, 66, 0], // D
];
const CHORUS = [
  [76, 76, 0, 79, 0, 76, 72, 0], // C
  [78, 78, 0, 81, 0, 78, 74, 0], // D
  [78, 0, 74, 0, 71, 0, 74, 78], // Bm
  [79, 0, 0, 76, 0, 71, 0, 0], // Em
  [76, 76, 0, 79, 0, 76, 72, 0], // C
  [78, 78, 0, 81, 0, 83, 81, 0], // D
  [79, 0, 74, 0, 71, 74, 79, 0], // G
  [79, 0, 0, 0, 0, 0, 0, 0], // G
];
const BRIDGE = [
  [71, 0, 0, 0, 67, 0, 0, 0], // Em
  [72, 0, 0, 0, 76, 0, 0, 0], // C
  [72, 0, 0, 0, 69, 0, 71, 72], // Am
  [74, 0, 0, 0, 78, 0, 81, 0], // D
];

const CHORUS_CHORDS = ['C', 'D', 'Bm', 'Em', 'C', 'D', 'G', 'G'];

// 4 + 8 + 8 + 4 + 8 = 32 bars.
export const SECTIONS = [
  { name: 'intro', bars: 4, chords: ['G', 'C', 'G', 'D'], melody: null, transpose: 0 },
  { name: 'verse', bars: 8, chords: ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D'], melody: VERSE, transpose: 0 },
  { name: 'chorus', bars: 8, chords: CHORUS_CHORDS, melody: CHORUS, transpose: 0 },
  { name: 'bridge', bars: 4, chords: ['Em', 'C', 'Am', 'D'], melody: BRIDGE, transpose: 0 },
  { name: 'finale', bars: 8, chords: CHORUS_CHORDS, melody: CHORUS, transpose: 2 },
];

const BASS_FLOOR = 40;
// [semitones above the root, length in steps] by step in the bar: a bounce around the tresillo kick.
const BASS_BOUNCE = { 0: [0, 2.5], 3: [12, 1], 6: [0, 2.5], 10: [7, 1.5], 12: [0, 1.5], 14: [12, 1] };
const BONGOS = { 3: 62, 7: 57, 11: 62, 14: 57 };
const ARP_ORDER = [0, 1, 2, 3, 2, 1, 2, 3];
const BELL_ORDER = [2, 1, 0, 1];
const ROLL = { 8: 0.12, 10: 0.16, 13: 0.2, 14: 0.24, 15: 0.3 };

const kick = ({ inBar }) => ([0, 6, 12].includes(inBar) ? [hit('kick', null, 0, LEVEL.kick)] : []);

const pulseBass = ({ inBar, chord }) => fromPattern(BASS_BOUNCE, inBar, rootFrom(chord, BASS_FLOOR), 'pulse', LEVEL.bass);

const shaker = ({ inBar }) => [hit('shaker', null, 0, inBar % 4 === 2 ? LEVEL.shakerAccent : LEVEL.shaker)];

const lead = ({ lead: line }) => (line ? [hit('pulse', line.note, line.length, LEVEL.lead)] : []);

const clap = ({ inBar }) => (inBar === 4 || inBar === 12 ? [hit('clap', null, 0, LEVEL.clap)] : []);

const bongos = ({ inBar }) => (BONGOS[inBar] ? [hit('tom', BONGOS[inBar], 0, LEVEL.bongo)] : []);

// Eighth notes up and down the chord, with the octave on top.
const pluckArp = ({ inBar, chord }) => {
  if (inBar % 2 !== 0) return [];
  const [r, third, fifth] = triadFrom(chord, 60);
  return [hit('sine', [r, third, fifth, r + 12][ARP_ORDER[inBar / 2]], 1.2, LEVEL.arp)];
};

// Quarter notes root, third, fifth, then the scale step above the next bar's root, leading into it.
const walkingBass = ({ inBar, chord, next, transpose }) => {
  if (inBar % 4 !== 0) return [];
  const r = rootFrom(chord, BASS_FLOOR);
  const approach = diatonic(rootFrom(next, BASS_FLOOR), transposeScale(G_MAJOR, transpose), 1);
  return [hit('triangle', [r, r + chord.third, r + 7, approach][inBar / 4], 3.2, LEVEL.walk)];
};

// A diatonic third under the lead, worked out from the melody line itself.
const harmony = ({ lead: line, transpose }) =>
  line ? [hit('triangle', diatonic(line.note, transposeScale(G_MAJOR, transpose), -2), line.length, LEVEL.harmony)] : [];

// High chord tones on the beats where the lead rests: an answer to the melody (and a chime in the intro).
const bellCounter = ({ inBar, chord, leadRests }) => {
  if (inBar % 4 !== 0 || !leadRests) return [];
  return [hit('sine', triadFrom(chord, 67)[BELL_ORDER[inBar / 4]], 3, LEVEL.bell)];
};

// A rising snare roll into every fourth bar.
const snareRoll = ({ bar, inBar }) => (bar % 4 === 3 && ROLL[inBar] ? [hit('snare', null, 0, ROLL[inBar])] : []);

export const SUNRISE = {
  id: 'sunrise',
  name: 'Sunrise',
  sections: SECTIONS,
  layers: [
    ['Kick', 'kick', kick],
    ['Pulse Bass', 'pulse', pulseBass],
    ['Shaker', 'shaker', shaker],
    ['Pulse Lead', 'pulse', lead],
    ['Clap', 'clap', clap],
    ['Bongos', 'tom', bongos],
    ['Pluck Arp', 'sine', pluckArp],
    ['Walking Bass', 'triangle', walkingBass],
    ['Triangle Harmony', 'triangle', harmony],
    ['Bell Counter', 'sine', bellCounter],
    ['Snare Roll', 'snare', snareRoll],
  ],
};
