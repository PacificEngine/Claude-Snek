// Shared music helpers for tracks built from independent layers.
// A layered track lists sections (bars, chords, an optional melody) and eleven layers [name, voice, play];
// `play(moment)` returns the hits of that one layer for one step and never looks at another layer.
import { STEPS_PER_BAR, TOTAL_STEPS } from '../clock.js';

const PITCH_CLASS = { C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
const pc = (midi) => ((midi % 12) + 12) % 12;

export const hit = (voice, note, length, level) => ({ voice, note, length, level });

// 'Em' is E minor, 'D' is D major; `transpose` moves it by semitones.
export function chord(name, transpose = 0) {
  const minor = name.endsWith('m');
  const root = pc(PITCH_CLASS[minor ? name.slice(0, -1) : name] + transpose);
  const third = minor ? 3 : 4;
  return { root, third, pcs: [root, pc(root + third), pc(root + 7)] };
}

// The lowest note at or above `floor` with the chord's root, and its triad from there.
export const rootFrom = (c, floor) => floor + pc(c.root - floor);
export const triadFrom = (c, floor) => {
  const r = rootFrom(c, floor);
  return [r, r + c.third, r + 7];
};

// Move `steps` scale degrees (negative is down) inside `scale` (pitch classes), starting from any note.
export function diatonic(midi, scale, steps) {
  const dir = Math.sign(steps);
  let n = midi;
  for (let k = 0; k < Math.abs(steps); k++) {
    do n += dir; while (!scale.includes(pc(n)));
  }
  return n;
}

// The highest chord tone at least `gap` semitones below `midi`.
export function chordToneBelow(midi, c, gap = 3) {
  let n = midi - gap;
  while (!c.pcs.includes(pc(n))) n -= 1;
  return n;
}

export const transposeScale = (scale, semitones) => scale.map((p) => pc(p + semitones));

// A melody bar is eight eighth-note slots (0 is a rest); each note rings until the next one, at most three beats.
function leadAt(pattern, inBar, transpose) {
  if (!pattern || inBar % 2 !== 0) return null;
  const slot = inBar / 2;
  if (!pattern[slot]) return null;
  let next = slot + 1;
  while (next < 8 && !pattern[next]) next += 1;
  return { note: pattern[slot] + transpose, length: Math.min(next - slot, 3) * 2 * 0.9 };
}

// Everything a layer may read about one step: where it is in the song, the chord, the next chord and the melody line.
export function momentOf(sections, step) {
  const s = wrapStep(step);
  const bar = Math.floor(s / STEPS_PER_BAR);
  const inBar = s % STEPS_PER_BAR;
  const here = sectionAt(sections, bar);
  const there = sectionAt(sections, (bar + 1) % (TOTAL_STEPS / STEPS_PER_BAR));
  const pattern = here.section.melody ? here.section.melody[here.barInSection % here.section.melody.length] : null;
  return {
    step: s,
    bar,
    inBar,
    section: here.section.name,
    transpose: here.section.transpose,
    chord: chordOf(here),
    next: chordOf(there),
    lead: leadAt(pattern, inBar, here.section.transpose),
    // True on an eighth where the melody line rests (or there is no melody): room for an answer.
    leadRests: !pattern || !pattern[Math.floor(inBar / 2)],
  };
}

const wrapStep = (step) => ((step % TOTAL_STEPS) + TOTAL_STEPS) % TOTAL_STEPS;
const chordOf = ({ section, barInSection }) => chord(section.chords[barInSection % section.chords.length], section.transpose);

function sectionAt(sections, bar) {
  let start = 0;
  for (const section of sections) {
    if (bar < start + section.bars) return { section, barInSection: bar - start };
    start += section.bars;
  }
  throw new Error(`bar ${bar} is outside the track`);
}

// Hits from a { inBar: [noteOffset, length] } map, played from `root`.
export const fromPattern = (pattern, inBar, root, voice, level) =>
  pattern[inBar] ? [hit(voice, root + pattern[inBar][0], pattern[inBar][1], level)] : [];
