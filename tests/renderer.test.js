import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { render } from '../src/renderer.js';
import { traceShape } from '../src/core/shapes.js';
import { SHAPES, DEFAULT_THEMES, sanitizeTheme } from '../src/core/theme.js';
import { recordingContext, sampleState } from './render-recorder.js';

const sha = (lines) => createHash('sha256').update(lines.join('\n')).digest('hex');
const nums = (line) => line.slice(line.indexOf('(') + 1, -1).split(',').map(Number);

// Pinned from the renderer as it was before themes existed (190 calls for sampleState()).
const OLD_CLASSIC_SOLID_OBJECTS = 'e3a4e6d230ac929bd5ccd5adad739e2d30e3582a7fa4b04683995d887fda979f';

describe('Classic look is unchanged', () => {
  it('draws the solid objects with the exact calls of the pre-theme renderer, plus the board fill', () => {
    const { ctx, log } = recordingContext();
    render(ctx, sampleState(), { theme: DEFAULT_THEMES.classic });
    expect(log[0]).toBe('clearRect(0,0,400,400)');
    expect(log[1]).toBe('fillStyle="#ffffff"');
    expect(log[2]).toBe('fillRect(0,0,400,400)');
    expect(sha([log[0], ...log.slice(3)])).toBe(OLD_CLASSIC_SOLID_OBJECTS);
  });
  it('uses Classic when no theme is given', () => {
    const a = recordingContext();
    const b = recordingContext();
    render(a.ctx, sampleState(), {});
    render(b.ctx, sampleState(), { theme: DEFAULT_THEMES.classic });
    expect(a.log).toEqual(b.log);
  });
});

describe('traceShape', () => {
  const trace = (shape, cx = 100, cy = 100, h = 10) => {
    const { ctx, log } = recordingContext();
    traceShape(ctx, shape, cx, cy, h);
    return log;
  };
  // Every coordinate a path call mentions, as the extent it can reach.
  const extent = (log) => {
    const xs = [];
    const ys = [];
    log.forEach((line) => {
      const [name] = line.split('(');
      const n = nums(line);
      if (name === 'moveTo' || name === 'lineTo') { xs.push(n[0]); ys.push(n[1]); }
      if (name === 'arc') { xs.push(n[0] - n[2], n[0] + n[2]); ys.push(n[1] - n[2], n[1] + n[2]); }
      if (name === 'rect' || name === 'roundRect') { xs.push(n[0], n[0] + n[2]); ys.push(n[1], n[1] + n[3]); }
    });
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  };

  it.each(SHAPES)('%s starts a path, never fills, and stays inside its cell box', (shape) => {
    const log = trace(shape);
    expect(log[0]).toBe('beginPath()');
    expect(log.some((l) => l.startsWith('fill(') || l.startsWith('stroke('))).toBe(false);
    const e = extent(log);
    expect(e.minX).toBeGreaterThanOrEqual(90 - 1e-6);
    expect(e.maxX).toBeLessThanOrEqual(110 + 1e-6);
    expect(e.minY).toBeGreaterThanOrEqual(90 - 1e-6);
    expect(e.maxY).toBeLessThanOrEqual(110 + 1e-6);
  });
  it('gives every shape a distinct sequence of calls', () => {
    const seen = new Set(SHAPES.map((s) => trace(s).join('|')));
    expect(seen.size).toBe(SHAPES.length);
  });
  it('moves with the centre', () => {
    SHAPES.forEach((s) => {
      const a = extent(trace(s, 100, 100));
      const b = extent(trace(s, 300, 50));
      expect(b.minX - a.minX).toBeCloseTo(200);
      expect(b.minY - a.minY).toBeCloseTo(-50);
    });
  });
  it('draws a plain rectangle for square and a rounded one for rounded', () => {
    expect(trace('square')).toEqual(['beginPath()', 'rect(90,90,20,20)']);
    expect(trace('rounded')[1].startsWith('roundRect(90,90,20,20,')).toBe(true);
  });
  it('lets the caller set the corner radius of the rounded square', () => {
    const { ctx, log } = recordingContext();
    traceShape(ctx, 'rounded', 100, 100, 10, 7);
    expect(log[1]).toBe('roundRect(90,90,20,20,7)');
  });
  it('points the triangle up', () => {
    const pts = trace('triangle').filter((l) => l.startsWith('moveTo') || l.startsWith('lineTo')).map(nums);
    expect(pts[0][1]).toBe(90);
    expect(pts.slice(1).every(([, y]) => y > 90)).toBe(true);
  });
  it.each([['hexagon', 6], ['star', 10], ['cross', 12], ['diamond', 4], ['triangle', 3]])('%s has %i corners', (shape, corners) => {
    const pts = trace(shape).filter((l) => l.startsWith('moveTo') || l.startsWith('lineTo'));
    expect(pts).toHaveLength(corners);
  });
  it('falls back to the rounded square for an unknown shape', () => {
    expect(trace('blob')).toEqual(trace('rounded'));
  });
});

describe('render with a theme', () => {
  const neon = DEFAULT_THEMES.neon;
  const fills = (log) => log.filter((l) => l.startsWith('fillStyle=')).map((l) => JSON.parse(l.slice(10)));
  const strokes = (log) => log.filter((l) => l.startsWith('strokeStyle=')).map((l) => JSON.parse(l.slice(12)));

  it('paints the board background and the grid in the theme colours', () => {
    const { ctx, log } = recordingContext();
    render(ctx, sampleState(), { theme: neon });
    expect(log.slice(0, 3)).toEqual(['clearRect(0,0,400,400)', `fillStyle="${neon.colors.board}"`, 'fillRect(0,0,400,400)']);
    expect(strokes(log)[0]).toBe(neon.colors.grid);
  });
  it('draws every object in its theme colour and no Classic colour', () => {
    const { ctx, log } = recordingContext();
    render(ctx, sampleState(), { theme: neon });
    const c = neon.colors;
    const used = new Set(fills(log));
    [c.board, c.head, c.body, c.apple, c.wall, c.bomb, c.spark, c.enemyHead, c.enemyBody, c.dead].forEach((color) => expect(used).toContain(color));
    ['#1f7a5c', '#14573f', '#c2410c', '#334155', '#111827'].forEach((old) => expect(used).not.toContain(old));
  });
  it('draws the shapes the theme names', () => {
    const shapes = { head: 'circle', body: 'circle', apple: 'star', wall: 'hexagon', bomb: 'triangle', enemyHead: 'cross', enemyBody: 'cross', dead: 'diamond' };
    const theme = { ...neon, shapes };
    const { ctx, log } = recordingContext();
    render(ctx, { ...sampleState(), food: null, snake: [{ x: 1, y: 1 }], hazards: { walls: [], bombs: [], enemies: [] } }, { theme });
    expect(log.some((l) => l.startsWith('arc('))).toBe(true);
    expect(log.some((l) => l.startsWith('roundRect('))).toBe(false);
  });
  it('draws the apple and the walls from their own shapes', () => {
    const theme = { ...neon, shapes: { ...neon.shapes, apple: 'diamond', wall: 'circle' } };
    const state = { ...sampleState(), snake: [], hazards: { ...sampleState().hazards, bombs: [], enemies: [] } };
    const { ctx, log } = recordingContext();
    render(ctx, state, { theme });
    // Two wall cells as circles, one apple as a diamond (closePath), no rect.
    expect(log.filter((l) => l.startsWith('arc(')).length).toBe(2);
    expect(log.filter((l) => l === 'closePath()').length).toBe(1);
    expect(log.some((l) => l.startsWith('rect('))).toBe(false);
  });
  it('places the bomb spark in the spark colour at the upper right of the bomb', () => {
    const { ctx, log } = recordingContext();
    const state = { ...sampleState(), snake: [], food: null, hazards: { walls: [], enemies: [], bombs: [{ cells: [{ x: 10, y: 10 }], age: 30, telegraph: 24 }] } };
    render(ctx, state, { theme: neon });
    const i = log.indexOf(`fillStyle="${neon.colors.spark}"`);
    expect(i).toBeGreaterThan(0);
    const [x, y] = nums(log[i + 2]);
    expect(x).toBeGreaterThan(10.5 * 20);
    expect(y).toBeLessThan(10.5 * 20);
  });
  it('draws a dead enemy in the dead colour and shape with the dark cross on top', () => {
    const theme = { ...neon, shapes: { ...neon.shapes, dead: 'circle' } };
    const state = { ...sampleState(), snake: [], food: null, hazards: { walls: [], bombs: [], enemies: [{ cells: [{ x: 3, y: 3 }], status: 'dead', age: 1 }] } };
    const { ctx, log } = recordingContext();
    render(ctx, state, { theme });
    const fill = log.indexOf(`fillStyle="${neon.colors.dead}"`);
    expect(fill).toBeGreaterThan(-1);
    expect(log[fill + 2].startsWith('arc(')).toBe(true);
    expect(log.slice(fill)).toContain('strokeStyle="#374151"');
  });
  it('draws a live enemy head and body in the enemy colours', () => {
    const { ctx, log } = recordingContext();
    const state = { ...sampleState(), snake: [], food: null, hazards: { walls: [], bombs: [], enemies: [{ cells: [{ x: 3, y: 3 }, { x: 4, y: 3 }], status: 'alive', age: 1 }] } };
    render(ctx, state, { theme: neon });
    expect(fills(log).slice(1)).toEqual([neon.colors.enemyHead, neon.colors.enemyBody]);
  });

  describe('ghosts', () => {
    const ghostsOnly = (hazards) => ({ ...sampleState(), snake: [], food: null, hazards: { walls: [], bombs: [], enemies: [], ...hazards } });
    const ghost = { age: 0, telegraph: 24 };

    it('outline a wall in the wall colour as a dashed wall shape, with a faint fill of that colour', () => {
      const theme = { ...neon, shapes: { ...neon.shapes, wall: 'hexagon' } };
      const { ctx, log } = recordingContext();
      render(ctx, ghostsOnly({ walls: [{ cells: [{ x: 2, y: 2 }], ...ghost }] }), { theme });
      const dash = log.findIndex((l) => l.startsWith('setLineDash('));
      expect(dash).toBeGreaterThan(-1);
      const rest = log.slice(dash);
      expect(rest).toContain(`strokeStyle="${theme.colors.wall}"`);
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(theme.colors.wall.slice(i, i + 2), 16));
      expect(rest).toContain(`fillStyle="rgba(${r}, ${g}, ${b}, 0.18)"`);
      expect(rest.filter((l) => l.startsWith('lineTo(')).length).toBe(5);
      expect(rest).toContain('stroke()');
      expect(rest[rest.length - 1]).toBe('restore()');
    });
    it('outline a bomb in the bomb colour and shape', () => {
      const { ctx, log } = recordingContext();
      render(ctx, ghostsOnly({ bombs: [{ cells: [{ x: 2, y: 2 }], ...ghost }] }), { theme: neon });
      const rest = log.slice(log.findIndex((l) => l.startsWith('setLineDash(')));
      expect(rest).toContain(`strokeStyle="${neon.colors.bomb}"`);
      // neon bomb is a star: ten corners
      expect(rest.filter((l) => l.startsWith('lineTo(')).length).toBe(9);
    });
    it('outline an enemy in the enemy body colour and shape', () => {
      const { ctx, log } = recordingContext();
      render(ctx, ghostsOnly({ enemies: [{ cells: [{ x: 2, y: 2 }], status: 'ghost', ...ghost }] }), { theme: neon });
      const rest = log.slice(log.findIndex((l) => l.startsWith('setLineDash(')));
      expect(rest).toContain(`strokeStyle="${neon.colors.enemyBody}"`);
      expect(rest.filter((l) => l.startsWith('lineTo(')).length).toBe(3); // diamond
    });
    it('flash off when motion is allowed and stay on under reduced motion', () => {
      const off = ghostsOnly({ walls: [{ cells: [{ x: 2, y: 2 }], age: 5, telegraph: 24 }] });
      const motion = recordingContext();
      render(motion.ctx, off, { theme: neon });
      expect(motion.log.some((l) => l.startsWith('setLineDash('))).toBe(false);
      const calm = recordingContext();
      render(calm.ctx, off, { theme: neon, reducedMotion: true });
      expect(calm.log.some((l) => l.startsWith('setLineDash('))).toBe(true);
    });
  });

  it('keeps fading solid objects translucent', () => {
    const state = { ...sampleState(), snake: [], food: null, hazards: { bombs: [], enemies: [], walls: [{ cells: [{ x: 2, y: 2 }], age: 44, telegraph: 24, fades: true, fadeSteps: 40 }] } };
    const { ctx, log } = recordingContext();
    render(ctx, state, { theme: neon });
    expect(log).toContain('globalAlpha=0.5');
  });
  it('accepts a sanitized theme', () => {
    const { ctx } = recordingContext();
    expect(() => render(ctx, sampleState({ ghosts: true }), { theme: sanitizeTheme({}) })).not.toThrow();
  });
});
