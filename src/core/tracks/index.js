// The registry of soundtracks, in the order the selectors list them (Classic first: it is the default and the fallback).
// To add a track: write its module in this folder and add it here. Nothing else lists tracks.
import { layeredTrack } from './compose.js';
import { CLASSIC } from './classic.js';
import { SUNRISE } from './sunrise.js';
import { MIDNIGHT } from './midnight.js';
import { NEON } from './neon.js';
import { TROPIC } from './tropic.js';
import { HAUNTED } from './haunted.js';
import { PARADE } from './parade.js';
import { ABYSS } from './abyss.js';
import { DUNE } from './dune.js';
import { DISCO } from './disco.js';
import { STORM } from './storm.js';
import { LULLABY } from './lullaby.js';

export const TRACK_LIST = Object.freeze([
  CLASSIC,
  layeredTrack(SUNRISE),
  layeredTrack(MIDNIGHT),
  NEON,
  TROPIC,
  HAUNTED,
  PARADE,
  ABYSS,
  DUNE,
  DISCO,
  STORM,
  LULLABY,
]);
