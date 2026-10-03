// Storm: an intense, double-time D minor loop. A double kick (1, the "a" of 1, 3, the "and" of 3), a galloping saw
// bass (root, root, octave) with chromatic runs, a tremolo-picked saw lead with big leaps, tense pulse arpeggios
// (a diminished b9 cell over the A chord) and snare rolls and tom thunder into every fourth bar.
// The bridge (Bb A Gm A7sus) holds back to half time, then the final chorus lifts a whole tone with the lead an octave up.
import { layeredTrack, hit, triadFrom, rootFrom } from './compose.js';

const LEVEL = {
  kick: 0.85, kickGhost: 0.7, bass: 0.3, bassOctave: 0.26, run: 0.28, crash: 0.22, hat: 0.1, hatGhost: 0.06,
  lead: 0.3, leadTremolo: 0.22, snare: 0.45, tom: 0.25, arp: 0.1, sub: 0.28, power: 0.1, counter: 0.08, fill: 0.3,
};

const H = -1; // hold the previous note
const R = 0; // rest

// Eight eighth-note slots per bar, as MIDI notes.
const VERSE = [
  [74, H, 72, 69, 74, H, 77, H], // Dm
  [74, H, 70, H, 65, 70, 74, 77], // Bb
  [76, H, 72, 67, 72, 76, 79, H], // C
  [81, H, H, 77, 74, H, R, R], // Dm
  [62, 74, 62, 74, 72, 69, 65, 69], // Dm
  [70, H, 67, 74, 79, H, 74, 70], // Gm
  [73, H, 76, 73, 69, H, 70, 73], // A
  [74, H, H, H, R, 69, 72, 74], // Dm
];
const CHORUS = [
  [77, H, H, 74, 82, H, 81, 77], // Bb
  [79, H, H, 76, 84, H, 82, 79], // C
  [81, H, H, H, 77, H, 74, H], // Dm
  [86, H, 84, 81, 77, 76, 74, 72], // Dm
  [70, H, 74, H, 79, H, 82, H], // Gm
  [81, H, 73, H, 76, H, 79, 82], // A
  [77, H, H, 74, 81, H, H, 86], // Dm
  [85, H, H, H, 81, H, 76, 73], // A
];
const BRIDGE = [
  [65, H, H, H, 77, H, H, H], // Bb
  [64, H, H, H, 76, H, 73, H], // A
  [62, H, H, H, 74, H, 79, H], // Gm
  [69, H, 74, H, 76, H, 79, 81], // A7sus
];

const CHORUS_CHORDS = ['Bb', 'C', 'Dm', 'Dm', 'Gm', 'A', 'Dm', 'A'];

// 4 + 8 + 8 + 4 + 8 = 32 bars. The lead is read by the layers themselves (it needs holds), so no section melody.
const SECTIONS = [
  { name: 'intro', bars: 4, chords: ['Dm', 'Bb', 'C', 'A'], melody: null, transpose: 0 },
  { name: 'verse', bars: 8, chords: ['Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A', 'Dm'], melody: null, transpose: 0 },
  { name: 'chorus', bars: 8, chords: CHORUS_CHORDS, melody: null, transpose: 0 },
  { name: 'bridge', bars: 4, chords: ['Bb', 'A', 'Gm', 'A'], melody: null, transpose: 0 },
  { name: 'finale', bars: 8, chords: CHORUS_CHORDS, melody: null, transpose: 2 },
];

const START = { intro: 0, verse: 4, chorus: 12, bridge: 20, finale: 24 };
const TUNE = { verse: VERSE, chorus: CHORUS, bridge: BRIDGE, finale: CHORUS };
const SUS_BAR = 23; // the A7sus build at the end of the bridge

const loud = (section) => section === 'chorus' || section === 'finale';
const halfTime = ({ section, bar }) => section === 'bridge' && bar !== SUS_BAR;
const intoFourthBar = ({ bar }) => bar % 4 === 3;

// The lead note sounding at this step: its pitch, whether it starts here, and how many eighths it is held.
function leadAt({ section, bar, inBar, transpose }) {
  const tune = TUNE[section];
  if (!tune) return null;
  const slots = tune[bar - START[section]];
  const slot = Math.floor(inBar / 2);
  let start = slot;
  while (start > 0 && slots[start] === H) start -= 1;
  if (slots[start] === R || slots[start] === H) return null;
  let end = slot + 1;
  while (end < 8 && slots[end] === H) end += 1;
  return {
    note: slots[start] + transpose + (section === 'finale' ? 12 : 0),
    onset: start === slot && inBar % 2 === 0,
    eighths: end - start,
  };
}

const KICKS = { normal: [0, 3, 8, 10], loud: [0, 2, 3, 6, 8, 10, 11, 14], half: [0, 10], build: [0, 2, 4, 6, 10, 14] };

const doubleKick = (m) => {
  const kicks = halfTime(m) ? KICKS.half : m.bar === SUS_BAR ? KICKS.build : loud(m.section) ? KICKS.loud : KICKS.normal;
  if (!kicks.includes(m.inBar)) return [];
  return [hit('kick', null, 0, m.inBar === 0 || m.inBar === 8 ? LEVEL.kick : LEVEL.kickGhost)];
};

const BASS_FLOOR = 38;
// A chromatic approach to the next chord's root from below (from above when below would leave the range).
const approach = (target, k) => (target - 3 >= 36 ? target - 3 + k : target + 3 - k);

// Sixteenth gallop in threes (root, root, octave), with a chromatic run into the next chord on odd bars.
const gallopBass = (m) => {
  const root = rootFrom(m.chord, BASS_FLOOR);
  if (halfTime(m)) return m.inBar % 2 === 0 ? [hit('saw', root + (m.inBar % 8 === 4 ? 12 : 0), 1.8, LEVEL.bass)] : [];
  if (m.bar % 2 === 1 && m.inBar >= 13) return [hit('saw', approach(rootFrom(m.next, BASS_FLOOR), m.inBar - 13), 0.9, LEVEL.run)];
  const octave = m.inBar < 12 ? m.inBar % 3 === 2 : m.inBar === 14;
  return [hit('saw', root + (octave ? 12 : 0), 0.9, octave ? LEVEL.bassOctave : LEVEL.bass)];
};

// A crash on every fourth downbeat; quarters in the bridge, eighths in the verse, sixteenths in the choruses.
const crashHat = (m) => {
  if (m.inBar === 0 && m.bar % 4 === 0) return [hit('hat', null, 0, LEVEL.crash)];
  if (halfTime(m)) return m.inBar % 4 === 0 ? [hit('hat', null, 0, LEVEL.hat)] : [];
  if (loud(m.section) || m.bar === SUS_BAR) return [hit('hat', null, 0, m.inBar % 2 === 0 ? LEVEL.hat : LEVEL.hatGhost)];
  return m.inBar % 2 === 0 ? [hit('hat', null, 0, LEVEL.hat)] : [];
};

// Tremolo picking: sixteenths in the choruses and the sus build, eighths in the verse, long held notes in the bridge.
const sawLead = (m) => {
  const line = leadAt(m);
  if (!line) return [];
  if (halfTime(m)) return line.onset ? [hit('saw', line.note, line.eighths * 2 * 0.9, LEVEL.lead)] : [];
  const sixteenths = loud(m.section) || m.bar === SUS_BAR;
  if (!sixteenths && m.inBar % 2 === 1) return [];
  return [hit('saw', line.note, sixteenths ? 0.9 : 1.8, line.onset ? LEVEL.lead : LEVEL.leadTremolo)];
};

const ROLL = { 13: 0.22, 14: 0.3, 15: 0.38 };
const LONG_ROLL = { 9: 0.15, 10: 0.2, 11: 0.25, 13: 0.32, 14: 0.38, 15: 0.45 };

// Two and four (beat three only in the half-time bridge), rolling into every fourth bar, longer every eighth.
const snare = (m) => {
  if (halfTime(m)) return m.inBar === 8 ? [hit('snare', null, 0, LEVEL.snare)] : [];
  if (m.inBar === 4 || m.inBar === 12) return [hit('snare', null, 0, LEVEL.snare)];
  if (!intoFourthBar(m)) return [];
  const level = (m.bar % 8 === 7 ? LONG_ROLL : ROLL)[m.inBar];
  return level ? [hit('snare', null, 0, level)] : [];
};

const TOMS = [{ 13: 52, 14: 50, 15: 47 }, { 5: 50, 6: 47, 7: 45 }];
const tomRolls = ({ bar, inBar }) => {
  const note = TOMS[bar % 2][inBar];
  return note ? [hit('tom', note, 0, LEVEL.tom)] : [];
};

const ORDER = [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 3, 2, 1];
// Semitones above the root: a plain triad, the dominant's diminished b9 cell, the sus4 + seventh build.
const CELL = { triad: (c) => [0, c.third, 7, 12], dominant: () => [4, 7, 10, 13], sus: () => [5, 7, 10, 12] };
const isDominant = ({ chord, transpose }) => chord.third === 4 && chord.root === (9 + transpose) % 12;
const cellOf = (m) => (m.bar === SUS_BAR ? CELL.sus() : isDominant(m) ? CELL.dominant() : CELL.triad(m.chord));

const tremoloArp = (m) => {
  if ((m.section === 'intro' || halfTime(m)) && m.inBar % 2 === 1) return [];
  return [hit('pulse', rootFrom(m.chord, 62) + cellOf(m)[ORDER[m.inBar]], 0.9, LEVEL.arp)];
};

// A sine sub: root and fifth, walking chromatically down into the next chord on even bars.
const chromaticBass = (m) => {
  const root = rootFrom(m.chord, BASS_FLOOR);
  if (m.inBar === 0) return [hit('sine', root, 5.5, LEVEL.sub)];
  if (m.inBar === 6) return [hit('sine', root + 7, 5.5, LEVEL.sub)];
  if (m.bar % 2 === 0 && m.inBar >= 13) return [hit('sine', rootFrom(m.next, BASS_FLOOR) + 16 - m.inBar, 0.9, LEVEL.sub)];
  return m.bar % 2 === 1 && m.inBar === 12 ? [hit('sine', root, 3.5, LEVEL.sub)] : [];
};

const POWER = { normal: { 0: 7, 8: 7 }, loud: { 0: 2.5, 3: 4.5, 8: 7 }, build: { 0: 2.5, 3: 4.5, 8: 2.5, 11: 4.5 } };
// Root and fifth stabs: long in the verse, pushed in the choruses, pushed on both halves of the sus build.
const powerHarmony = (m) => {
  const stabs = m.bar === SUS_BAR ? POWER.build : loud(m.section) ? POWER.loud : POWER.normal;
  const length = stabs[m.inBar];
  if (!length) return [];
  const root = rootFrom(m.chord, 50);
  return [hit('square', root, length, LEVEL.power), hit('square', root + 7, length, LEVEL.power)];
};

const COUNTER_STEPS = { 4: 0, 10: 1, 14: 2 };
// High chord tones off the beat, falling on even bars and rising on odd ones; under the raised lead in the finale.
const screechCounter = (m) => {
  const at = COUNTER_STEPS[m.inBar];
  if (at === undefined) return [];
  const root = rootFrom(m.chord, m.section === 'finale' ? 67 : 79);
  const tones = m.bar === SUS_BAR ? [root + 5, root + 7, root + 10] : triadFrom(m.chord, root);
  const order = m.bar % 2 === 0 ? [2, 1, 0] : [1, 0, 2];
  return [hit('pulse', tones[order[at]], 2.7, LEVEL.counter)];
};

const THUNDER = { 8: 57, 9: 55, 10: 52, 11: 50, 12: 48, 13: 47, 14: 45, 15: 43 };
// Toms crashing down the kit through the second half of every fourth bar.
const thunderFill = (m) => (intoFourthBar(m) && THUNDER[m.inBar] ? [hit('tom', THUNDER[m.inBar], 0, LEVEL.fill)] : []);

export const STORM = layeredTrack({
  id: 'storm',
  name: 'Storm',
  sections: SECTIONS,
  layers: [
    ['Double Kick', 'kick', doubleKick],
    ['Gallop Bass', 'saw', gallopBass],
    ['Crash Hat', 'hat', crashHat],
    ['Saw Lead', 'saw', sawLead],
    ['Snare', 'snare', snare],
    ['Tom Rolls', 'tom', tomRolls],
    ['Tremolo Arp', 'pulse', tremoloArp],
    ['Chromatic Bass', 'sine', chromaticBass],
    ['Power Harmony', 'square', powerHarmony],
    ['Screech Counter', 'pulse', screechCounter],
    ['Thunder Fill', 'tom', thunderFill],
  ],
});
