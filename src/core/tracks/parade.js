// Parade: a cheerful F major march. Bass drum on 1 and 3, snare on 2 and 4 with ghost flams before each backbeat,
// an oom-pah tuba (root, fifth, a chromatic step into each new chord), trombone "pah"s on the offbeats and a pulse
// trumpet playing dotted fanfare figures. Horns follow the trumpet in thirds and a piccolo answers in its rests.
// The bridge turns to D minor through A7; the last chorus lifts a whole tone, with the trumpet an octave up.
import { layeredTrack, hit, rootFrom, triadFrom, diatonic, chordToneBelow, transposeScale } from './compose.js';

const F_MAJOR = [5, 7, 9, 10, 0, 2, 4];

const LEVEL = {
  kick: 0.8, tuba: 0.45, hat: 0.07, hatAccent: 0.13, lead: 0.26, snare: 0.32, ghost: 0.09,
  cymbal: 0.16, crash: 0.3, trombone: 0.14, walk: 0.28, horn: 0.14, piccolo: 0.1,
};

// A melody bar is [step, MIDI note] onsets (note 0 is a rest); each note rings until the next onset.
// Dotted eighth + sixteenth (3 + 1 steps) is the fanfare figure.
const VERSE = [
  [[0, 72], [3, 72], [4, 77], [8, 81], [12, 77]], // F
  [[0, 74], [3, 74], [4, 77], [8, 81], [11, 77], [12, 74]], // Dm
  [[0, 70], [3, 70], [4, 74], [8, 79], [11, 77], [12, 74]], // Gm
  [[0, 76], [3, 77], [4, 79], [8, 72], [12, 0]], // C
  [[0, 72], [3, 72], [4, 77], [8, 81], [11, 82], [12, 84]], // F
  [[0, 82], [3, 81], [4, 82], [8, 77], [11, 74], [12, 70]], // Bb
  [[0, 79], [3, 76], [4, 72], [8, 76], [11, 74], [12, 79]], // C
  [[0, 77], [3, 72], [4, 77], [8, 0]], // F
];
const CHORUS = [
  [[0, 81], [3, 81], [4, 84], [8, 81], [11, 79], [12, 77]], // F
  [[0, 82], [3, 82], [4, 86], [8, 82], [11, 81], [12, 77]], // Bb
  [[0, 81], [3, 79], [4, 77], [8, 72], [11, 74], [12, 77]], // F
  [[0, 79], [6, 0], [8, 76], [11, 77], [12, 79]], // C
  [[0, 77], [3, 77], [4, 81], [8, 86], [11, 84], [12, 81]], // Dm
  [[0, 82], [3, 82], [4, 86], [8, 82], [11, 81], [12, 79]], // Gm
  [[0, 84], [3, 82], [4, 79], [8, 76], [11, 74], [12, 72]], // C (the Bb makes it C7)
  [[0, 77], [4, 0], [8, 72], [11, 74], [12, 76]], // F
];
const BRIDGE = [
  [[0, 74], [6, 77], [8, 81], [14, 79]], // Dm
  [[0, 73], [6, 76], [8, 79], [12, 76]], // A (the G makes it A7)
  [[0, 77], [6, 74], [8, 81], [12, 77]], // Dm
  [[0, 76], [3, 76], [4, 79], [8, 84], [12, 0]], // C
];

const CHORUS_CHORDS = ['F', 'Bb', 'F', 'C', 'Dm', 'Gm', 'C', 'F'];

// 4 + 8 + 8 + 4 + 8 = 32 bars. The melody lives in MELODY below (it needs sixteenth steps), so `melody` is null here.
const SECTIONS = [
  { name: 'intro', bars: 4, chords: ['F', 'Bb', 'C', 'F'], melody: null, transpose: 0 },
  { name: 'verse', bars: 8, chords: ['F', 'Dm', 'Gm', 'C', 'F', 'Bb', 'C', 'F'], melody: null, transpose: 0 },
  { name: 'chorus', bars: 8, chords: CHORUS_CHORDS, melody: null, transpose: 0 },
  { name: 'bridge', bars: 4, chords: ['Dm', 'A', 'Dm', 'C'], melody: null, transpose: 0 },
  { name: 'finale', bars: 8, chords: CHORUS_CHORDS, melody: null, transpose: 2 },
];

// The melody of every bar of the loop, in order (none in the intro).
const MELODY = [null, null, null, null, ...VERSE, ...CHORUS, ...BRIDGE, ...CHORUS];

// The trumpet line at this step, before any octave lift: { note, length } or null.
function lineAt({ bar, inBar, transpose }) {
  const notes = MELODY[bar];
  if (!notes) return null;
  const at = notes.findIndex(([step]) => step === inBar);
  if (at < 0 || notes[at][1] === 0) return null;
  const nextStep = at + 1 < notes.length ? notes[at + 1][0] : 16;
  return { note: notes[at][1] + transpose, length: Math.min(nextStep - inBar, 8) * 0.9 };
}

// True when the trumpet starts no note in this beat (it rests or holds): room for the piccolo.
const beatIsFree = ({ bar, inBar }) => {
  const notes = MELODY[bar];
  const beat = Math.floor(inBar / 4);
  return !notes || !notes.some(([step, note]) => note !== 0 && Math.floor(step / 4) === beat);
};

// The key's scale with the chord's third swapped in when it is borrowed (C# over A makes D harmonic minor).
function scaleFor(c, transpose) {
  const scale = transposeScale(F_MAJOR, transpose);
  const third = (c.root + c.third) % 12;
  return scale.includes(third) ? scale : scale.map((p) => (p === (third + 11) % 12 ? third : p));
}

const TUBA_FLOOR = 36;
const WALK_FLOOR = 41;
const TROMBONE_FLOOR = 53;
const PICCOLO_FLOOR = 84;
// Which piccolo chord tone (0 root, 1 third, 2 fifth, 3 root above) on each eighth of the bar.
const PICCOLO_ORDER = [2, 0, 1, 2, 0, 1, 2, 3];
const ROLL = { 8: 0.1, 9: 0.12, 10: 0.15, 11: 0.18, 13: 0.22, 14: 0.26, 15: 0.3 };

const bassDrum = ({ inBar }) => (inBar === 0 || inBar === 8 ? [hit('kick', null, 0, LEVEL.kick)] : []);

// Oom-pah: the root on 1, the fifth on 3 (below when above is too high), then a semitone into a new chord's root.
const tuba = ({ inBar, chord: c, next }) => {
  const root = rootFrom(c, TUBA_FLOOR);
  if (inBar === 0) return [hit('square', root, 3, LEVEL.tuba)];
  if (inBar === 8) return [hit('square', root + 7 <= 50 ? root + 7 : root - 5, 3, LEVEL.tuba)];
  if (inBar === 14 && next.root !== c.root) {
    const target = rootFrom(next, TUBA_FLOOR);
    return [hit('square', target - 1 >= TUBA_FLOOR ? target - 1 : target + 1, 1.8, LEVEL.tuba)];
  }
  return [];
};

const hiHat = ({ inBar }) => (inBar % 2 === 0 ? [hit('hat', null, 0, inBar % 4 === 2 ? LEVEL.hatAccent : LEVEL.hat)] : []);

const trumpet = (moment) => {
  const line = lineAt(moment);
  if (!line) return [];
  return [hit('pulse', line.note + (moment.section === 'finale' ? 12 : 0), line.length, LEVEL.lead)];
};

// The backbeat on 2 and 4, each with a ghost stroke on the sixteenth before it.
const snare = ({ inBar }) => {
  if (inBar === 4 || inBar === 12) return [hit('snare', null, 0, LEVEL.snare)];
  if (inBar === 3 || inBar === 11) return [hit('snare', null, 0, LEVEL.ghost)];
  return [];
};

// Marching cymbals with the backbeat, and a crash at the top of every four-bar phrase.
const cymbal = ({ bar, inBar }) => {
  if (inBar === 0 && bar % 4 === 0) return [hit('hat', null, 0, LEVEL.crash)];
  if (inBar === 4 || inBar === 12) return [hit('hat', null, 0, LEVEL.cymbal)];
  return [];
};

// The "pah" on 2 and 4: the chord's third, then its fifth.
const trombone = ({ inBar, chord: c }) => {
  if (inBar !== 4 && inBar !== 12) return [];
  const [, third, fifth] = triadFrom(c, TROMBONE_FLOOR);
  return [hit('saw', inBar === 4 ? third : fifth, 1.5, LEVEL.trombone)];
};

// Quarter notes root, third, fifth, then the scale step above the next root (a short one, under the tuba's approach).
const walkingTuba = ({ inBar, chord: c, next, transpose }) => {
  if (inBar % 4 !== 0) return [];
  const root = rootFrom(c, WALK_FLOOR);
  if (inBar === 12) {
    const above = diatonic(rootFrom(next, WALK_FLOOR), transposeScale(F_MAJOR, transpose), 1);
    return [hit('triangle', above, 1.8, LEVEL.walk)];
  }
  return [hit('triangle', [root, root + c.third, root + 7][inBar / 4], 3.2, LEVEL.walk)];
};

// Close harmony under the trumpet line, in its own octave (not lifted in the finale): the next chord tone down
// under a chord tone, a diatonic third under a passing note.
const horns = (moment) => {
  const line = lineAt(moment);
  if (!line) return [];
  const { chord: c, transpose } = moment;
  const note = c.pcs.includes(line.note % 12) ? chordToneBelow(line.note, c, 3) : diatonic(line.note, scaleFor(c, transpose), -2);
  return [hit('triangle', note, line.length, LEVEL.horn)];
};

// High chord-tone eighths on the beats where the trumpet starts nothing (all through the intro).
const piccolo = (moment) => {
  const { inBar, chord: c } = moment;
  if (inBar % 2 !== 0 || !beatIsFree(moment)) return [];
  const [root, third, fifth] = triadFrom(c, PICCOLO_FLOOR);
  return [hit('triangle', [root, third, fifth, root + 12][PICCOLO_ORDER[inBar / 2]], 1.5, LEVEL.piccolo)];
};

// A rising snare roll through the second half of every fourth bar, leaving the backbeat on 4 to the snare.
const snareRoll = ({ bar, inBar }) => (bar % 4 === 3 && ROLL[inBar] ? [hit('snare', null, 0, ROLL[inBar])] : []);

export const PARADE = layeredTrack({
  id: 'parade',
  name: 'Parade',
  sections: SECTIONS,
  layers: [
    ['Bass Drum', 'kick', bassDrum],
    ['Tuba Bass', 'square', tuba],
    ['Hi-Hat', 'hat', hiHat],
    ['Trumpet Lead', 'pulse', trumpet],
    ['Snare', 'snare', snare],
    ['Cymbal Crash', 'hat', cymbal],
    ['Trombone Pluck', 'saw', trombone],
    ['Walking Tuba', 'triangle', walkingTuba],
    ['Horn Harmony', 'triangle', horns],
    ['Piccolo Counter', 'triangle', piccolo],
    ['Snare Roll', 'snare', snareRoll],
  ],
});
