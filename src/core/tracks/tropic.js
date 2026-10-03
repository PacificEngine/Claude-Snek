// Tropic: a relaxed C major calypso groove. The kick lands on 1, the 'and' of 2 and beat 3, a skipping root-fifth bass
// picks up into each bar, shaker sixteenths lean on the off-beats, bongos answer and a sine steel drum plucks the tune.
// The chorus borrows a Bb (Mixolydian colour), the bridge lifts through Dm G Em A, and the finale sings a whole tone up.
import { layeredTrack, hit, triadFrom, rootFrom, diatonic, transposeScale, chordToneBelow, fromPattern } from './compose.js';

const C_MAJOR = [0, 2, 4, 5, 7, 9, 11];

const LEVEL = {
  kick: 0.8, kickPush: 0.5, bass: 0.42, shaker: 0.05, shakerAccent: 0.1, lead: 0.28, clap: 0.22, clapGhost: 0.1,
  bongo: 0.2, pluck: 0.1, pluckAccent: 0.14, walk: 0.26, harmony: 0.13, bell: 0.11,
};

// Eight eighth-note slots per bar, as MIDI notes; 0 is a rest.
const VERSE = [
  [67, 0, 72, 0, 0, 76, 0, 74], // C
  [72, 0, 69, 0, 0, 72, 0, 0], // F
  [71, 0, 74, 0, 0, 71, 67, 0], // G
  [72, 0, 0, 0, 64, 0, 67, 0], // C
  [69, 0, 72, 0, 0, 76, 0, 74], // Am
  [72, 0, 69, 0, 0, 65, 69, 0], // F
  [67, 0, 72, 0, 76, 0, 79, 0], // C
  [77, 0, 0, 74, 0, 71, 0, 0], // G
];
const CHORUS = [
  [81, 81, 0, 77, 0, 72, 0, 77], // F
  [79, 0, 77, 0, 74, 0, 71, 0], // G
  [76, 76, 0, 79, 0, 76, 72, 0], // C
  [76, 0, 72, 0, 69, 0, 0, 0], // Am
  [81, 81, 0, 77, 0, 72, 0, 77], // F
  [82, 0, 77, 0, 74, 0, 70, 0], // Bb
  [79, 0, 76, 0, 72, 0, 76, 79], // C
  [79, 0, 0, 0, 74, 0, 71, 0], // G
];
// The last chorus resolves home instead of turning back to G.
const FINALE = [...CHORUS.slice(0, 7), [72, 0, 0, 0, 0, 0, 0, 0]];
const BRIDGE = [
  [74, 0, 0, 77, 0, 81, 0, 0], // Dm
  [79, 0, 0, 74, 0, 71, 0, 0], // G
  [76, 0, 0, 79, 0, 83, 0, 0], // Em
  [81, 0, 0, 76, 0, 73, 0, 69], // A
];

// 4 + 8 + 8 + 4 + 8 = 32 bars.
const SECTIONS = [
  { name: 'intro', bars: 4, chords: ['C', 'F', 'G', 'C'], melody: null, transpose: 0 },
  { name: 'verse', bars: 8, chords: ['C', 'F', 'G', 'C', 'Am', 'F', 'C', 'G'], melody: VERSE, transpose: 0 },
  { name: 'chorus', bars: 8, chords: ['F', 'G', 'C', 'Am', 'F', 'Bb', 'C', 'G'], melody: CHORUS, transpose: 0 },
  { name: 'bridge', bars: 4, chords: ['Dm', 'G', 'Em', 'A'], melody: BRIDGE, transpose: 0 },
  { name: 'finale', bars: 8, chords: ['F', 'G', 'C', 'Am', 'F', 'Bb', 'C', 'C'], melody: FINALE, transpose: 2 },
];

const BASS_FLOOR = 40;
// [semitones above the root, length in steps]: root with the kick, a skip on the 'a' of 1, the fifth on beat 3,
// and an octave pickup into the next bar.
const BASS_SKIP = { 0: [0, 2.5], 3: [0, 0.8], 6: [0, 1.5], 8: [7, 2.5], 11: [7, 0.8], 14: [12, 1.5] };
const BONGOS = [{ 3: 69, 7: 64, 10: 69, 11: 69, 15: 64 }, { 3: 69, 5: 64, 10: 69, 13: 64, 15: 69 }];
const CONGAS = { 10: [55, 0.14], 11: [57, 0.16], 12: [60, 0.18], 13: [62, 0.2], 14: [64, 0.24], 15: [67, 0.28] };
const PLUCK_ORDER = [0, 2, 1, 2, 3, 2, 1, 2];
const BELL_ORDER = [3, 2, 1, 2];
const BUSY = ['chorus', 'finale'];

const kick = ({ inBar, section }) => {
  if ([0, 6, 8].includes(inBar)) return [hit('kick', null, 0, LEVEL.kick)];
  return inBar === 14 && BUSY.includes(section) ? [hit('kick', null, 0, LEVEL.kickPush)] : [];
};

const islandBass = ({ inBar, chord }) => fromPattern(BASS_SKIP, inBar, rootFrom(chord, BASS_FLOOR), 'triangle', LEVEL.bass);

const shaker = ({ inBar }) => [hit('shaker', null, 0, inBar % 4 === 2 ? LEVEL.shakerAccent : LEVEL.shaker)];

// Steel drum: short plucks, so long melody notes are struck and left to ring out briefly.
const steelLead = ({ lead: line }) => (line ? [hit('sine', line.note, Math.min(line.length, 2), LEVEL.lead)] : []);

// Woodblock-like rim claps on the backbeat, with a ghost on the 'and' of 3.
const rimClap = ({ inBar }) => {
  if (inBar === 4 || inBar === 12) return [hit('clap', null, 0, LEVEL.clap)];
  return inBar === 10 ? [hit('clap', null, 0, LEVEL.clapGhost)] : [];
};

const bongos = ({ bar, inBar }) => {
  const note = BONGOS[bar % 2][inBar];
  return note ? [hit('tom', note, 0, LEVEL.bongo)] : [];
};

// Eighth notes around the chord, louder on the off-beats like a strummed calypso guitar.
const marimbaPluck = ({ inBar, chord }) => {
  if (inBar % 2 !== 0) return [];
  const [r, third, fifth] = triadFrom(chord, 60);
  const level = inBar % 4 === 2 ? LEVEL.pluckAccent : LEVEL.pluck;
  return [hit('triangle', [r, third, fifth, r + 12][PLUCK_ORDER[inBar / 2]], 0.8, level)];
};

// Quarter notes root, third, fifth, then the scale step above the next bar's root, leading into it.
const walkingBass = ({ inBar, chord, next, transpose }) => {
  if (inBar % 4 !== 0) return [];
  const r = rootFrom(chord, BASS_FLOOR);
  const approach = diatonic(rootFrom(next, BASS_FLOOR), transposeScale(C_MAJOR, transpose), 1);
  return [hit('square', [r, r + chord.third, r + 7, approach][inBar / 4], 3, LEVEL.walk)];
};

// A chord tone a third or more under the lead, worked out from the melody line itself.
const harmony = ({ lead: line, chord }) =>
  line ? [hit('triangle', chordToneBelow(line.note, chord, 3), Math.min(line.length, 2), LEVEL.harmony)] : [];

// High chord tones on the beats where the lead rests: an answer to the melody (and a chime in the intro).
const bellCounter = ({ inBar, chord, leadRests }) => {
  if (inBar % 4 !== 0 || !leadRests) return [];
  const [r, third, fifth] = triadFrom(chord, 76);
  return [hit('sine', [r, third, fifth, r + 12][BELL_ORDER[inBar / 4]], 2.5, LEVEL.bell)];
};

// A rising conga run into every fourth bar.
const congaFill = ({ bar, inBar }) => {
  const stroke = bar % 4 === 3 && CONGAS[inBar];
  return stroke ? [hit('tom', stroke[0], 0, stroke[1])] : [];
};

export const TROPIC = layeredTrack({
  id: 'tropic',
  name: 'Tropic',
  sections: SECTIONS,
  layers: [
    ['Kick', 'kick', kick],
    ['Island Bass', 'triangle', islandBass],
    ['Shaker', 'shaker', shaker],
    ['Steel Drum Lead', 'sine', steelLead],
    ['Rim Clap', 'clap', rimClap],
    ['Bongos', 'tom', bongos],
    ['Marimba Pluck', 'triangle', marimbaPluck],
    ['Walking Bass', 'square', walkingBass],
    ['Triangle Harmony', 'triangle', harmony],
    ['Bell Counter', 'sine', bellCounter],
    ['Conga Fill', 'tom', congaFill],
  ],
});
