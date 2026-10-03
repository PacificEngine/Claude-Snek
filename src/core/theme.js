// Themes: the colour and shape of every object on the board. Pure data and functions, no DOM.
//
// A theme is { name, colors: { board, grid, head, body, apple, wall, bomb, spark, enemyHead, enemyBody, dead },
//              shapes: { head, body, apple, wall, bomb, enemyHead, enemyBody, dead } }.
// There is one default theme per soundtrack (same id, same name). Stored themes are never trusted: sanitizeTheme
// checks them field by field.

import { TRACKS, TRACK_IDS } from './track.js';

export const COLOR_KEYS = ['board', 'grid', 'head', 'body', 'apple', 'wall', 'bomb', 'spark', 'enemyHead', 'enemyBody', 'dead'];
export const SHAPE_KEYS = ['head', 'body', 'apple', 'wall', 'bomb', 'enemyHead', 'enemyBody', 'dead'];
export const SHAPES = ['square', 'rounded', 'circle', 'diamond', 'triangle', 'hexagon', 'star', 'cross'];
export const DEFAULT_THEME_ID = 'classic';

const COLOR_LABELS = {
  board: 'Board', grid: 'Grid', head: 'Snake Head', body: 'Snake Body', apple: 'Apple', wall: 'Wall', bomb: 'Bomb',
  spark: 'Spark', enemyHead: 'Enemy Head', enemyBody: 'Enemy Body', dead: 'Dead Enemy',
};
// The menu's fields in display order: each colour, then (where the object has one) its shape.
export const THEME_FIELDS = COLOR_KEYS.flatMap((key) => [
  { kind: 'color', key, label: `${COLOR_LABELS[key]} Colour` },
  ...(SHAPE_KEYS.includes(key) ? [{ kind: 'shape', key, label: `${COLOR_LABELS[key]} Shape` }] : []),
]);

// Objects that must be readable against the board (3:1).
export const OBJECT_KEYS = ['head', 'body', 'apple', 'wall', 'bomb', 'enemyHead', 'enemyBody', 'dead'];
export const HAZARD_SHAPE_KEYS = ['wall', 'bomb', 'enemyBody'];
export const MIN_CONTRAST = 3;

// ---- colour maths ----
const HEX = /^#[0-9a-fA-F]{6}$/;
export const isHexColor = (value) => typeof value === 'string' && HEX.test(value);
export const sanitizeColor = (value, fallback) => (isHexColor(value) ? value.toLowerCase() : fallback);

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
const luminance = (hex) => {
  const [r, g, b] = channels(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// WCAG contrast ratio, 1 .. 21.
export function contrastRatio(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const blend = (from, to, amount) => {
  const [f, t] = [channels(from), channels(to)];
  return toHex(f.map((v, i) => v + (t[i] - v) * amount));
};
const colorDistance = (a, b) => Math.hypot(...channels(a).map((v, i) => v - channels(b)[i]));

// ---- default themes ----
const SQUARISH = { head: 'rounded', body: 'rounded', apple: 'circle', wall: 'square', bomb: 'diamond', enemyHead: 'rounded', enemyBody: 'rounded', dead: 'rounded' };
const theme = (id, colors, shapes = SQUARISH) => {
  const name = TRACKS.find((track) => track.id === id).name;
  return Object.freeze({ name, colors: Object.freeze(colors), shapes: Object.freeze({ ...shapes }) });
};
const c = (board, grid, head, body, apple, wall, bomb, spark, enemyHead, enemyBody, dead) => ({ board, grid, head, body, apple, wall, bomb, spark, enemyHead, enemyBody, dead });

const THEME_DATA = {
  // Exactly the look the game had before themes existed.
  classic: [c('#ffffff', '#eef1f4', '#14573f', '#1f7a5c', '#c2410c', '#334155', '#111827', '#f59e0b', '#581c87', '#7e22ce', '#9ca3af'), SQUARISH],
  sunrise: [c('#fff7ed', '#fde6cf', '#9a3412', '#c2410c', '#be123c', '#78350f', '#44403c', '#f59e0b', '#6d28d9', '#9333ea', '#78716c'), { ...SQUARISH, head: 'circle', apple: 'star', bomb: 'hexagon' }],
  midnight: [c('#0f172a', '#1e293b', '#bfdbfe', '#60a5fa', '#f472b6', '#94a3b8', '#e2e8f0', '#fbbf24', '#ddd6fe', '#a78bfa', '#64748b'), { ...SQUARISH, apple: 'star', bomb: 'triangle' }],
  neon: [c('#05060f', '#13152b', '#22d3ee', '#06b6d4', '#fb7185', '#a3e635', '#f8fafc', '#facc15', '#f0abfc', '#e879f9', '#6b7280'), { ...SQUARISH, wall: 'hexagon', bomb: 'star', enemyBody: 'diamond', enemyHead: 'diamond' }],
  tropic: [c('#fef3c7', '#f6e3a1', '#115e59', '#0f766e', '#e11d48', '#9a3412', '#374151', '#d97706', '#9d174d', '#be185d', '#78716c'), { ...SQUARISH, apple: 'hexagon', bomb: 'triangle' }],
  haunted: [c('#0a0a0f', '#17151f', '#c4b5fd', '#8b5cf6', '#fb923c', '#d6d3d1', '#f5f5dc', '#f97316', '#fdba74', '#ea580c', '#78716c'), { ...SQUARISH, head: 'triangle', apple: 'circle', bomb: 'cross', enemyBody: 'hexagon', enemyHead: 'hexagon' }],
  parade: [c('#fffbeb', '#f5ecd0', '#1e3a8a', '#1d4ed8', '#b91c1c', '#7c2d12', '#1f2937', '#b45309', '#7f1d1d', '#dc2626', '#6b7280'), { ...SQUARISH, apple: 'star', bomb: 'circle', enemyBody: 'triangle', enemyHead: 'triangle' }],
  abyss: [c('#042f2e', '#0a403e', '#5eead4', '#2dd4bf', '#a3e635', '#38bdf8', '#e0f2fe', '#fde047', '#86efac', '#4ade80', '#6b8f8c'), { ...SQUARISH, head: 'hexagon', body: 'circle', apple: 'circle', bomb: 'star', enemyBody: 'triangle', enemyHead: 'triangle' }],
  dune: [c('#f5deb3', '#e8cf9a', '#7c2d12', '#9a3412', '#b45309', '#78350f', '#292524', '#b91c1c', '#7f1d1d', '#991b1b', '#78716c'), { ...SQUARISH, body: 'diamond', bomb: 'hexagon', apple: 'circle' }],
  disco: [c('#2e1065', '#3b1a7a', '#fde047', '#facc15', '#f472b6', '#22d3ee', '#fafafa', '#fb923c', '#f9a8d4', '#ec4899', '#a78bfa'), { ...SQUARISH, apple: 'star', head: 'circle', body: 'circle', wall: 'triangle', bomb: 'diamond', enemyBody: 'hexagon', enemyHead: 'hexagon' }],
  storm: [c('#334155', '#3d4b61', '#fde047', '#facc15', '#f87171', '#cbd5e1', '#f1f5f9', '#fb923c', '#fdba74', '#e2e8f0', '#94a3b8'), { ...SQUARISH, apple: 'cross', bomb: 'triangle', wall: 'square', enemyBody: 'diamond', enemyHead: 'diamond' }],
  lullaby: [c('#fdf2f8', '#f9e3ee', '#7e22ce', '#a855f7', '#be185d', '#0f766e', '#475569', '#d97706', '#4338ca', '#6366f1', '#6b7280'), { ...SQUARISH, head: 'circle', body: 'circle', apple: 'star', bomb: 'diamond', enemyBody: 'rounded' }],
};

export const DEFAULT_THEMES = Object.freeze(Object.fromEntries(TRACK_IDS.map((id) => [id, theme(id, ...THEME_DATA[id])])));

// ---- menu helpers ----
const SHAPE_LABELS = { square: 'Square', rounded: 'Rounded Square', circle: 'Circle', diamond: 'Diamond', triangle: 'Triangle', hexagon: 'Hexagon', star: 'Star', cross: 'Cross' };
export const shapeLabel = (shape) => SHAPE_LABELS[shape] ?? shape;

// What the player typed as a colour, as '#rrggbb' in lower case; null when it is not one ('#' optional).
export function normalizeHex(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  const hex = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return isHexColor(hex) ? hex.toLowerCase() : null;
}

// A tiny board with one of every object, for the menu's preview; drawn by the real renderer. Hazards are past their ghost time.
export const PREVIEW_COLUMNS = 8;
export const PREVIEW_ROWS = 3;
export function previewState() {
  const solid = { age: 30, telegraph: 24 };
  return {
    snake: [{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }],
    food: { x: 4, y: 0 },
    status: 'playing',
    score: 0,
    settings: { gridSize: PREVIEW_COLUMNS },
    hazards: {
      walls: [{ cells: [{ x: 6, y: 0 }, { x: 7, y: 0 }], ...solid }],
      bombs: [{ cells: [{ x: 0, y: 2 }], ...solid }],
      enemies: [
        { cells: [{ x: 2, y: 2 }, { x: 3, y: 2 }], status: 'alive', age: 3 },
        { cells: [{ x: 5, y: 2 }, { x: 6, y: 2 }], status: 'dead', age: 9 },
      ],
    },
  };
}

// ---- sanitizing ----
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const sanitizeShape = (value, fallback) => (SHAPES.includes(value) ? value : fallback);
const copyTheme = (t) => ({ name: t.name, colors: { ...t.colors }, shapes: { ...t.shapes } });

// Field by field: whatever is not a strict #rrggbb colour or a known shape becomes the fallback's value.
export function sanitizeTheme(input, fallback = DEFAULT_THEMES[DEFAULT_THEME_ID]) {
  const src = isObject(input) ? input : {};
  const colors = isObject(src.colors) ? src.colors : {};
  const shapes = isObject(src.shapes) ? src.shapes : {};
  return {
    name: fallback.name,
    colors: Object.fromEntries(COLOR_KEYS.map((key) => [key, sanitizeColor(colors[key], fallback.colors[key])])),
    shapes: Object.fromEntries(SHAPE_KEYS.map((key) => [key, sanitizeShape(shapes[key], fallback.shapes[key])])),
  };
}

// One theme per known id; unknown ids are dropped, missing or corrupt ones are that theme's default.
export function sanitizeThemes(input) {
  const src = isObject(input) ? input : {};
  return Object.fromEntries(TRACK_IDS.map((id) => [id, sanitizeTheme(src[id], DEFAULT_THEMES[id])]));
}

export const themeOf = (themes, id) => themes?.[id] ?? themes?.[DEFAULT_THEME_ID] ?? DEFAULT_THEMES[DEFAULT_THEME_ID];

// ---- random style ----
const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const randomHex = (rng) => toHex([0, 0, 0].map(() => rng() * 256));
const RETRIES = 40;
const MIN_DISTANCE = 60;

// A colour readable on the board and different from the ones already taken (bounded retries, then black or white).
function readable(board, taken, rng) {
  for (let i = 0; i < RETRIES; i++) {
    const color = randomHex(rng);
    if (contrastRatio(color, board) >= MIN_CONTRAST && taken.every((other) => colorDistance(color, other) >= MIN_DISTANCE)) return color;
  }
  return fallback(board, taken);
}

// Black or white (whichever reads on the board), eased toward the board in small steps until an unused shade is found.
function fallback(board, taken) {
  const extreme = contrastRatio('#000000', board) >= contrastRatio('#ffffff', board) ? '#000000' : '#ffffff';
  for (let step = 0; step <= 50; step++) {
    const color = blend(extreme, board, step / 100);
    if (contrastRatio(color, board) >= MIN_CONTRAST && !taken.includes(color)) return color;
  }
  return extreme;
}

export function randomStyle(rng) {
  const board = randomHex(rng);
  const light = luminance(board) > 0.18;
  const grid = blend(board, light ? '#000000' : '#ffffff', 0.08);
  const colors = { board, grid };
  const taken = [board];
  ['head', 'body', 'apple', 'wall', 'bomb', 'enemyHead', 'enemyBody', 'dead'].forEach((key) => {
    colors[key] = readable(board, taken, rng);
    taken.push(colors[key]);
  });
  colors.spark = randomHex(rng);
  const shapes = {};
  const hazards = [...SHAPES];
  HAZARD_SHAPE_KEYS.forEach((key) => {
    shapes[key] = hazards.splice(Math.floor(rng() * hazards.length), 1)[0];
  });
  ['head', 'body', 'apple', 'enemyHead', 'dead'].forEach((key) => { shapes[key] = pick(SHAPES, rng); });
  return {
    name: 'Random',
    colors: Object.fromEntries(COLOR_KEYS.map((key) => [key, colors[key]])),
    shapes: Object.fromEntries(SHAPE_KEYS.map((key) => [key, shapes[key]])),
  };
}

// ---- which theme this game uses ----
// Precedence: random style, random theme, match the soundtrack, the chosen theme. Unknown ids are Classic. Returns a copy.
export function themeForGame({ themes, themeChoice, match, themeRandom, styleRandom, track }, rng) {
  if (styleRandom) return randomStyle(rng);
  const known = (id) => (TRACK_IDS.includes(id) ? id : DEFAULT_THEME_ID);
  const id = themeRandom ? pick(TRACK_IDS, rng) : match ? known(track) : known(themeChoice);
  return copyTheme(themeOf(themes, id));
}
