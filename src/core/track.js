// Tracks: how a song is declared as data.
//
// A track is { id, name, layers, eventsAt }:
//   id        short unique string, also what is saved ('classic').
//   name      what the menu shows ('Classic').
//   layers    exactly eleven { key, name, voice } in tier order. Layer n is controlled by music trigger n, so its key
//             is the slot key t0..t10 (SLOT_KEYS): triggers belong to the slot, the track gives the slot an instrument.
//   eventsAt  (step, active) -> event. `step` is a sixteenth (16 per bar, 512 per 32-bar loop: wrap it with
//             TOTAL_STEPS yourself), `active` is { t0: bool .. t10: bool }, the layers switched on for this bar.
//
// An event must carry `hits`, the only thing the synth plays: [{ voice, note, length, level }]
//   voice   one of VOICES: kick, snare, hat, clap, tom, shaker (drums), square, pulse, triangle, saw, sine (pitched).
//   note    MIDI note number (69 = A4 = 440 Hz), required for pitched voices; null for a drum (a tom may give one for its pitch).
//   length  how long a pitched note rings, in steps (the synth multiplies by the step's seconds). Drums ignore it.
//   level   linear loudness of this hit, roughly 0.05 .. 1 (the master volume is applied on top).
// An event may carry other fields for the track's own tests (Classic keeps its per-instrument fields); the synth ignores them.
// A layer that is not active must add no hit. To add a track, put its module in tracks/ and list it in tracks/index.js: it is then available everywhere the registry is used.

import { STEPS_PER_BAR, TOTAL_BARS, TOTAL_STEPS } from './clock.js';
import { LAYER_COUNT, SLOT_KEYS } from './tracks/compose.js';
import { TRACK_LIST } from './tracks/index.js';

export { STEPS_PER_BAR, TOTAL_BARS, TOTAL_STEPS, LAYER_COUNT, SLOT_KEYS };

export const VOICES = ['kick', 'snare', 'hat', 'clap', 'tom', 'shaker', 'square', 'pulse', 'triangle', 'saw', 'sine'];

// The layers switched on at tier n: slots 0 and 1 always, then the first n of the rest (tier 0 is slots 0 and 1 only).
export const layersForTier = (tier) => Object.fromEntries(SLOT_KEYS.map((key, i) => [key, i < 2 || tier >= i - 1]));

export const TRACKS = TRACK_LIST;

export const DEFAULT_TRACK = 'classic';
export const TRACK_IDS = TRACKS.map((track) => track.id);
export const trackById = (id) => TRACKS.find((track) => track.id === id) ?? TRACKS[0];
export const layerNames = (trackId) => trackById(trackId).layers.map((layer) => layer.name);

// The event for one step of the chosen track (an unknown id plays Classic).
export const eventsAt = (step, active, trackId = DEFAULT_TRACK) => trackById(trackId).eventsAt(step, active);
