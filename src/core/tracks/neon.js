// Neon: a driving E minor synthwave loop. Four-on-the-floor kick, a saw bass pumping root and octave in eighths,
// claps on two and four, gated sixteenth hats and a soaring pulse lead with a dotted-eighth echo. The bridge lifts
// through Cmaj7 / D / Em / B, and the final chorus comes back a whole tone higher (F# minor).
import { layeredTrack, hit, momentOf, triadFrom, rootFrom, chordToneBelow } from './compose.js';

const LEVEL = {
  kick: 0.8, bass: 0.32, hatAccent: 0.1, hatSoft: 0.06, lead: 0.3, clap: 0.4, openHat: 0.12,
  arp: 0.1, sub: 0.3, harmony: 0.1, echo: 0.1, fill: 0.3,
};

// Eight eighth-note slots per bar, as MIDI notes; 0 is a rest.
const VERSE = [
  [64, 0, 67, 0, 71, 0, 69, 67], // Em
  [72, 0, 0, 0, 71, 0, 67, 0], // C
  [67, 0, 71, 0, 74, 0, 72, 71], // G
  [69, 0, 0, 0, 66, 0, 0, 0], // D
  [64, 0, 67, 0, 71, 0, 76, 0], // Em
  [76, 0, 0, 74, 72, 0, 71, 0], // C
  [74, 0, 71, 0, 67, 0, 71, 74], // G
  [78, 0, 0, 74, 0, 0, 72, 76], // D
];
const CHORUS = [
  [81, 0, 0, 79, 0, 76, 0, 0], // Am
  [79, 0, 0, 76, 0, 72, 0, 74], // C
  [78, 0, 0, 74, 0, 69, 0, 78], // D
  [79, 0, 0, 0, 78, 0, 76, 0], // Em
  [81, 0, 0, 79, 0, 76, 0, 81], // Am
  [84, 0, 0, 83, 0, 79, 0, 76], // C
  [81, 0, 0, 78, 0, 74, 0, 78], // D
  [76, 0, 0, 0, 0, 0, 0, 0], // Em
];
// The B on the downbeat over C is the major seventh of the Cmaj7; the last bar spells B major with its D#.
const BRIDGE = [
  [71, 0, 0, 0, 76, 0, 79, 0], // Cmaj7
  [78, 0, 0, 0, 81, 0, 78, 0], // D
  [79, 0, 0, 0, 83, 0, 79, 76], // Em
  [78, 0, 0, 75, 0, 0, 71, 0], // B
];

const CHORUS_CHORDS = ['Am', 'C', 'D', 'Em', 'Am', 'C', 'D', 'Em'];

// 4 + 8 + 8 + 4 + 8 = 32 bars. The finale is the chorus a whole tone up (Bm D E F#m), lead and all.
export const SECTIONS = [
  { name: 'intro', bars: 4, chords: ['Em', 'C', 'G', 'D'], melody: null, transpose: 0 },
  { name: 'verse', bars: 8, chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D'], melody: VERSE, transpose: 0 },
  { name: 'chorus', bars: 8, chords: CHORUS_CHORDS, melody: CHORUS, transpose: 0 },
  { name: 'bridge', bars: 4, chords: ['C', 'D', 'Em', 'B'], melody: BRIDGE, transpose: 0 },
  { name: 'finale', bars: 8, chords: CHORUS_CHORDS, melody: CHORUS, transpose: 2 },
];

const BASS_FLOOR = 36;
const ECHO_DELAY = 3; // a dotted eighth
const FILL = { 12: 50, 13: 47, 14: 45, 15: 43 };
// Which triad tone (root, third, fifth, top) the arp plays on each sixteenth: up, down and up again.
const ARP = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];
const OPEN_HAT_STEPS = [2, 6, 10, 14];

// Four on the floor.
const kick = ({ inBar }) => (inBar % 4 === 0 ? [hit('kick', null, 0, LEVEL.kick)] : []);

// Straight eighths pumping between the root and its octave.
const sawBass = ({ inBar, chord }) => {
  if (inBar % 2 !== 0) return [];
  const root = rootFrom(chord, BASS_FLOOR);
  return [hit('saw', inBar % 4 === 0 ? root : root + 12, 1.8, LEVEL.bass)];
};

// Every sixteenth, accented on the eighths so it sounds gated against the pump.
const closedHat = ({ inBar }) => [hit('hat', null, 0, inBar % 2 === 0 ? LEVEL.hatAccent : LEVEL.hatSoft)];

const lead = ({ lead: line }) => (line ? [hit('pulse', line.note, line.length, LEVEL.lead)] : []);

const clap = ({ inBar }) => (inBar === 4 || inBar === 12 ? [hit('clap', null, 0, LEVEL.clap)] : []);

const openHat = ({ inBar }) => (OPEN_HAT_STEPS.includes(inBar) ? [hit('hat', null, 0, LEVEL.openHat)] : []);

// Sixteenth arpeggio over the chord; in the bridge the C chord gets its major seventh on top.
const arp = ({ inBar, chord, section }) => {
  const [r, third, fifth] = triadFrom(chord, 59);
  const top = section === 'bridge' && chord.root === 0 && chord.third === 4 ? r + 11 : r + 12;
  return [hit('square', [r, third, fifth, top][ARP[inBar]], 0.9, LEVEL.arp)];
};

// A sine under the pump: the root on one and three, then a pickup to the next bar's root.
const subBass = ({ inBar, chord, next }) => {
  if (inBar === 0) return [hit('sine', rootFrom(chord, BASS_FLOOR), 7, LEVEL.sub)];
  if (inBar === 8) return [hit('sine', rootFrom(chord, BASS_FLOOR), 5, LEVEL.sub)];
  if (inBar === 14) return [hit('sine', rootFrom(next, BASS_FLOOR), 2, LEVEL.sub)];
  return [];
};

// The nearest chord tone under the lead, worked out from the melody line itself.
const harmony = ({ lead: line, chord }) =>
  line ? [hit('pulse', chordToneBelow(line.note, chord), line.length, LEVEL.harmony)] : [];

// The lead again a dotted eighth later, softer: the delay every synthwave lead trails. It reads the melody itself,
// and drops an echo that would spill over the barline onto a note outside the new chord.
const echoLead = ({ step, inBar, chord }) => {
  const earlier = momentOf(SECTIONS, step - ECHO_DELAY).lead;
  if (!earlier) return [];
  if (inBar < ECHO_DELAY && !chord.pcs.includes(earlier.note % 12)) return [];
  return [hit('triangle', earlier.note, Math.min(earlier.length, 2.5), LEVEL.echo)];
};

// Toms rolling down the kit at the end of every fourth bar.
const tomFill = ({ bar, inBar }) => (bar % 4 === 3 && FILL[inBar] ? [hit('tom', FILL[inBar], 0, LEVEL.fill)] : []);

export const NEON = layeredTrack({
  id: 'neon',
  name: 'Neon',
  sections: SECTIONS,
  layers: [
    ['Kick', 'kick', kick],
    ['Saw Bass', 'saw', sawBass],
    ['Closed Hat', 'hat', closedHat],
    ['Pulse Lead', 'pulse', lead],
    ['Clap', 'clap', clap],
    ['Open Hat', 'hat', openHat],
    ['Square Arp', 'square', arp],
    ['Sub Bass', 'sine', subBass],
    ['Neon Harmony', 'pulse', harmony],
    ['Echo Lead', 'triangle', echoLead],
    ['Tom Fill', 'tom', tomFill],
  ],
});
