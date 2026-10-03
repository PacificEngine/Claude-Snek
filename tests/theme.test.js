import { describe, it, expect } from 'vitest';
import {
  COLOR_KEYS, SHAPE_KEYS, SHAPES, THEME_FIELDS, DEFAULT_THEMES, DEFAULT_THEME_ID, OBJECT_KEYS, HAZARD_SHAPE_KEYS,
  contrastRatio, isHexColor, sanitizeColor, sanitizeTheme, sanitizeThemes, themeOf, randomStyle, themeForGame,
  shapeLabel, normalizeHex, previewState, PREVIEW_COLUMNS, PREVIEW_ROWS,
} from '../src/core/theme.js';
import { TRACKS, TRACK_IDS } from '../src/core/track.js';

const seeded = (seed) => {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const HEX = /^#[0-9a-f]{6}$/;
const validTheme = (t) => {
  expect(Object.keys(t.colors)).toEqual(COLOR_KEYS);
  expect(Object.keys(t.shapes)).toEqual(SHAPE_KEYS);
  COLOR_KEYS.forEach((k) => expect(t.colors[k]).toMatch(HEX));
  SHAPE_KEYS.forEach((k) => expect(SHAPES).toContain(t.shapes[k]));
};
const hazardShapesDiffer = (t) => expect(new Set(HAZARD_SHAPE_KEYS.map((k) => t.shapes[k])).size).toBe(3);

describe('field lists', () => {
  it('names the eleven colours, eight shapes and eight shape kinds', () => {
    expect(COLOR_KEYS).toHaveLength(11);
    expect(SHAPE_KEYS).toHaveLength(8);
    expect(SHAPES).toEqual(['square', 'rounded', 'circle', 'diamond', 'triangle', 'hexagon', 'star', 'cross']);
  });
  it('lists a labelled field for every colour and shape', () => {
    expect(THEME_FIELDS.filter((f) => f.kind === 'color').map((f) => f.key)).toEqual(COLOR_KEYS);
    expect(THEME_FIELDS.filter((f) => f.kind === 'shape').map((f) => f.key).sort()).toEqual([...SHAPE_KEYS].sort());
    const labels = THEME_FIELDS.map((f) => f.label);
    expect(labels).toContain('Board Colour');
    expect(labels).toContain('Snake Head Colour');
    expect(labels).toContain('Snake Head Shape');
    expect(labels).toContain('Spark Colour');
    expect(labels).toContain('Dead Enemy Colour');
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for equal colours, in either order', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});

describe('default themes', () => {
  it('has twelve, one per soundtrack, named like it', () => {
    expect(Object.keys(DEFAULT_THEMES)).toEqual(TRACK_IDS);
    expect(TRACK_IDS).toHaveLength(12);
    TRACKS.forEach((track) => expect(DEFAULT_THEMES[track.id].name).toBe(track.name));
  });
  it('is frozen all the way down', () => {
    expect(Object.isFrozen(DEFAULT_THEMES)).toBe(true);
    Object.values(DEFAULT_THEMES).forEach((t) => {
      expect(Object.isFrozen(t)).toBe(true);
      expect(Object.isFrozen(t.colors)).toBe(true);
      expect(Object.isFrozen(t.shapes)).toBe(true);
    });
  });
  it('has valid colours and shapes in every theme', () => {
    Object.values(DEFAULT_THEMES).forEach(validTheme);
  });
  it('makes Classic exactly the look the game had before themes', () => {
    expect(DEFAULT_THEME_ID).toBe('classic');
    expect(DEFAULT_THEMES.classic.colors).toEqual({
      board: '#ffffff', grid: '#eef1f4', head: '#14573f', body: '#1f7a5c', apple: '#c2410c', wall: '#334155',
      bomb: '#111827', spark: '#f59e0b', enemyHead: '#581c87', enemyBody: '#7e22ce', dead: '#9ca3af',
    });
    expect(DEFAULT_THEMES.classic.shapes).toEqual({
      head: 'rounded', body: 'rounded', apple: 'circle', wall: 'square', bomb: 'diamond', enemyHead: 'rounded', enemyBody: 'rounded', dead: 'rounded',
    });
  });
  it('keeps every object at least 3:1 against its board (Classic keeps its legacy grey dead enemy)', () => {
    Object.entries(DEFAULT_THEMES).forEach(([id, t]) => {
      OBJECT_KEYS.filter((k) => !(id === 'classic' && k === 'dead')).forEach((k) => {
        expect(contrastRatio(t.colors[k], t.colors.board), `${id}.${k}`).toBeGreaterThanOrEqual(3);
      });
    });
  });
  it('keeps wall, bomb and enemy shapes pairwise different in every theme', () => {
    Object.values(DEFAULT_THEMES).forEach(hazardShapesDiffer);
  });
  it('gives dark boards to the dark themes and light boards to the light ones', () => {
    const dark = ['midnight', 'neon', 'haunted', 'abyss', 'disco', 'storm'];
    TRACK_IDS.forEach((id) => {
      const vsWhite = contrastRatio(DEFAULT_THEMES[id].colors.board, '#ffffff');
      if (dark.includes(id)) expect(vsWhite, id).toBeGreaterThan(8);
      else expect(vsWhite, id).toBeLessThan(2);
    });
  });
});

describe('colour sanitizing', () => {
  it('accepts only #rrggbb, lowercased', () => {
    expect(isHexColor('#a1B2c3')).toBe(true);
    ['#abc', 'a1b2c3', '#a1b2c', '#a1b2c3d', '#gggggg', ' #a1b2c3', '#a1b2c3\n', 'red', '', null, undefined, 5, {}].forEach((v) => expect(isHexColor(v), String(v)).toBe(false));
    expect(sanitizeColor('#A1B2C3', '#000000')).toBe('#a1b2c3');
    expect(sanitizeColor('#abc', '#000000')).toBe('#000000');
    expect(sanitizeColor('url(x)', '#123456')).toBe('#123456');
  });
});

describe('sanitizeTheme', () => {
  const base = DEFAULT_THEMES.midnight;
  it('keeps a valid theme and lowercases colours', () => {
    const input = { colors: { ...base.colors, board: '#ABCDEF' }, shapes: { ...base.shapes, head: 'star' } };
    const out = sanitizeTheme(input, base);
    expect(out.colors.board).toBe('#abcdef');
    expect(out.shapes.head).toBe('star');
    expect(out.name).toBe('Midnight');
  });
  it('replaces a bad hex, a 3-digit hex and a non-string with the fallback, field by field', () => {
    const out = sanitizeTheme({ colors: { board: 'nope', grid: '#abc', head: 5, body: '#112233' } }, base);
    expect(out.colors.board).toBe(base.colors.board);
    expect(out.colors.grid).toBe(base.colors.grid);
    expect(out.colors.head).toBe(base.colors.head);
    expect(out.colors.body).toBe('#112233');
  });
  it('replaces an unknown shape with the fallback', () => {
    const out = sanitizeTheme({ shapes: { head: 'blob', body: 'hexagon', apple: 3 } }, base);
    expect(out.shapes.head).toBe(base.shapes.head);
    expect(out.shapes.body).toBe('hexagon');
    expect(out.shapes.apple).toBe(base.shapes.apple);
  });
  it('turns a non-object into the fallback copy and drops unknown fields', () => {
    [null, undefined, 'x', 7, [], true].forEach((v) => expect(sanitizeTheme(v, base)).toEqual({ name: base.name, colors: base.colors, shapes: base.shapes }));
    const out = sanitizeTheme({ colors: { ...base.colors, evil: '#ffffff' }, extra: 1 }, base);
    expect(Object.keys(out)).toEqual(['name', 'colors', 'shapes']);
    expect(Object.keys(out.colors)).toEqual(COLOR_KEYS);
  });
  it('returns an unfrozen copy, never the fallback itself', () => {
    const out = sanitizeTheme(base, base);
    expect(out).not.toBe(base);
    expect(out.colors).not.toBe(base.colors);
    expect(Object.isFrozen(out)).toBe(false);
  });
});

describe('sanitizeThemes', () => {
  it('returns every theme, defaulting the missing and the corrupt, ignoring unknown ids', () => {
    const out = sanitizeThemes({ neon: { colors: { board: '#123456' } }, storm: 'junk', bogus: { colors: {} } });
    expect(Object.keys(out)).toEqual(TRACK_IDS);
    expect(out.neon.colors.board).toBe('#123456');
    expect(out.neon.colors.head).toBe(DEFAULT_THEMES.neon.colors.head);
    expect(out.storm).toEqual(DEFAULT_THEMES.storm);
    expect(out.classic).toEqual(DEFAULT_THEMES.classic);
  });
  it('accepts junk input as all defaults', () => {
    [null, undefined, 'x', 3, []].forEach((v) => expect(sanitizeThemes(v)).toEqual(DEFAULT_THEMES));
  });
});

describe('themeOf', () => {
  it('returns the theme for a known id, else Classic', () => {
    const themes = sanitizeThemes({});
    expect(themeOf(themes, 'storm')).toBe(themes.storm);
    expect(themeOf(themes, 'nope')).toBe(themes.classic);
  });
});

describe('randomStyle', () => {
  const SEEDS = Array.from({ length: 500 }, (_, i) => i + 1);
  const styles = SEEDS.map((s) => randomStyle(seeded(s)));
  it('is a valid theme every time', () => {
    styles.forEach(validTheme);
  });
  it('keeps every object colour at least 3:1 against the board', () => {
    styles.forEach((t) => OBJECT_KEYS.forEach((k) => expect(contrastRatio(t.colors[k], t.colors.board), k).toBeGreaterThanOrEqual(3)));
  });
  it('keeps wall, bomb and enemy shapes pairwise different', () => {
    styles.forEach(hazardShapesDiffer);
  });
  it('keeps the grid subtle: close to the board and not equal to it', () => {
    styles.forEach((t) => {
      expect(t.colors.grid).not.toBe(t.colors.board);
      expect(contrastRatio(t.colors.grid, t.colors.board)).toBeLessThan(1.3);
    });
  });
  it('keeps snake, apple, wall, bomb and enemy colours pairwise distinct', () => {
    styles.forEach((t) => {
      const keys = ['head', 'body', 'apple', 'wall', 'bomb', 'enemyHead', 'enemyBody'];
      expect(new Set(keys.map((k) => t.colors[k])).size).toBe(keys.length);
    });
  });
  it('is deterministic for a seed and varies between seeds', () => {
    expect(randomStyle(seeded(9))).toEqual(randomStyle(seeded(9)));
    expect(new Set(styles.map((t) => t.colors.board)).size).toBeGreaterThan(400);
  });
  it('makes both light and dark boards, and uses every shape somewhere', () => {
    const lightBoards = styles.filter((t) => contrastRatio(t.colors.board, '#000000') > contrastRatio(t.colors.board, '#ffffff'));
    expect(lightBoards.length).toBeGreaterThan(50);
    expect(lightBoards.length).toBeLessThan(450);
    SHAPES.forEach((shape) => expect(styles.some((t) => Object.values(t.shapes).includes(shape)), shape).toBe(true));
  });
  it('survives a stuck rng (always 0 or always near 1) with valid contrasting output', () => {
    [() => 0, () => 0.999999, () => 0.5].forEach((rng) => {
      const t = randomStyle(rng);
      validTheme(t);
      hazardShapesDiffer(t);
      OBJECT_KEYS.forEach((k) => expect(contrastRatio(t.colors[k], t.colors.board)).toBeGreaterThanOrEqual(3));
    });
  });
});

describe('themeForGame', () => {
  const themes = sanitizeThemes({ neon: { colors: { board: '#123456' } } });
  const frozenCopy = JSON.stringify(themes);
  const base = { themes, themeChoice: 'storm', match: false, themeRandom: false, styleRandom: false, track: 'neon' };
  const rng = () => 0;
  it('uses the chosen theme when nothing else applies', () => {
    expect(themeForGame(base, rng)).toEqual(themes.storm);
  });
  it('uses the soundtrack theme when Match is on', () => {
    expect(themeForGame({ ...base, match: true }, rng)).toEqual(themes.neon);
  });
  it('uses a random theme from the twelve when Randomize Theme is on, over Match', () => {
    expect(themeForGame({ ...base, match: true, themeRandom: true }, () => 0)).toEqual(themes[TRACK_IDS[0]]);
    expect(themeForGame({ ...base, match: true, themeRandom: true }, () => 0.999999)).toEqual(themes[TRACK_IDS[11]]);
    const picked = new Set(Array.from({ length: 200 }, (_, i) => themeForGame({ ...base, themeRandom: true }, seeded(i + 1)).name));
    expect(picked.size).toBe(12);
  });
  it('uses a generated style when Randomize Style is on, over everything', () => {
    const all = { ...base, match: true, themeRandom: true, styleRandom: true };
    expect(themeForGame(all, seeded(5))).toEqual(randomStyle(seeded(5)));
  });
  it('treats unknown ids as Classic', () => {
    expect(themeForGame({ ...base, themeChoice: 'bogus' }, rng)).toEqual(themes.classic);
    expect(themeForGame({ ...base, match: true, track: 'bogus' }, rng)).toEqual(themes.classic);
  });
  it('returns a copy and never mutates the saved themes', () => {
    const out = themeForGame({ ...base, match: true }, rng);
    expect(out).not.toBe(themes.neon);
    out.colors.board = '#000000';
    out.shapes.head = 'star';
    themeForGame({ ...base, styleRandom: true }, seeded(2));
    themeForGame({ ...base, themeRandom: true }, seeded(2));
    expect(JSON.stringify(themes)).toBe(frozenCopy);
  });
});

describe('menu helpers', () => {
  it('names every shape for the menu', () => {
    expect(SHAPES.map(shapeLabel)).toEqual(['Square', 'Rounded Square', 'Circle', 'Diamond', 'Triangle', 'Hexagon', 'Star', 'Cross']);
  });
  it('normalises typed hex colours, accepting a missing # and any case, and rejects the rest', () => {
    expect(normalizeHex('#ABCDEF')).toBe('#abcdef');
    expect(normalizeHex('  12ab9F ')).toBe('#12ab9f');
    expect(normalizeHex('#abc')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
    expect(normalizeHex('#12345g')).toBeNull();
    expect(normalizeHex(null)).toBeNull();
  });
  it('builds a preview board showing every object of a theme with solid hazards', () => {
    const state = previewState();
    const cells = state.snake.concat(state.food, state.hazards.walls.flatMap((w) => w.cells), state.hazards.bombs.flatMap((b) => b.cells), state.hazards.enemies.flatMap((e) => e.cells));
    expect(new Set(cells.map((c) => `${c.x},${c.y}`)).size).toBe(cells.length);
    expect(cells.every((c) => c.x >= 0 && c.x < PREVIEW_COLUMNS && c.y >= 0 && c.y < PREVIEW_ROWS)).toBe(true);
    expect(state.snake.length).toBeGreaterThanOrEqual(2);
    expect(state.hazards.enemies.map((e) => e.status).sort()).toEqual(['alive', 'dead']);
    expect(state.hazards.enemies.every((e) => e.cells.length >= 2)).toBe(true);
    expect([...state.hazards.walls, ...state.hazards.bombs].every((o) => o.age >= (o.telegraph ?? 24))).toBe(true);
    expect(state.settings.gridSize).toBe(PREVIEW_COLUMNS);
  });
});
