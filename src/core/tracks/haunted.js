// Haunted: a sparse, eerie C# minor loop with harmonic-minor colour (the B# leading tone over G#) and a Neapolitan D.
// A slow heartbeat kick and a low triangle drone leave space; a high sine music box falls in chromatic fragments,
// a quiet square shadows it a minor second below on the downbeats, and the bridge hangs on E#dim (spelled Fdim).
import { hit, layeredTrack, momentOf, rootFrom, chordToneBelow } from './compose.js';

const LEVEL = {
  kick: 0.85, kickGhost: 0.35, drone: 0.36, droneSoft: 0.26, shaker: 0.1, shakerGhost: 0.06, lead: 0.3, snare: 0.32,
  snareGhost: 0.08, tom: 0.24, pluck: 0.08, sub: 0.3, harmony: 0.08, echo: 0.07, roll: 0.26,
};

// Eight eighth-note slots per bar, as MIDI notes; 0 is a rest. High register, few notes, room between them.
const VERSE = [
  [80, 0, 0, 0, 79, 78, 76, 0], // C#m  G# . G F# E
  [81, 0, 80, 0, 0, 76, 0, 0], // A
  [85, 0, 0, 0, 81, 0, 78, 0], // F#m
  [87, 86, 85, 84, 0, 0, 0, 0], // G#  D# D C# B#
  [85, 0, 0, 0, 80, 0, 0, 0], // C#m
  [87, 0, 0, 0, 83, 0, 78, 0], // B
  [81, 0, 80, 0, 79, 0, 76, 0], // A   A G# G E
  [75, 0, 0, 0, 0, 0, 72, 0], // G#  D# .. B#
];
const CHORUS = [
  [88, 0, 0, 87, 86, 85, 0, 0], // A   E D# D C#
  [90, 0, 0, 0, 87, 0, 83, 0], // B
  [88, 0, 0, 0, 83, 0, 80, 0], // E
  [85, 0, 0, 0, 0, 0, 80, 0], // C#m
  [85, 0, 84, 0, 83, 0, 81, 0], // F#m C# B# B A
  [86, 0, 0, 0, 81, 0, 78, 0], // D
  [87, 0, 86, 0, 85, 0, 84, 0], // G#  D# D C# B#
  [80, 0, 0, 0, 0, 0, 0, 0], // G#
];
const BRIDGE = [
  [83, 0, 0, 0, 80, 0, 77, 0], // Fdim B G# E#
  [84, 0, 0, 0, 80, 0, 0, 0], // G#
  [76, 0, 0, 0, 73, 0, 0, 0], // C#m
  [75, 0, 0, 0, 72, 0, 0, 0], // G#
];

// compose.js names G# as Ab; the bridge's 'Fm' is played as Fdim (E# G# B) by `triadOf` below.
const CHORUS_CHORDS = ['A', 'B', 'E', 'C#m', 'F#m', 'D', 'Ab', 'Ab'];

// 4 + 8 + 8 + 4 + 8 = 32 bars. The final chorus keeps its chords; its lead (and what follows the lead) goes up an octave.
const SECTIONS = [
  { name: 'intro', bars: 4, chords: ['C#m', 'C#m', 'D', 'Ab'], melody: null, transpose: 0 },
  { name: 'verse', bars: 8, chords: ['C#m', 'A', 'F#m', 'Ab', 'C#m', 'B', 'A', 'Ab'], melody: VERSE, transpose: 0 },
  { name: 'chorus', bars: 8, chords: CHORUS_CHORDS, melody: CHORUS, transpose: 0 },
  { name: 'bridge', bars: 4, chords: ['Fm', 'Ab', 'C#m', 'Ab'], melody: BRIDGE, transpose: 0 },
  { name: 'finale', bars: 8, chords: CHORUS_CHORDS, melody: CHORUS.map((bar) => bar.map((n) => (n ? n + 12 : 0))), transpose: 0 },
];

const isDim = ({ section, chord }) => section === 'bridge' && chord.root === 5;
const tonesOf = (m) => (isDim(m) ? [5, 8, 11] : m.chord.pcs);
const triadOf = (m, floor) => {
  const r = rootFrom(m.chord, floor);
  return [r, r + m.chord.third, r + (isDim(m) ? 6 : 7)];
};

const BASS_FLOOR = 37;
const TOMS = [{ 4: 45 }, { 4: 45, 10: 41 }];
const PLUCK = { 2: 0, 6: 1, 10: 2, 14: 3 };
const ROLL = { 11: 50, 13: 47, 14: 45, 15: 41 };

// A slow heartbeat: one, and a ghost on the 'a' of two.
const heartbeat = ({ inBar }) => {
  if (inBar === 0) return [hit('kick', null, 0, LEVEL.kick)];
  return inBar === 7 ? [hit('kick', null, 0, LEVEL.kickGhost)] : [];
};

// The root held, struck again on three, then a semitone below the next root to lean into the change.
const droneBass = ({ inBar, chord, next }) => {
  const root = rootFrom(chord, BASS_FLOOR);
  if (inBar === 0) return [hit('triangle', root, 7, LEVEL.drone)];
  if (inBar === 8) return [hit('triangle', root, 5, LEVEL.droneSoft)];
  return inBar === 14 ? [hit('triangle', rootFrom(next, BASS_FLOOR) - 1, 1.8, LEVEL.droneSoft)] : [];
};

// Off-beat breaths, only two a bar in the intro.
const whisperShaker = ({ section, inBar }) => {
  if (inBar === 6 || inBar === 14) return [hit('shaker', null, 0, LEVEL.shaker)];
  return section !== 'intro' && (inBar === 2 || inBar === 10) ? [hit('shaker', null, 0, LEVEL.shakerGhost)] : [];
};

const musicBox = ({ lead }) => (lead ? [hit('sine', lead.note, lead.length, LEVEL.lead)] : []);

// Beat four only, with a rattle before every fourth bar line.
const rattleSnare = ({ bar, inBar }) => {
  if (inBar === 12) return [hit('snare', null, 0, LEVEL.snare)];
  return bar % 4 === 3 && inBar === 15 ? [hit('snare', null, 0, LEVEL.snareGhost)] : [];
};

const cryptToms = ({ bar, inBar }) => {
  const note = TOMS[bar % 2][inBar];
  return note ? [hit('tom', note, 0, LEVEL.tom)] : [];
};

// The chord climbing on the off-beats, root to octave, faint.
const ghostPluck = (m) => {
  if (PLUCK[m.inBar] === undefined) return [];
  const [r, third, fifth] = triadOf(m, 61);
  return [hit('pulse', [r, third, fifth, r + 12][PLUCK[m.inBar]], 1.5, LEVEL.pluck)];
};

// A sub root under the drone that jumps a tritone for a moment in the songful sections.
const tritoneBass = ({ section, inBar, chord }) => {
  const root = rootFrom(chord, 36);
  if (inBar === 0) return [hit('sine', root, 10, LEVEL.sub)];
  if (section === 'intro' || section === 'bridge') return [];
  if (inBar === 10) return [hit('sine', root + 6, 1.8, LEVEL.sub)];
  return inBar === 12 ? [hit('sine', root, 3.5, LEVEL.sub)] : [];
};

// Under the melody: a minor second below on each downbeat note, otherwise the nearest chord tone below.
const dissonantHarmony = (m) => {
  if (!m.lead) return [];
  const note = m.inBar === 0 ? m.lead.note - 1 : chordToneBelow(m.lead.note, { pcs: tonesOf(m) });
  return [hit('square', note, m.lead.length, LEVEL.harmony)];
};

// The melody again a dotted eighth later, quiet, like a bell in another room.
const bellEcho = ({ step }) => {
  const { lead } = momentOf(SECTIONS, step - 3);
  return lead ? [hit('triangle', lead.note, 1.5, LEVEL.echo)] : [];
};

// Toms tumbling down at the end of every fourth bar.
const deathRoll = ({ bar, inBar }) => (bar % 4 === 3 && ROLL[inBar] ? [hit('tom', ROLL[inBar], 0, LEVEL.roll)] : []);

export const HAUNTED = layeredTrack({
  id: 'haunted',
  name: 'Haunted',
  sections: SECTIONS,
  layers: [
    ['Heartbeat', 'kick', heartbeat],
    ['Drone Bass', 'triangle', droneBass],
    ['Whisper Shaker', 'shaker', whisperShaker],
    ['Music Box Lead', 'sine', musicBox],
    ['Rattle Snare', 'snare', rattleSnare],
    ['Crypt Toms', 'tom', cryptToms],
    ['Ghost Pluck', 'pulse', ghostPluck],
    ['Tritone Bass', 'sine', tritoneBass],
    ['Dissonant Harmony', 'square', dissonantHarmony],
    ['Bell Echo', 'triangle', bellEcho],
    ['Death Roll', 'tom', deathRoll],
  ],
});
