// Abyss: a calm, spacious F lydian ambient loop. The raised fourth (B natural) gives the floating colour; only the
// borrowed Bb chord falls back to plain F major. A soft slow kick, a long sine sub, a whale-like sine lead of held notes,
// sparse high "sonar" pings, a wide triangle pad of thirds and sevenths, and a quiet tom swell as the fill.
import { hit, rootFrom, diatonic, layeredTrack } from './compose.js';

const LEVEL = {
  kick: 0.5, sub: 0.42, approach: 0.3, shaker: 0.07, shakerAccent: 0.11, lead: 0.32, clap: 0.14, ping: 0.1,
  pluck: 0.08, tide: 0.12, pad: 0.07, counter: 0.08,
};

const pc = (midi) => ((midi % 12) + 12) % 12;
const F_LYDIAN = [5, 7, 9, 11, 0, 2, 4];
const F_MAJOR = [5, 7, 9, 10, 0, 2, 4];
// The Bb chord would clash with the B natural, so over it the scale is plain F major.
const scaleFor = (chord) => (chord.root === 10 ? F_MAJOR : F_LYDIAN);
// The seventh that stays in the scale: major seventh where it fits (F, C, Bb), otherwise the flat seventh (G, Dm, Am, Em).
const seventhOf = (chord) => (scaleFor(chord).includes(pc(chord.root + 11)) ? 11 : 10);

// Melody bars as [step, MIDI note, length in steps]: long held notes and slow rises.
const VERSE = [
  [[0, 69, 6], [6, 72, 4], [10, 76, 6]], // F: A C E, up the Fmaj7
  [[0, 74, 10], [12, 71, 4]], // G: D, then the lydian B
  [[0, 72, 7], [8, 76, 8]], // Am: C E
  [[0, 76, 11], [12, 72, 4]], // F: the major seventh, held
  [[0, 69, 4], [4, 71, 4], [8, 72, 8]], // F: A B C, the lydian rise
  [[0, 74, 7], [8, 79, 8]], // G: D G
  [[0, 76, 6], [6, 74, 2], [8, 72, 8]], // Am: E D C
  [[0, 67, 7], [8, 72, 8]], // C: G C
];
const CHORUS = [
  [[0, 77, 8], [8, 76, 4], [12, 74, 4]], // Dm: F E D
  [[0, 74, 6], [6, 77, 10]], // Bb: D F
  [[0, 76, 6], [6, 79, 6], [12, 76, 4]], // C: E G E
  [[0, 77, 12], [12, 72, 4]], // F: F, falling to C
  [[0, 81, 8], [8, 77, 4], [12, 74, 4]], // Dm: A F D
  [[0, 77, 6], [6, 74, 4], [10, 70, 6]], // Bb: F D Bb
  [[0, 72, 4], [4, 74, 4], [8, 76, 8]], // C: C D E, rising
  [[0, 77, 15]], // F: home, held
];
const BRIDGE = [
  [[0, 71, 8], [8, 74, 8]], // G: B D
  [[0, 71, 6], [6, 76, 10]], // Em: B E
  [[0, 72, 8], [8, 76, 8]], // Am: C E
  [[0, 74, 8], [8, 77, 7]], // Bb: D F
];
const octaveUp = (bars) => bars.map((bar) => bar.map(([step, note, length]) => [step, note + 12, length]));

const CHORUS_CHORDS = ['Dm', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C', 'F'];

// 4 + 8 + 8 + 4 + 8 = 32 bars. The melody is read by the lead layer itself (see LINE), so `melody` stays null here.
export const SECTIONS = [
  { name: 'intro', bars: 4, chords: ['F', 'G', 'Am', 'F'], melody: null, transpose: 0 },
  { name: 'verse', bars: 8, chords: ['F', 'G', 'Am', 'F', 'F', 'G', 'Am', 'C'], melody: null, transpose: 0 },
  { name: 'chorus', bars: 8, chords: CHORUS_CHORDS, melody: null, transpose: 0 },
  { name: 'bridge', bars: 4, chords: ['G', 'Em', 'Am', 'Bb'], melody: null, transpose: 0 },
  { name: 'finale', bars: 8, chords: CHORUS_CHORDS, melody: null, transpose: 0 },
];

// The melody of the whole loop, one entry per bar (the intro is silent, the finale is the chorus an octave up).
const LINE = [[], [], [], [], ...VERSE, ...CHORUS, ...BRIDGE, ...octaveUp(CHORUS)];
const leadAt = (bar, inBar) => LINE[bar].find(([step]) => step === inBar);

const SUB_FLOOR = 38;

// Soft and slow: beats one and three, with a quieter pickup into every fourth bar.
const kick = ({ bar, inBar }) => {
  if (inBar === 0 || inBar === 8) return [hit('kick', null, 0, LEVEL.kick)];
  return bar % 4 === 3 && inBar === 14 ? [hit('kick', null, 0, LEVEL.kick * 0.6)] : [];
};

// Long sine notes: the root for two and a half beats, the fifth, then one scale step into the next bar's root.
const subBass = ({ inBar, chord, next }) => {
  const root = rootFrom(chord, SUB_FLOOR);
  if (inBar === 0) return [hit('sine', root, 9.5, LEVEL.sub)];
  if (inBar === 10) return [hit('sine', root + 7, 3.5, LEVEL.sub)];
  if (inBar !== 14) return [];
  const target = rootFrom(next, SUB_FLOOR);
  const approach = target === root ? root + 7 : diatonic(target, scaleFor(chord), target > root ? -1 : 1);
  return [hit('sine', approach, 2, LEVEL.approach)];
};

// An airy brush on the eighths, leaning on the off-beats.
const shaker = ({ inBar }) => {
  if (inBar % 2 !== 0) return [];
  return [hit('shaker', null, 0, inBar % 4 === 2 ? LEVEL.shakerAccent : LEVEL.shaker)];
};

const whaleLead = ({ bar, inBar }) => {
  const note = leadAt(bar, inBar);
  return note ? [hit('sine', note[1], note[2], LEVEL.lead)] : [];
};

// A quiet clap on two and four.
const softClap = ({ inBar }) => (inBar === 4 || inBar === 12 ? [hit('clap', null, 0, LEVEL.clap)] : []);

// High sine pings on off-beat sixteenths, one or two a bar, like sonar in deep water.
// Chord-tone names, so the third follows the chord (major or minor).
const PINGS = [{ 3: 'root' }, { 11: 'fifth', 14: 'octave' }, { 6: 'third' }, { 11: 'root' }];
const sonarPing = ({ bar, inBar, chord }) => {
  const tone = PINGS[bar % 4][inBar];
  if (!tone) return [];
  const offset = { root: 0, third: chord.third, fifth: 7, octave: 12 }[tone];
  return [hit('sine', rootFrom(chord, 84) + offset, 3, LEVEL.ping)];
};

// A slow glassy arpeggio of the seventh chord on the eighths.
const glassPluck = ({ inBar, chord }) => {
  if (inBar % 2 !== 0) return [];
  const root = rootFrom(chord, 60);
  const tones = [0, 7, seventhOf(chord), chord.third + 12, 7 + 12, seventhOf(chord), 7, chord.third];
  return [hit('triangle', root + tones[inBar / 2], 1.6, LEVEL.pluck)];
};

// A gentle saw an octave above the sub, pulsing on syncopated sixteenths like a slow tide.
const TIDE = { 3: [12, 2], 6: [12, 1.5], 11: [7, 2] };
const tideBass = ({ inBar, chord }) => {
  const pulse = TIDE[inBar];
  return pulse ? [hit('saw', rootFrom(chord, SUB_FLOOR) + pulse[0], pulse[1], LEVEL.tide)] : [];
};

// A wide pad: the chord's third and seventh held for the whole bar.
const padHarmony = ({ inBar, chord }) => {
  if (inBar !== 0) return [];
  const root = rootFrom(chord, 53);
  return [hit('triangle', root + chord.third, 15, LEVEL.pad), hit('triangle', root + seventhOf(chord), 15, LEVEL.pad)];
};

// A slow line above: the chord's fifth, then a scale step down from it (over F that is the floating B natural).
const driftCounter = ({ inBar, chord }) => {
  const fifth = rootFrom(chord, 76) + 7 > 88 ? rootFrom(chord, 64) + 7 : rootFrom(chord, 76) + 7;
  if (inBar === 4) return [hit('pulse', fifth, 7.5, LEVEL.counter)];
  if (inBar === 12) return [hit('pulse', diatonic(fifth, scaleFor(chord), -1), 3.5, LEVEL.counter)];
  return [];
};

// A quiet tom swell rising and growing through the second half of every fourth bar.
const SWELL = { 8: 45, 10: 47, 12: 50, 13: 52, 14: 55, 15: 57 };
const depthToms = ({ bar, inBar }) => {
  if (bar % 4 !== 3 || SWELL[inBar] === undefined) return [];
  return [hit('tom', SWELL[inBar], 0, 0.1 + (inBar - 8) * 0.03)];
};

export const ABYSS = layeredTrack({
  id: 'abyss',
  name: 'Abyss',
  sections: SECTIONS,
  layers: [
    ['Pulse Kick', 'kick', kick],
    ['Sub Bass', 'sine', subBass],
    ['Brush Shaker', 'shaker', shaker],
    ['Whale Lead', 'sine', whaleLead],
    ['Soft Clap', 'clap', softClap],
    ['Sonar Ping', 'sine', sonarPing],
    ['Glass Pluck', 'triangle', glassPluck],
    ['Tide Bass', 'saw', tideBass],
    ['Pad Harmony', 'triangle', padHarmony],
    ['Drift Counter', 'pulse', driftCounter],
    ['Depth Toms', 'tom', depthToms],
  ],
});
