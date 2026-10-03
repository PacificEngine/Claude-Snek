// Dune: a desert caravan groove in E phrygian dominant (E F G# A B C D), leaning on the F to G# augmented second.
// A maqsum hand-drum rhythm (deep kick 'dum', tom 'tek'), a pulsing drone bass, a winding saw ney over E, F, Am and Dm;
// the bridge climbs Am, Dm, F to E for tension and the final chorus lifts the lead an octave.
import { layeredTrack, hit, triadFrom, rootFrom, chordToneBelow, diatonic, fromPattern } from './compose.js';

const E_PHRYGIAN_DOMINANT = [4, 5, 8, 9, 11, 0, 2];

const LEVEL = {
  dum: 0.85, dumPickup: 0.5, bass: 0.4, zil: 0.09, zilAccent: 0.13, lead: 0.28, clap: 0.28, tek: 0.24, tekGhost: 0.12,
  oud: 0.12, drone: 0.22, harmony: 0.11, counter: 0.15, roll: 0.14, rollPeak: 0.3,
};

// Eight eighth-note slots per bar, as MIDI notes; 0 is a rest.
const VERSE = [
  [64, 65, 68, 0, 65, 64, 0, 0], // E
  [65, 0, 69, 72, 0, 69, 68, 65], // F
  [64, 65, 68, 71, 0, 68, 65, 64], // E
  [69, 0, 72, 71, 69, 0, 68, 0], // Am
  [74, 0, 72, 0, 69, 0, 65, 0], // Dm
  [69, 0, 68, 69, 72, 0, 71, 0], // Am
  [72, 0, 69, 0, 68, 65, 0, 0], // F
  [64, 0, 0, 0, 0, 0, 0, 0], // E
];
const CHORUS = [
  [76, 0, 77, 76, 0, 72, 0, 0], // Am
  [71, 0, 68, 0, 65, 68, 64, 0], // E
  [77, 0, 76, 77, 0, 72, 69, 0], // F
  [68, 0, 0, 65, 0, 64, 0, 0], // E
  [74, 0, 77, 0, 74, 72, 0, 0], // Dm
  [72, 0, 76, 0, 72, 69, 0, 0], // Am
  [72, 0, 69, 0, 68, 0, 65, 0], // F
  [68, 65, 64, 0, 0, 0, 0, 0], // E
];
const BRIDGE = [
  [69, 0, 0, 72, 0, 76, 0, 0], // Am
  [74, 0, 0, 77, 0, 74, 0, 0], // Dm
  [72, 0, 0, 69, 0, 65, 0, 0], // F
  [68, 0, 65, 0, 64, 0, 0, 0], // E
];

const CHORUS_CHORDS = ['Am', 'E', 'F', 'E', 'Dm', 'Am', 'F', 'E'];

// 4 + 8 + 8 + 4 + 8 = 32 bars. The finale keeps the key and lifts the lead (and what follows it) an octave.
const SECTIONS = [
  { name: 'intro', bars: 4, chords: ['E', 'E', 'F', 'E'], melody: null, transpose: 0 },
  { name: 'verse', bars: 8, chords: ['E', 'F', 'E', 'Am', 'Dm', 'Am', 'F', 'E'], melody: VERSE, transpose: 0 },
  { name: 'chorus', bars: 8, chords: CHORUS_CHORDS, melody: CHORUS, transpose: 0 },
  { name: 'bridge', bars: 4, chords: ['Am', 'Dm', 'F', 'E'], melody: BRIDGE, transpose: 0 },
  { name: 'finale', bars: 8, chords: CHORUS_CHORDS, melody: CHORUS.map((bar) => bar.map((n) => (n ? n + 12 : 0))), transpose: 0 },
];

// The drone bass note of every bar: mostly the chord root, with E over B and E over G# to lean into the cadences.
const CHORUS_BASS = [45, 40, 41, 40, 50, 45, 41, 47];
const BASS = [
  40, 40, 41, 40, // intro: E E F E
  40, 41, 40, 45, 38, 45, 41, 40, // verse
  ...CHORUS_BASS,
  45, 38, 41, 44, // bridge: Am Dm F E/G#
  ...CHORUS_BASS,
];
// The chord's fifth above the bass note, so the drone pulse stays inside the chord whatever note the bass holds.
const fifthAbove = (bass, chord) => bass + 1 + ((((chord.root + 7 - (bass + 1)) % 12) + 12) % 12);
// [0 root or 1 fifth, length] by step: a long drone note pulsing with the dum, the fifth answering the teks.
const DRONE_PULSE = { 0: [0, 3.5], 4: [0, 1], 6: [1, 1.5], 8: [0, 3], 11: [0, 1], 12: [1, 1], 14: [0, 1.5] };

// Maqsum: DUM tek . tek DUM . tek . on the eighths; the dum is the kick, the teks are high toms.
const dumDrum = ({ bar, inBar }) => {
  if (inBar === 0 || inBar === 8) return [hit('kick', null, 0, LEVEL.dum)];
  return bar % 4 === 3 && inBar === 14 ? [hit('kick', null, 0, LEVEL.dumPickup)] : [];
};

const droneBass = ({ bar, inBar, chord }) => {
  const step = DRONE_PULSE[inBar];
  if (!step) return [];
  const root = BASS[bar];
  return [hit('square', step[0] ? fifthAbove(root, chord) : root, step[1], LEVEL.bass)];
};

// Finger cymbals on the off-eighths, with a brighter ring before each dum.
const fingerCymbals = ({ inBar }) => {
  if (inBar === 6 || inBar === 14) return [hit('hat', null, 0, LEVEL.zilAccent)];
  return inBar % 4 === 2 ? [hit('hat', null, 0, LEVEL.zil)] : [];
};

const neyLead = ({ lead: line }) => (line ? [hit('saw', line.note, line.length, LEVEL.lead)] : []);

const handClap = ({ inBar }) => (inBar === 4 || inBar === 12 ? [hit('clap', null, 0, LEVEL.clap)] : []);

// The maqsum teks (eighths 1, 3 and 6), with a ghost tek on odd bars.
const TEKS = { 2: 62, 6: 62, 12: 59 };
const tekDrums = ({ bar, inBar }) => {
  if (TEKS[inBar]) return [hit('tom', TEKS[inBar], 0, LEVEL.tek)];
  return bar % 2 === 1 && inBar === 15 ? [hit('tom', 64, 0, LEVEL.tekGhost)] : [];
};

// A plucked broken chord: root, fifth, octave, third, fifth, root, in a lilting 3+3+2 rhythm.
const OUD = { 0: 0, 3: 2, 6: 3, 8: 1, 11: 2, 14: 0 };
const oudPluck = ({ inBar, chord }) => {
  if (OUD[inBar] === undefined) return [];
  const [r, third, fifth] = triadFrom(chord, 52);
  return [hit('pulse', [r, third, fifth, r + 12][OUD[inBar]], 1.8, LEVEL.oud)];
};

// A low sine sustaining the chord root under the whole bar.
const lowDrone = ({ inBar, chord }) => (inBar === 0 ? [hit('sine', rootFrom(chord, 40), 15, LEVEL.drone)] : []);

// A fifth under the lead where that lands on a chord tone; otherwise the nearest chord tone below, worked out from the line itself.
const isChordTone = (midi, chord) => chord.pcs.includes(((midi % 12) + 12) % 12);
const fifthHarmony = ({ lead: line, chord }) => {
  if (!line) return [];
  const note = isChordTone(line.note - 7, chord) ? line.note - 7 : chordToneBelow(line.note, chord, 3);
  return [hit('square', note, line.length, LEVEL.harmony)];
};

// Answers in the second half of the bar wherever the lead rests: a falling line from the chord's fifth.
const reedCounter = ({ inBar, chord, leadRests }) => {
  if (inBar % 2 !== 0 || inBar < 8 || !leadRests) return [];
  const [, , fifth] = triadFrom(chord, 69);
  return [hit('triangle', diatonic(fifth, E_PHRYGIAN_DOMINANT, -(inBar - 8) / 2), 1.8, LEVEL.counter)];
};

// A tom roll rising to the next bar at the end of every fourth bar.
const drumRoll = ({ bar, inBar }) => {
  if (bar % 4 !== 3 || inBar < 8) return [];
  const level = LEVEL.roll + ((LEVEL.rollPeak - LEVEL.roll) * (inBar - 8)) / 7;
  return [hit('tom', 45 + (inBar - 8) * 2, 0, Math.round(level * 100) / 100)];
};

export const DUNE = layeredTrack({
  id: 'dune',
  name: 'Dune',
  sections: SECTIONS,
  layers: [
    ['Dum Drum', 'kick', dumDrum],
    ['Drone Bass', 'square', droneBass],
    ['Finger Cymbals', 'hat', fingerCymbals],
    ['Saw Ney', 'saw', neyLead],
    ['Hand Clap', 'clap', handClap],
    ['Tek Drums', 'tom', tekDrums],
    ['Oud Pluck', 'pulse', oudPluck],
    ['Low Drone', 'sine', lowDrone],
    ['Fifth Harmony', 'square', fifthHarmony],
    ['Reed Counter', 'triangle', reedCounter],
    ['Drum Roll', 'tom', drumRoll],
  ],
});
