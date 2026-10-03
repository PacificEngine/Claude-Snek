// Disco: a four-on-the-floor A minor funk loop. A kick on every beat, open hats on the "and", claps on 2 and 4, a
// syncopated Chic-style saw bass with octave jumps and ghost-note rests, a stabbing pulse lead with string sixths under it,
// chicken-scratch sixteenths and brass stabs that answer the lead. Verse vamps Am7 D7 Gmaj7 Cmaj7 (A dorian), the chorus
// turns to Am7 Dm7 G7 Cmaj7, the bridge builds over Fmaj7 E7 Am7 E7 and the final chorus lifts a whole tone into B minor.
import { layeredTrack, hit, rootFrom, diatonic, transposeScale } from './compose.js';

const DORIAN = [9, 11, 0, 2, 4, 6, 7];
const NATURAL_MINOR = [9, 11, 0, 2, 4, 5, 7];
const MELODIC_MINOR = [9, 11, 0, 2, 4, 6, 8]; // over E7: F# and G#, so nothing clashes with the dominant

const LEVEL = {
  kick: 0.75, bass: 0.42, openHat: 0.16, lead: 0.24, clap: 0.3, closedHat: 0.06, closedAccent: 0.1,
  scratch: 0.08, scratchAccent: 0.12, octave: 0.22, strings: 0.13, brass: 0.14,
};

// Eight eighth-note slots per bar, as MIDI notes; 0 is a rest.
const VERSE = [
  [76, 0, 76, 74, 0, 72, 74, 0], // Am7
  [72, 0, 69, 0, 66, 69, 72, 0], // D7
  [71, 0, 74, 0, 78, 0, 74, 71], // Gmaj7
  [72, 71, 72, 0, 76, 0, 0, 0], // Cmaj7
  [76, 0, 76, 74, 0, 72, 74, 76], // Am7
  [78, 0, 74, 0, 72, 0, 69, 0], // D7
  [71, 0, 74, 78, 0, 79, 78, 74], // Gmaj7
  [76, 0, 0, 72, 0, 71, 0, 0], // Cmaj7
];
const CHORUS = [
  [81, 81, 0, 79, 0, 76, 0, 79], // Am7
  [77, 77, 0, 76, 0, 74, 0, 72], // Dm7
  [74, 74, 0, 77, 0, 79, 0, 74], // G7
  [76, 0, 72, 0, 71, 0, 72, 0], // Cmaj7
  [81, 81, 0, 79, 0, 76, 0, 84], // Am7
  [84, 0, 81, 0, 77, 0, 81, 0], // Dm7
  [79, 0, 77, 0, 74, 0, 71, 0], // G7
  [72, 0, 0, 0, 76, 0, 71, 0], // Cmaj7
];
const BRIDGE = [
  [76, 0, 0, 0, 72, 0, 69, 0], // Fmaj7
  [71, 0, 0, 0, 68, 0, 71, 0], // E7
  [72, 0, 0, 0, 76, 0, 79, 0], // Am7
  [71, 0, 74, 0, 76, 0, 80, 0], // E7
];

const CHORUS_CHORDS = ['Am', 'Dm', 'G', 'C', 'Am', 'Dm', 'G', 'C'];

// 4 + 8 + 8 + 4 + 8 = 32 bars. Chord names are triads; each layer adds the seventh from the bar's scale (see seventhOf).
const SECTIONS = [
  { name: 'intro', bars: 4, chords: ['Am', 'D', 'Am', 'D'], melody: null, transpose: 0 },
  { name: 'verse', bars: 8, chords: ['Am', 'D', 'G', 'C'], melody: VERSE, transpose: 0 },
  { name: 'chorus', bars: 8, chords: CHORUS_CHORDS, melody: CHORUS, transpose: 0 },
  { name: 'bridge', bars: 4, chords: ['F', 'E', 'Am', 'E'], melody: BRIDGE, transpose: 0 },
  { name: 'finale', bars: 8, chords: CHORUS_CHORDS, melody: CHORUS, transpose: 2 },
];

const pc = (midi) => ((midi % 12) + 12) % 12;

// The scale of one bar: dorian for the intro and verse vamp, natural minor elsewhere, melodic minor over the E7 (the V).
function scaleOf({ section, chord, transpose }) {
  const dominant = chord.root === pc(4 + transpose) && chord.third === 4;
  const base = dominant ? MELODIC_MINOR : section === 'intro' || section === 'verse' ? DORIAN : NATURAL_MINOR;
  return transposeScale(base, transpose);
}

// The diatonic seventh above the root: Am7, D7, Gmaj7, Cmaj7 in dorian; Dm7, G7, Fmaj7 in minor; E7 in melodic minor.
const seventhOf = (moment, root) => diatonic(root, scaleOf(moment), 6);

const BASS_FLOOR = 40;
const OCTAVE_FLOOR = 36;

// Four on the floor; the last half of the bridge drops the kick out for the build into the final chorus.
const kick = ({ inBar, bar }) => (inBar % 4 === 0 && !(bar === 23 && inBar >= 8) ? [hit('kick', null, 0, LEVEL.kick)] : []);

// A Chic-style line: root, octave pops and ghost rests; odd bars walk up to the next root from the step above it.
const funkBass = (moment) => {
  const { inBar, bar, chord, next } = moment;
  const r = rootFrom(chord, BASS_FLOOR);
  const seventh = seventhOf(moment, r);
  const answer = {
    0: [r, 1.5], 3: [r + 12, 0.6], 4: [r, 0.9], 6: [seventh, 0.9], 7: [r + 12, 0.6],
    10: [r, 0.9], 11: [r + 12, 0.6], 12: [r + 7, 1.4], 14: [r, 0.9], 15: [r + 12, 0.5],
  };
  const walk = {
    0: [r, 1.5], 3: [r + 12, 0.6], 4: [r, 0.9], 7: [r + 7, 0.6], 8: [seventh, 0.9], 10: [r + 12, 0.6],
    12: [r + 7, 0.9], 14: [diatonic(rootFrom(next, BASS_FLOOR), scaleOf(moment), 1), 0.9],
  };
  const note = (bar % 2 === 0 ? answer : walk)[inBar];
  return note ? [hit('saw', note[0], note[1], LEVEL.bass)] : [];
};

// The disco "tss" on the and of every beat.
const openHat = ({ inBar }) => (inBar % 4 === 2 ? [hit('hat', null, 0, LEVEL.openHat)] : []);

const lead = ({ lead: line }) => (line ? [hit('pulse', line.note, line.length, LEVEL.lead)] : []);

const clap = ({ inBar }) => (inBar === 4 || inBar === 12 ? [hit('clap', null, 0, LEVEL.clap)] : []);

// Tight sixteenths around the open hat, a little louder on the "a" before each beat.
const closedHat = ({ inBar }) => {
  if (inBar % 4 === 2) return [];
  return [hit('hat', null, 0, inBar % 4 === 3 ? LEVEL.closedAccent : LEVEL.closedHat)];
};

// Chicken scratch: muted off-sixteenths on the chord's third and seventh, accented on the e of beats 2 and 4.
const scratchGuitar = (moment) => {
  const { inBar, chord } = moment;
  if (inBar % 2 === 0) return [];
  const r = rootFrom(chord, 57);
  const note = inBar % 4 === 1 ? r + chord.third : seventhOf(moment, r);
  return [hit('square', note, 0.35, inBar === 5 || inBar === 13 ? LEVEL.scratchAccent : LEVEL.scratch)];
};

// The classic octave-pumping disco bass: low root on the beat, its octave on the and.
const octaveBass = ({ inBar, chord }) => {
  if (inBar % 2 !== 0) return [];
  const r = rootFrom(chord, OCTAVE_FLOOR);
  return [hit('sine', inBar % 4 === 0 ? r : r + 12, 1.6, LEVEL.octave)];
};

// String-like sixths under the lead, worked out from the melody line itself.
const stringHarmony = (moment) => {
  const { lead: line } = moment;
  return line ? [hit('triangle', diatonic(line.note, scaleOf(moment), -5), line.length, LEVEL.strings)] : [];
};

// Short brass stabs on the late eighths where the lead rests: seventh, fifth, third, high up.
const BRASS_STEPS = { 6: 'seventh', 10: 'fifth', 14: 'third' };
const brassCounter = (moment) => {
  const { inBar, chord, leadRests } = moment;
  if (!BRASS_STEPS[inBar] || !leadRests) return [];
  const r = rootFrom(chord, 67);
  const note = { seventh: seventhOf(moment, r), fifth: r + 7, third: r + chord.third }[BRASS_STEPS[inBar]];
  return [hit('saw', note, 0.8, LEVEL.brass)];
};

// Falling toms into every fourth bar; across the bridge a rising build, ending in a sixteenth-note tom crescendo.
const FILL = { 10: [57, 0.16], 12: [52, 0.2], 13: [50, 0.22], 14: [47, 0.25], 15: [45, 0.28] };
const tomFill = ({ bar, inBar }) => {
  if (bar === 23) return inBar >= 4 ? [hit('tom', 45 + inBar, 0, 0.1 + inBar * 0.012)] : [];
  if (bar >= 20 && bar <= 22) return inBar % 4 === 0 ? [hit('tom', 45 + (bar - 20) * 3, 0, 0.12 + (bar - 20) * 0.04)] : [];
  if (bar % 4 === 3 && FILL[inBar]) return [hit('tom', FILL[inBar][0], 0, FILL[inBar][1])];
  return [];
};

export const DISCO = layeredTrack({
  id: 'disco',
  name: 'Disco',
  sections: SECTIONS,
  layers: [
    ['Four-on-the-Floor Kick', 'kick', kick],
    ['Funk Bass', 'saw', funkBass],
    ['Open Hat', 'hat', openHat],
    ['Synth Lead', 'pulse', lead],
    ['Clap', 'clap', clap],
    ['Closed Hat', 'hat', closedHat],
    ['Scratch Guitar', 'square', scratchGuitar],
    ['Octave Bass', 'sine', octaveBass],
    ['String Harmony', 'triangle', stringHarmony],
    ['Brass Stab Counter', 'saw', brassCounter],
    ['Tom Fill', 'tom', tomFill],
  ],
});
