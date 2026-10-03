// Lullaby: a tender G major music-box song that rocks rather than marches. The bar is felt as 6 + 6 + 4 sixteenths
// (two slow waltz beats and a short breath): the bass and kick sway on the rock beats (steps 0, 6, 12), the shaker
// brushes the "pah-pah" between them, and the sine melody moves stepwise in long-short-long phrases.
// The final chorus keeps its key; its lead (and what follows the lead) climbs an octave like a music box winding up.
import { layeredTrack, hit, triadFrom, rootFrom, diatonic, chordToneBelow } from './compose.js';

const G_MAJOR = [7, 9, 11, 0, 2, 4, 6];
const pc = (midi) => ((midi % 12) + 12) % 12;

// Everything stays soft so the full stack is still a lullaby.
const LEVEL = {
  kick: 0.4, kickSoft: 0.26, bass: 0.42, shaker: 0.07, shakerSoft: 0.05, lead: 0.3, rim: 0.15, rimSoft: 0.09,
  tom: 0.12, harp: 0.1, rocking: 0.2, harmony: 0.12, counter: 0.1, chime: 0.08,
};

// Eight eighth-note slots per bar, as MIDI notes; 0 is a rest. Slots 0, 3 and 6 are the rock beats.
const VERSE = [
  [71, 0, 72, 74, 0, 0, 71, 0], // G   B C D . B
  [71, 0, 69, 67, 0, 0, 71, 0], // Em  B A G . B
  [72, 0, 71, 69, 0, 0, 67, 0], // C   C B A . G
  [69, 0, 71, 69, 0, 0, 66, 0], // D   A B A . F#
  [71, 0, 72, 74, 0, 0, 76, 74], // G  B C D . E D
  [72, 0, 74, 76, 0, 0, 72, 0], // C   C D E . C
  [74, 0, 72, 71, 0, 0, 69, 0], // D   D C B . A
  [67, 0, 0, 0, 0, 0, 0, 0], // G     home
];
const CHORUS = [
  [76, 0, 0, 79, 0, 0, 76, 0], // C   E . G . E
  [78, 0, 0, 81, 0, 0, 78, 0], // D   F# . A . F#
  [79, 0, 78, 76, 0, 0, 74, 0], // G  G F# E . D
  [76, 0, 74, 71, 0, 0, 67, 0], // Em E D B . G
  [76, 0, 0, 79, 0, 0, 76, 0], // C   E . G . E
  [78, 0, 0, 81, 0, 0, 78, 74], // D  F# . A . F# D
  [79, 0, 0, 74, 0, 0, 71, 0], // G   G . D . B
  [71, 0, 69, 67, 0, 0, 0, 0], // G   B A G
];
const BRIDGE = [
  [76, 0, 0, 74, 0, 0, 71, 0], // Em  E . D . B
  [72, 0, 0, 71, 0, 0, 69, 0], // Am  C . B . A
  [74, 0, 0, 78, 0, 0, 81, 0], // D   D . F# . A
  [79, 0, 0, 0, 0, 0, 74, 0], // G    G ... D
];

const CHORUS_CHORDS = ['C', 'D', 'G', 'Em', 'C', 'D', 'G', 'G'];

// 4 + 8 + 8 + 4 + 8 = 32 bars.
export const SECTIONS = [
  { name: 'intro', bars: 4, chords: ['G', 'C', 'D', 'G'], melody: null, transpose: 0 },
  { name: 'verse', bars: 8, chords: ['G', 'Em', 'C', 'D', 'G', 'C', 'D', 'G'], melody: VERSE, transpose: 0 },
  { name: 'chorus', bars: 8, chords: CHORUS_CHORDS, melody: CHORUS, transpose: 0 },
  { name: 'bridge', bars: 4, chords: ['Em', 'Am', 'D', 'G'], melody: BRIDGE, transpose: 0 },
  { name: 'finale', bars: 8, chords: CHORUS_CHORDS, melody: CHORUS.map((bar) => bar.map((n) => (n ? n + 12 : 0))), transpose: 0 },
];

// The bass sits low, and lifts a little for the final chorus so the ending glows.
const bassFloor = (section) => (section === 'finale' ? 45 : 40);

const SHAKER = { 2: LEVEL.shaker, 4: LEVEL.shakerSoft, 8: LEVEL.shaker, 10: LEVEL.shakerSoft, 14: LEVEL.shakerSoft };
// A lilting 3 + 3 + 3 + 3 + 4 tap, alternating bars.
const LILT = [{ 9: 57, 15: 52 }, { 3: 57, 9: 55, 15: 52 }];
// Broken chord, up and back across each rock: root third fifth, root third fifth, octave fifth.
const HARP = { 0: 0, 2: 1, 4: 2, 6: 0, 8: 1, 10: 2, 12: 3, 14: 2 };
const HEARTBEAT = [{}, { 12: [45, 0.16], 14: [43, 0.12] }, {}, { 8: [48, 0.12], 10: [45, 0.15], 12: [45, 0.18], 14: [43, 0.14] }];

// A very soft kick on the first two rock beats.
const softKick = ({ inBar }) => {
  if (inBar === 0) return [hit('kick', null, 0, LEVEL.kick)];
  return inBar === 6 ? [hit('kick', null, 0, LEVEL.kickSoft)] : [];
};

// Root, fifth, octave on the rock beats: a cradle swaying.
const warmBass = ({ inBar, chord, section }) => {
  const r = rootFrom(chord, bassFloor(section));
  if (inBar === 0) return [hit('triangle', r, 5.5, LEVEL.bass)];
  if (inBar === 6) return [hit('triangle', r + 7, 5.5, LEVEL.bass * 0.85)];
  return inBar === 12 ? [hit('triangle', r + 12, 3.5, LEVEL.bass * 0.75)] : [];
};

const brushShaker = ({ inBar }) => (SHAKER[inBar] ? [hit('shaker', null, 0, SHAKER[inBar])] : []);

const musicBoxLead = ({ lead: line }) => (line ? [hit('sine', line.note, line.length, LEVEL.lead)] : []);

// A rim tap on the third rock beat, a lighter one on the second.
const rimTap = ({ inBar }) => {
  if (inBar === 12) return [hit('clap', null, 0, LEVEL.rim)];
  return inBar === 6 ? [hit('clap', null, 0, LEVEL.rimSoft)] : [];
};

const liltToms = ({ bar, inBar }) => {
  const note = LILT[bar % 2][inBar];
  return note ? [hit('tom', note, 0, LEVEL.tom)] : [];
};

const harpPluck = ({ inBar, chord }) => {
  if (HARP[inBar] === undefined) return [];
  const [r, third, fifth] = triadFrom(chord, 55);
  return [hit('sine', [r, third, fifth, r + 12][HARP[inBar]], 1.8, LEVEL.harp)];
};

// Octave, fifth, third falling against the warm bass's rising root-fifth-octave.
const rockingBass = ({ inBar, chord, section }) => {
  const r = rootFrom(chord, bassFloor(section));
  const notes = { 0: r + 12, 6: r + 7, 12: r + chord.third };
  return notes[inBar] === undefined ? [] : [hit('sine', notes[inBar], 5, LEVEL.rocking)];
};

// A diatonic third under every lead note, worked out from the melody line itself.
const celestaHarmony = ({ lead: line }) =>
  line ? [hit('triangle', diatonic(line.note, G_MAJOR, -2), line.length, LEVEL.harmony)] : [];

// A sixth under the lead on the second and third rock beats (the nearest chord tone if the sixth would clash);
// in the intro, with no melody yet, it chimes the chord's third and fifth on those beats instead.
const chimeCounter = ({ inBar, chord, lead: line }) => {
  if (inBar !== 6 && inBar !== 12) return [];
  if (!line) {
    const [, third, fifth] = triadFrom(chord, 72);
    return [hit('sine', inBar === 6 ? third : fifth, 5, LEVEL.chime)];
  }
  const sixth = diatonic(line.note, G_MAJOR, -5);
  const note = chord.pcs.includes(pc(sixth)) ? sixth : chordToneBelow(line.note, chord, 7);
  return [hit('sine', note, 5, LEVEL.counter)];
};

// A soft tom heartbeat, lub-dub at the end of every second bar and a longer one into every fourth.
const heartbeatFill = ({ bar, inBar }) => {
  const beat = HEARTBEAT[bar % 4][inBar];
  return beat ? [hit('tom', beat[0], 0, beat[1])] : [];
};

export const LULLABY = layeredTrack({
  id: 'lullaby',
  name: 'Lullaby',
  sections: SECTIONS,
  layers: [
    ['Soft Kick', 'kick', softKick],
    ['Warm Bass', 'triangle', warmBass],
    ['Brush Shaker', 'shaker', brushShaker],
    ['Music Box Lead', 'sine', musicBoxLead],
    ['Rim Tap', 'clap', rimTap],
    ['Lilt Toms', 'tom', liltToms],
    ['Harp Pluck', 'sine', harpPluck],
    ['Rocking Bass', 'sine', rockingBass],
    ['Celesta Harmony', 'triangle', celestaHarmony],
    ['Chime Counter', 'sine', chimeCounter],
    ['Heartbeat Fill', 'tom', heartbeatFill],
  ],
});
