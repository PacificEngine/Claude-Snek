# Difficulty Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Easy / Medium / Hard / Custom difficulty menu with 23 settings (locked for presets, editable for Custom), a per-difficulty best score (none for Custom), and make the game core honour those settings.

**Architecture:** A pure `difficulty.js` defines the 23 fields, the three presets and validation. The active `settings` live in the game state and are passed to the places that need them (grid size, growth, tempo, hazard rules). Everything defaults to the Medium preset and a 20×20 grid, so older tests stay valid. Storage keeps one best score per preset plus the chosen difficulty and the Custom values. A native `<dialog>` menu (built with DOM APIs, no innerHTML) edits Custom and applies a difficulty by starting a fresh run.

**Tech Stack:** Vanilla JavaScript (ES modules, no build step), HTML Canvas, Web Audio, Vitest (dev-only, via yarn).

**Specs:** `docs/specs/snake-game/difficulty.md` (primary), `docs/specs/snake-game/hazards.md`, `docs/specs/snake-game/snake-game.md`.

## Global Constraints

- Vanilla JavaScript with ES modules, no build step, zero runtime dependencies; use `yarn` only (never npm, pnpm or bun). No `innerHTML` or `eval`; CSP unchanged (no inline scripts or styles).
- Core logic stays pure; randomness injected. Defaults: grid 20, `PRESETS.medium` — a state without `settings` behaves as Medium so existing tests keep passing until a task migrates them.
- "Apples" always means apples eaten (`state.score`), never snake length.
- The 23 fields (key → Easy / Medium / Hard; range, step): `gridSize` 16/20/40 (10–50, 1); `speed` 0.6/1.0/1.2 (0.1–2, 0.1); `growth` 0.5/1/2 (0–4, 0.1); `ghostTime` 36/24/12 (0–40, 1); `wallTrigger` 16/16/16 (1–100); `wallSize` 2/3/6 (1–10); `wallCount` 2/4/8 (1–20); `bombTrigger` 32/32/32 (1–100); `bombRate` 4/4/1 (1–10); `bombCount` 1/1/2 (1–5); `bombMax` 6/12/20 (1–25); `wallSpawnTrigger` 48/48/48 (1–100); `wallSpawnSize` 1/2/4 (1–10); `wallSpawnRate` 2/1/1 (1–10); `wallSpawnCount` 1/1/2 (1–5); `wallSpawnMax` 40/80/200 (10–250 cells); `enemyTrigger` 64/64/64 (1–100); `enemySize` 2/3/6 (1–10); `enemyRate` 5/5/5 (1–10); `enemyMax` 1/1/4 (1–5); `movingWallTrigger` 80/80/80 (1–100); `invisibleTrigger` 100/100/100 (1–100); `invisibleTiming` 20/16/8 (1–40). Integers unless the step is 0.1.
- Rules: base BPM = `min(200, 120 + 4·floor(apples/4))` × `speed`. Growth accumulates in tenths (`Math.round(growth*10)`), whole cells become pending growth added one per step; score is +1 per apple. Ghost time for an obstacle placed on apple count `a`: `ghostTime` if `a <= 60`, `round(ghostTime/2)` if `61..120`, `round(ghostTime/4)` if `a > 120`; 0 means solid immediately. First walls: when `apples === wallTrigger`, `wallCount` segments of `wallSize`. Bombs: target `0` below `bombTrigger`, else `min(bombMax, bombCount·(1+floor((apples−bombTrigger)/bombRate)))`; every bomb re-placed on every apple. Spawning walls: from `wallSpawnTrigger`, on apples where `(apples−trigger) % wallSpawnRate === 0`, add up to `wallSpawnCount` segments of `wallSpawnSize` while spawned wall cells stay `<= wallSpawnMax` (only walls with `origin: 'spawn'` count). Enemies: target `0` below `enemyTrigger`, else `min(enemyMax, 1+floor((apples−trigger)/enemyRate))`; each dead enemy is replaced by a fresh ghost on the next apple. Moving walls: from `movingWallTrigger`, every apple re-lays all walls. Invisible: walls and bombs placed on apples `>= invisibleTrigger` get `fades: true, fadeSteps: invisibleTiming`; opacity `1 - (age - ghost)/fadeSteps`; enemies never fade.
- All earlier hazard rules still hold (safe distance 5, lane 10, 50 attempts, ghosts never solid under the snake, route to the food after every placement).
- Custom shows no best score and saves none; Easy/Medium/Hard each have their own; the old single saved score migrates to Medium once. The menu is only usable when no run is in progress.
- Work on branch `feature/difficulty`; commit after each red-green cycle; commit messages explain why; no Claude signature; squash into one commit before finishing.

---

### Task 1: Difficulty settings module

**Files:**
- Create: `src/core/difficulty.js`
- Test: `tests/difficulty.test.js`

**Interfaces:**
- Produces: `DIFFICULTIES = ['easy','medium','hard','custom']`; `FIELDS` (array of `{ key, label, group, min, max, step }` in the order of the table above, groups `Board`, `Walls`, `Bombs`, `Spawning walls`, `Enemies`, `Effects`); `PRESETS = { easy, medium, hard }` (frozen plain objects keyed by field key); `clampField(field, raw): number | undefined`; `sanitize(input, fallback = PRESETS.medium): settings`; `settingsFor(difficulty, custom): settings`; `applyEdit(draft, field, raw): settings`; `describeRange(field): string`; `isDifficulty(value): boolean`; `DEFAULT_DIFFICULTY = 'medium'`.

- [ ] **Step 1: Write the failing tests** (`tests/difficulty.test.js`)

```js
import { describe, it, expect } from 'vitest';
import {
  DIFFICULTIES, FIELDS, PRESETS, clampField, sanitize, settingsFor, applyEdit,
  describeRange, isDifficulty, DEFAULT_DIFFICULTY,
} from '../src/core/difficulty.js';

const field = (key) => FIELDS.find((f) => f.key === key);

const EXPECTED = {
  gridSize: [16, 20, 40], speed: [0.6, 1, 1.2], growth: [0.5, 1, 2], ghostTime: [36, 24, 12],
  wallTrigger: [16, 16, 16], wallSize: [2, 3, 6], wallCount: [2, 4, 8],
  bombTrigger: [32, 32, 32], bombRate: [4, 4, 1], bombCount: [1, 1, 2], bombMax: [6, 12, 20],
  wallSpawnTrigger: [48, 48, 48], wallSpawnSize: [1, 2, 4], wallSpawnRate: [2, 1, 1],
  wallSpawnCount: [1, 1, 2], wallSpawnMax: [40, 80, 200],
  enemyTrigger: [64, 64, 64], enemySize: [2, 3, 6], enemyRate: [5, 5, 5], enemyMax: [1, 1, 4],
  movingWallTrigger: [80, 80, 80], invisibleTrigger: [100, 100, 100], invisibleTiming: [20, 16, 8],
};

describe('field table', () => {
  it('has the 23 fields in order with their ranges', () => {
    expect(FIELDS).toHaveLength(23);
    expect(FIELDS.map((f) => f.key)).toEqual(Object.keys(EXPECTED));
    expect(field('gridSize')).toMatchObject({ min: 10, max: 50, step: 1 });
    expect(field('speed')).toMatchObject({ min: 0.1, max: 2, step: 0.1 });
    expect(field('growth')).toMatchObject({ min: 0, max: 4, step: 0.1 });
    expect(field('ghostTime')).toMatchObject({ min: 0, max: 40 });
    expect(field('wallSpawnMax')).toMatchObject({ min: 10, max: 250 });
    expect(field('invisibleTiming')).toMatchObject({ min: 1, max: 40 });
  });
});

describe('presets', () => {
  it.each([['easy', 0], ['medium', 1], ['hard', 2]])('%s matches the table exactly', (name, i) => {
    const expected = Object.fromEntries(Object.entries(EXPECTED).map(([k, v]) => [k, v[i]]));
    expect(PRESETS[name]).toEqual(expected);
  });
  it('keeps every preset value inside its own range and step', () => {
    for (const preset of Object.values(PRESETS)) {
      FIELDS.forEach((f) => expect(clampField(f, preset[f.key])).toBe(preset[f.key]));
    }
  });
  it('lists the four difficulties and defaults to medium', () => {
    expect(DIFFICULTIES).toEqual(['easy', 'medium', 'hard', 'custom']);
    expect(DEFAULT_DIFFICULTY).toBe('medium');
    expect(isDifficulty('hard')).toBe(true);
    expect(isDifficulty('nightmare')).toBe(false);
  });
});

describe('clampField', () => {
  it('clamps to the range', () => {
    expect(clampField(field('gridSize'), 5)).toBe(10);
    expect(clampField(field('gridSize'), 99)).toBe(50);
    expect(clampField(field('growth'), -1)).toBe(0);
  });
  it('rounds to the step without float noise', () => {
    expect(clampField(field('speed'), 0.34)).toBe(0.3);
    expect(clampField(field('growth'), 0.3)).toBe(0.3);
    expect(clampField(field('speed'), 1.96)).toBe(2);
    expect(clampField(field('gridSize'), 20.6)).toBe(21);
  });
  it('accepts numeric strings', () => {
    expect(clampField(field('ghostTime'), '17')).toBe(17);
    expect(clampField(field('speed'), ' 0.7 ')).toBe(0.7);
  });
  it('rejects things that are not finite numbers', () => {
    for (const bad of ['', '   ', 'abc', NaN, Infinity, -Infinity, null, undefined, {}, [], true]) {
      expect(clampField(field('gridSize'), bad)).toBeUndefined();
    }
  });
});

describe('sanitize and settingsFor', () => {
  it('fills missing and corrupt fields from the fallback, field by field', () => {
    const s = sanitize({ gridSize: 30, speed: 'fast', growth: 99, bogus: 1 });
    expect(s.gridSize).toBe(30);
    expect(s.speed).toBe(PRESETS.medium.speed);
    expect(s.growth).toBe(4);
    expect(s).not.toHaveProperty('bogus');
    expect(Object.keys(s)).toEqual(FIELDS.map((f) => f.key));
  });
  it('treats non-objects as empty', () => {
    for (const bad of [null, undefined, 'x', 7, [1, 2, 3]]) expect(sanitize(bad)).toEqual(PRESETS.medium);
  });
  it('returns the preset for easy/medium/hard and a sanitized object for custom', () => {
    expect(settingsFor('easy')).toBe(PRESETS.easy);
    expect(settingsFor('hard')).toBe(PRESETS.hard);
    expect(settingsFor('custom', { gridSize: 12 }).gridSize).toBe(12);
    expect(settingsFor('custom', { gridSize: 12 }).speed).toBe(1);
  });
  it('falls back to medium for an unknown difficulty', () => {
    expect(settingsFor('nightmare')).toBe(PRESETS.medium);
  });
});

describe('applyEdit and describeRange', () => {
  it('returns a new draft with the corrected value', () => {
    const draft = { ...PRESETS.medium };
    const next = applyEdit(draft, field('gridSize'), '999');
    expect(next.gridSize).toBe(50);
    expect(next).not.toBe(draft);
    expect(draft.gridSize).toBe(20);
  });
  it('keeps the old value when the input is not a number', () => {
    const draft = { ...PRESETS.medium };
    expect(applyEdit(draft, field('gridSize'), 'abc').gridSize).toBe(20);
  });
  it('describes ranges for labels', () => {
    expect(describeRange(field('gridSize'))).toBe('10–50');
    expect(describeRange(field('speed'))).toBe('0.1–2, step 0.1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/difficulty.test.js`
Expected: FAIL — cannot find `../src/core/difficulty.js`.

- [ ] **Step 3: Write the implementation** (`src/core/difficulty.js`)

```js
export const DIFFICULTIES = ['easy', 'medium', 'hard', 'custom'];
export const DEFAULT_DIFFICULTY = 'medium';
export const isDifficulty = (value) => DIFFICULTIES.includes(value);

const f = (key, label, group, min, max, step = 1) => ({ key, label, group, min, max, step });

export const FIELDS = [
  f('gridSize', 'Grid Size', 'Board', 10, 50),
  f('speed', 'Game Speed Modifier', 'Board', 0.1, 2, 0.1),
  f('growth', 'Growth Count', 'Board', 0, 4, 0.1),
  f('ghostTime', 'Ghost Time', 'Board', 0, 40),
  f('wallTrigger', 'Wall Trigger', 'Walls', 1, 100),
  f('wallSize', 'Wall Size', 'Walls', 1, 10),
  f('wallCount', 'Wall Count', 'Walls', 1, 20),
  f('bombTrigger', 'Bomb Trigger', 'Bombs', 1, 100),
  f('bombRate', 'Bomb Spawn Rate', 'Bombs', 1, 10),
  f('bombCount', 'Bomb Spawn Count', 'Bombs', 1, 5),
  f('bombMax', 'Bomb Spawn Max', 'Bombs', 1, 25),
  f('wallSpawnTrigger', 'Wall Spawn Trigger', 'Spawning walls', 1, 100),
  f('wallSpawnSize', 'Wall Spawn Size', 'Spawning walls', 1, 10),
  f('wallSpawnRate', 'Wall Spawn Rate', 'Spawning walls', 1, 10),
  f('wallSpawnCount', 'Wall Spawn Count', 'Spawning walls', 1, 5),
  f('wallSpawnMax', 'Wall Spawn Max (cells)', 'Spawning walls', 10, 250),
  f('enemyTrigger', 'Enemy Spawn Trigger', 'Enemies', 1, 100),
  f('enemySize', 'Enemy Spawn Size', 'Enemies', 1, 10),
  f('enemyRate', 'Enemy Spawn Rate', 'Enemies', 1, 10),
  f('enemyMax', 'Enemy Spawn Max', 'Enemies', 1, 5),
  f('movingWallTrigger', 'Moving Wall Trigger', 'Effects', 1, 100),
  f('invisibleTrigger', 'Invisible Hazard Trigger', 'Effects', 1, 100),
  f('invisibleTiming', 'Invisible Hazard Timing', 'Effects', 1, 40),
];

export const PRESETS = Object.freeze({
  easy: Object.freeze({
    gridSize: 16, speed: 0.6, growth: 0.5, ghostTime: 36,
    wallTrigger: 16, wallSize: 2, wallCount: 2,
    bombTrigger: 32, bombRate: 4, bombCount: 1, bombMax: 6,
    wallSpawnTrigger: 48, wallSpawnSize: 1, wallSpawnRate: 2, wallSpawnCount: 1, wallSpawnMax: 40,
    enemyTrigger: 64, enemySize: 2, enemyRate: 5, enemyMax: 1,
    movingWallTrigger: 80, invisibleTrigger: 100, invisibleTiming: 20,
  }),
  medium: Object.freeze({
    gridSize: 20, speed: 1, growth: 1, ghostTime: 24,
    wallTrigger: 16, wallSize: 3, wallCount: 4,
    bombTrigger: 32, bombRate: 4, bombCount: 1, bombMax: 12,
    wallSpawnTrigger: 48, wallSpawnSize: 2, wallSpawnRate: 1, wallSpawnCount: 1, wallSpawnMax: 80,
    enemyTrigger: 64, enemySize: 3, enemyRate: 5, enemyMax: 1,
    movingWallTrigger: 80, invisibleTrigger: 100, invisibleTiming: 16,
  }),
  hard: Object.freeze({
    gridSize: 40, speed: 1.2, growth: 2, ghostTime: 12,
    wallTrigger: 16, wallSize: 6, wallCount: 8,
    bombTrigger: 32, bombRate: 1, bombCount: 2, bombMax: 20,
    wallSpawnTrigger: 48, wallSpawnSize: 4, wallSpawnRate: 1, wallSpawnCount: 2, wallSpawnMax: 200,
    enemyTrigger: 64, enemySize: 6, enemyRate: 5, enemyMax: 4,
    movingWallTrigger: 80, invisibleTrigger: 100, invisibleTiming: 8,
  }),
});

const decimals = (step) => (String(step).split('.')[1] ?? '').length;

// A number inside the field's range and on its step, or undefined if `raw` is not a finite number.
export function clampField(field, raw) {
  let n = raw;
  if (typeof n === 'string') n = n.trim() === '' ? NaN : Number(n);
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  const stepped = Math.round(n / field.step) * field.step;
  const bounded = Math.min(field.max, Math.max(field.min, stepped));
  return Number(bounded.toFixed(decimals(field.step)));
}

// A complete, valid settings object; every bad or missing field comes from `fallback`.
export function sanitize(input, fallback = PRESETS.medium) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return Object.fromEntries(FIELDS.map((fld) => [fld.key, clampField(fld, source[fld.key]) ?? fallback[fld.key]]));
}

export const settingsFor = (difficulty, custom) =>
  difficulty === 'custom' ? sanitize(custom) : PRESETS[difficulty] ?? PRESETS.medium;

export function applyEdit(draft, field, raw) {
  const value = clampField(field, raw);
  return value === undefined ? draft : { ...draft, [field.key]: value };
}

export const describeRange = (field) =>
  field.step === 1 ? `${field.min}–${field.max}` : `${field.min}–${field.max}, step ${field.step}`;
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `yarn test`
Expected: PASS (whole suite).

```bash
git add src/core/difficulty.js tests/difficulty.test.js
git commit -m "feat: define the 23 difficulty settings, their presets and validation so every setting is checked in one place"
```

---

### Task 2: Grid size as a setting

**Files:**
- Modify: `src/core/grid.js`, `src/core/pathing.js`, `src/core/game.js`, `src/core/hazards.js`, `src/renderer.js`
- Modify: `tests/grid.test.js`, `tests/pathing.test.js`, `tests/game.test.js`, `tests/hazards.test.js` (append)

**Interfaces:**
- Produces: `inBounds(cell, size = 20)`, `neighbors(cell, size = 20)`, `allCells(size = 20)`; `reachable(snake, blocked, size = 20)`, `hasRoute(snake, blocked, food, size = 20)`; `placeFood(snake, rng, blocked = new Set(), size = 20)`; `createState(rng, settings = PRESETS.medium)` returns the state with `settings` and `growth: { carry: 0, pending: 0 }` and the snake centred on `floor(gridSize/2)`; the hazard world is `{ snake, direction, food, hazards, size }` (`size` optional, default 20); `stepHazards(hazards, { snake, food, size }, rng)`; `tick` uses `state.settings?.gridSize` for all of the above; `render` draws cells of `canvas.width / gridSize` where `gridSize = state.settings?.gridSize ?? 20`.
- Defaults keep every existing test valid. **Careful:** never write `.filter(inBounds)` — `filter` passes the index as the second argument; always `(n) => inBounds(n, size)`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/grid.test.js` (add `inBounds`, `neighbors`, `allCells` are already imported):
```js
describe('grid helpers on other sizes', () => {
  it('knows custom bounds', () => {
    expect(inBounds({ x: 9, y: 9 }, 10)).toBe(true);
    expect(inBounds({ x: 10, y: 0 }, 10)).toBe(false);
    expect(inBounds({ x: 49, y: 49 }, 50)).toBe(true);
    expect(inBounds({ x: 20, y: 0 })).toBe(false); // default stays 20
  });
  it('limits neighbours to the board', () => {
    expect(neighbors({ x: 9, y: 9 }, 10)).toHaveLength(2);
    expect(neighbors({ x: 19, y: 19 }, 50)).toHaveLength(4);
  });
  it('lists size × size cells', () => {
    expect(allCells(10)).toHaveLength(100);
    expect(allCells(50)).toHaveLength(2500);
    expect(allCells(10).at(-1)).toEqual({ x: 9, y: 9 });
  });
});
```
Append to `tests/pathing.test.js`:
```js
describe('other board sizes', () => {
  const small = [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }];
  it('reaches every cell of a 10x10 board and nothing outside it', () => {
    const cells = reachable(small, new Set(), 10);
    expect(cells.size).toBe(100);
    expect(cells.has('10,2')).toBe(false);
  });
  it('is split by a full wall on a 10x10 board', () => {
    const wall = new Set(Array.from({ length: 10 }, (_, y) => `5,${y}`));
    expect(hasRoute(small, wall, { x: 8, y: 2 }, 10)).toBe(false);
    expect(hasRoute(small, new Set(), { x: 8, y: 2 }, 10)).toBe(true);
  });
  it('covers a 50x50 board', () => {
    expect(reachable(small, new Set(), 50).size).toBe(2500);
  });
});
```
Append to `tests/game.test.js` (add `PRESETS` import: `import { PRESETS } from '../src/core/difficulty.js';`):
```js
describe('grid size from the settings', () => {
  const sized = (gridSize) => ({ ...PRESETS.medium, gridSize });
  it.each([[10, 5], [16, 8], [20, 10], [40, 20], [50, 25]])('starts centred on a %i board at %i', (size, mid) => {
    const s = createState(rng, sized(size));
    expect(s.snake[0]).toEqual({ x: mid, y: mid });
    expect(s.snake).toHaveLength(START_LENGTH);
    expect(s.settings.gridSize).toBe(size);
    expect(s.growth).toEqual({ carry: 0, pending: 0 });
  });
  it('defaults to the medium preset', () => {
    expect(createState(rng).settings).toBe(PRESETS.medium);
  });
  it('ends the game at the edge of a small board', () => {
    const s = stateWith({ snake: [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }], settings: sized(10) });
    expect(tick(s, rng).status).toBe('gameOver');
  });
  it('lets the same move continue on the default board', () => {
    const s = stateWith({ snake: [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }] });
    expect(tick(s, rng).status).toBe('playing');
  });
  it('places food inside a small board', () => {
    for (let i = 0; i < 50; i++) {
      const f = placeFood([{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], () => (i + 0.5) / 50, new Set(), 10);
      expect(f.x).toBeLessThan(10);
      expect(f.y).toBeLessThan(10);
    }
  });
});
```
Append to `tests/hazards.test.js` (use the file's existing `seeded`, `snake`, `world`, `emptyHazards`, `placeSegment`, `placeCell`, `stepHazards`; add `PRESETS` import if needed):
```js
describe('placement on other board sizes', () => {
  const on = (size, overrides = {}) => ({ snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], direction: 'right', food: { x: 0, y: 0 }, hazards: emptyHazards(), size, ...overrides });
  it('keeps segments and single cells inside a 10x10 board', () => {
    let placed = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const cells = placeSegment(on(10), 3, seeded(seed));
      if (!cells) continue;
      placed++;
      cells.forEach((c) => { expect(c.x).toBeLessThan(10); expect(c.y).toBeLessThan(10); });
    }
    expect(placed).toBeGreaterThan(0);
  });
  it('uses the whole of a 50x50 board', () => {
    let maxX = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const cell = placeCell(on(50, { snake: [{ x: 25, y: 25 }, { x: 24, y: 25 }, { x: 23, y: 25 }] }), seeded(seed));
      if (cell) maxX = Math.max(maxX, cell[0].x);
    }
    expect(maxX).toBeGreaterThan(30);
  });
  it('moves an enemy only inside a small board', () => {
    const enemy = { cells: [{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 7, y: 9 }], age: 0, status: 'alive' };
    let h = { walls: [], bombs: [], enemy };
    for (let i = 0; i < 60; i++) {
      h = stepHazards(h, { snake: [{ x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }], food: { x: 2, y: 8 }, size: 10 }, seeded(i + 1));
      h.enemy.cells.forEach((c) => { expect(c.x).toBeLessThan(10); expect(c.y).toBeLessThan(10); });
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test`
Expected: FAIL — helpers ignore `size`, `createState` ignores settings, `settings`/`growth` are missing from the state.

- [ ] **Step 3: Write the implementation**

`src/core/grid.js` — replace the three size-dependent functions:
```js
export const inBounds = ({ x, y }, size = GRID_SIZE) => x >= 0 && y >= 0 && x < size && y < size;

export const neighbors = (cell, size = GRID_SIZE) =>
  Object.values(VECTORS)
    .map((v) => ({ x: cell.x + v.x, y: cell.y + v.y }))
    .filter((n) => inBounds(n, size));

export function allCells(size = GRID_SIZE) {
  const cells = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) cells.push({ x, y });
  }
  return cells;
}
```
`src/core/pathing.js` — add `import { GRID_SIZE } from './config.js';`, change the signatures to `reachable(snake, blocked, size = GRID_SIZE)` and `hasRoute(snake, blocked, food, size = GRID_SIZE)`, call `neighbors(cell, size)`, and `reachable(snake, blocked, size)` inside `hasRoute`.

`src/core/game.js`:
```js
import { START_LENGTH } from './config.js';
import { VECTORS, OPPOSITE, cellKey, sameCell, inBounds, allCells } from './grid.js';
import { reachable } from './pathing.js';
import { PRESETS } from './difficulty.js';
import { emptyHazards, hitsHazard, stepHazards, spawnForApple, blockedKeys } from './hazards.js';

export function placeFood(snake, rng, blocked = new Set(), size = PRESETS.medium.gridSize) {
  const occupied = new Set([...snake.map(cellKey), ...blocked]);
  const free = allCells(size).filter((c) => !occupied.has(cellKey(c)));
  if (free.length === 0) return null;
  const reach = reachable(snake, blocked, size);
  const onRoute = free.filter((c) => reach.has(cellKey(c)));
  const pool = onRoute.length > 0 ? onRoute : free;
  return pool[Math.floor(rng() * pool.length)];
}

export function createState(rng, settings = PRESETS.medium) {
  const size = settings.gridSize;
  const mid = Math.floor(size / 2);
  const snake = Array.from({ length: START_LENGTH }, (_, i) => ({ x: mid - i, y: mid }));
  return {
    snake,
    direction: 'right',
    queued: [],
    food: placeFood(snake, rng, new Set(), size),
    score: 0,
    hazards: emptyHazards(),
    settings,
    growth: { carry: 0, pending: 0 },
    status: 'playing',
  };
}
```
In `tick`: add `const size = (state.settings ?? PRESETS.medium).gridSize;` after the status check; use `!inBounds(newHead, size)`; `stepHazards(hazards, { snake, food: state.food, size }, rng)`; `placeFood(snake, rng, blockedKeys(nextHazards), size)`; `spawnForApple({ snake, direction, food, size }, nextHazards, rng, score)`. Keep the rest unchanged.

`src/core/hazards.js` — in `segmentCandidate(length)` and `singleCandidate`, take the board size: change to `segmentCandidate(length, size)` using `size` in place of `GRID_SIZE`, and `singleCandidate = (size) => (rng) => [{ x: Math.floor(rng() * size), y: Math.floor(rng() * size) }]`. In `tryPlace`, add `const size = world.size ?? GRID_SIZE;`, use `inBounds(c, size)` and `hasRoute(snake, blocked, food, size)`. `placeSegment = (world, length, rng) => tryPlace(world, segmentCandidate(length, world.size ?? GRID_SIZE), rng)`; `placeCell = (world, rng) => tryPlace(world, singleCandidate(world.size ?? GRID_SIZE), rng)`. In `stepEnemy` take `size = GRID_SIZE` from its arguments object and pass it to `neighbors(enemy.cells[0], size)` and `hasRoute(snake, withEnemy, food, size)`; `stepHazards(hazards, { snake, food, size }, rng)` passes `size` through. (`GRID_SIZE` is still imported from `./config.js` as the default.)

`src/renderer.js` — remove the `GRID_SIZE` loop bound: `drawGrid(ctx, size, count)` loops `i < count`; in `render` compute `const count = state.settings?.gridSize ?? GRID_SIZE; const size = ctx.canvas.width / count;` and call `drawGrid(ctx, size, count)`.

- [ ] **Step 4: Run to verify it passes**

Run: `node --check src/renderer.js && yarn test`
Expected: PASS (whole suite).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: make the board size a setting so the game can run on grids from 10 to 50"
```

---

### Task 3: Count apples (not length) and apply the speed modifier

**Files:**
- Modify: `src/core/pacing.js`, `src/core/hazards.js` (one line), `src/main.js`
- Modify: `tests/pacing.test.js`

**Interfaces:**
- Produces: `bpm(apples, speed = 1)` and `musicTier(apples)`; both take **apples eaten** (the score), not the snake length. `stepSeconds` unchanged. In `main.js`, `getBpm` is `bpm(state.score, state.settings.speed)` and the tier gate reads `musicTier(state.score)`.
- Why a separate task: growth is about to make length ≠ apples + 3.

- [ ] **Step 1: Write the failing tests** — replace `tests/pacing.test.js` with:

```js
import { describe, it, expect } from 'vitest';
import { bpm, musicTier, stepSeconds } from '../src/core/pacing.js';

// the argument is now APPLES EATEN (the score)
describe('bpm', () => {
  it('starts at 120', () => {
    expect(bpm(0)).toBe(120);
  });
  it('does not rise for the first three apples', () => {
    expect(bpm(1)).toBe(120);
    expect(bpm(3)).toBe(120);
  });
  it('rises 4 on every 4th apple', () => {
    expect(bpm(4)).toBe(124);
    expect(bpm(7)).toBe(124);
    expect(bpm(8)).toBe(128);
  });
  it('reaches 200 exactly at the 80th apple and stays there', () => {
    expect(bpm(79)).toBe(196);
    expect(bpm(80)).toBe(200);
    expect(bpm(500)).toBe(200);
  });
  it('multiplies by the speed modifier after the 200 cap', () => {
    expect(bpm(0, 0.6)).toBeCloseTo(72);
    expect(bpm(0, 1.2)).toBeCloseTo(144);
    expect(bpm(80, 1.2)).toBeCloseTo(240);
    expect(bpm(500, 2)).toBeCloseTo(400);
    expect(bpm(0, 0.1)).toBeCloseTo(12);
  });
});

describe('musicTier', () => {
  it('is 0 for the first seven apples', () => {
    expect(musicTier(0)).toBe(0);
    expect(musicTier(7)).toBe(0);
  });
  it('rises by one for every 8 apples', () => {
    expect(musicTier(8)).toBe(1);
    expect(musicTier(15)).toBe(1);
    expect(musicTier(16)).toBe(2);
  });
  it('is 9 on apple 79 and 10 on apple 80, capped at 10', () => {
    expect(musicTier(79)).toBe(9);
    expect(musicTier(80)).toBe(10);
    expect(musicTier(500)).toBe(10);
  });
});

describe('stepSeconds', () => {
  it('is one sixteenth note: 0.125s at 120 BPM', () => {
    expect(stepSeconds(120)).toBeCloseTo(0.125);
  });
  it('shrinks as the tempo rises: 0.075s at 200 BPM', () => {
    expect(stepSeconds(200)).toBeCloseTo(0.075);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/pacing.test.js`
Expected: FAIL — `bpm`/`musicTier` still subtract the starting length; `bpm` ignores `speed`.

- [ ] **Step 3: Write the implementation** — replace `src/core/pacing.js` with:

```js
const BASE_BPM = 120;
const BPM_PER_RISE = 4;
const APPLES_PER_RISE = 4;
const MAX_BPM = 200;
const APPLES_PER_TIER = 8;
const MAX_TIER = 10;
const STEPS_PER_BEAT = 4; // one step per sixteenth note

// `apples` is apples eaten (the score); `speed` is the Game Speed Modifier setting.
export const bpm = (apples, speed = 1) =>
  Math.min(MAX_BPM, BASE_BPM + Math.floor(Math.max(0, apples) / APPLES_PER_RISE) * BPM_PER_RISE) * speed;

export const musicTier = (apples) =>
  Math.min(MAX_TIER, Math.floor(Math.max(0, apples) / APPLES_PER_TIER));

export const stepSeconds = (beatsPerMinute) => 60 / beatsPerMinute / STEPS_PER_BEAT;
```
In `src/core/hazards.js` keep the green bar: change `const tierAt = (n) => musicTier(n + START_LENGTH);` to `const tierAt = (n) => musicTier(n);` and drop `START_LENGTH` from the `./config.js` import if it is no longer used there.
In `src/main.js`: `const tierGate = createTierGate(() => musicTier(state.score));` and `getBpm: () => bpm(state.score, state.settings.speed),`.

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `node --check src/main.js && yarn test`
Expected: PASS (whole suite; the hazard tests are unaffected because `tierAt` now maps apples to tiers directly).

```bash
git add src/core/pacing.js src/core/hazards.js src/main.js tests/pacing.test.js
git commit -m "feat: drive tempo and music tier from apples eaten, with a speed modifier, so growth can differ from one cell per apple"
```

---

### Task 4: Growth Count

**Files:**
- Modify: `src/core/game.js`
- Modify: `tests/game.test.js` (append)

**Interfaces:**
- Consumes: `state.settings.growth` (default Medium = 1) and `state.growth = { carry, pending }` (default `{ carry: 0, pending: 0 }` when absent).
- Produces: `tick` — when an apple is eaten the score rises by 1 and `Math.round(growth * 10)` tenths are added to `carry`; each full 10 tenths becomes one `pending` cell; while `pending > 0` the tail stays for that step (the snake grows one cell) and `pending` drops by 1. With growth 1 the behavior is exactly the old "grow one cell on eating".

- [ ] **Step 1: Write the failing tests** — append to `tests/game.test.js`:

```js
describe('growth count', () => {
  const settingsWith = (growth) => ({ ...PRESETS.medium, gridSize: 30, growth });
  const start = (growth) => stateWith({
    snake: [{ x: 3, y: 15 }, { x: 2, y: 15 }, { x: 1, y: 15 }], food: null, settings: settingsWith(growth),
  });
  // put the food right in front of the head and step once
  const eat = (s) => {
    const head = s.snake[0];
    return tick({ ...s, food: { x: head.x + 1, y: head.y } }, rng);
  };
  const steps = (s, n) => { for (let i = 0; i < n; i++) s = tick(s, rng); return s; };

  it('grows one cell per apple at 1 (the old behavior)', () => {
    let s = eat(start(1));
    expect(s.snake).toHaveLength(4);
    expect(s.score).toBe(1);
    s = eat(s);
    expect(s.snake).toHaveLength(5);
  });

  it('never grows at 0, but still scores', () => {
    let s = start(0);
    for (let i = 0; i < 5; i++) s = eat(s);
    expect(s.snake).toHaveLength(3);
    expect(s.score).toBe(5);
  });

  it('needs 2 apples per cell at 0.5', () => {
    let s = eat(start(0.5));
    expect(s.snake).toHaveLength(3);
    s = eat(s);
    expect(s.snake).toHaveLength(4);
    s = eat(eat(s));
    expect(s.snake).toHaveLength(5);
  });

  it('needs 10 apples per cell at 0.1', () => {
    let s = start(0.1);
    for (let i = 0; i < 9; i++) s = eat(s);
    expect(s.snake).toHaveLength(3);
    s = eat(s);
    expect(s.snake).toHaveLength(4);
    expect(s.score).toBe(10);
  });

  it('adds up fractional growth exactly: 0.3 for 10 apples is 3 cells', () => {
    let s = start(0.3);
    for (let i = 0; i < 10; i++) s = eat(s);
    s = steps({ ...s, food: null }, 5);
    expect(s.snake).toHaveLength(6);
  });

  it('adds the new cells one per step at 4', () => {
    let s = eat(start(4));
    expect(s.snake).toHaveLength(4); // grows on the eating step
    s = steps({ ...s, food: null }, 1);
    expect(s.snake).toHaveLength(5);
    s = steps(s, 2);
    expect(s.snake).toHaveLength(7); // 3 + 4
    s = steps(s, 3);
    expect(s.snake).toHaveLength(7); // done
  });

  it('keeps old states without settings or growth behaving like medium', () => {
    const s = tick(stateWith({ food: { x: 6, y: 5 } }), rng);
    expect(s.snake).toHaveLength(4);
    expect(s.growth).toEqual({ carry: 0, pending: 0 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/game.test.js`
Expected: FAIL — the snake always grows by exactly one on eating; `state.growth` is not updated.

- [ ] **Step 3: Write the implementation** — in `src/core/game.js` add above `tick`:

```js
// Growth Count is tracked in whole tenths so fractional values never drift.
function growthAfterApple(growth, growthSetting) {
  const carry = growth.carry + Math.round(growthSetting * 10);
  const cells = Math.floor(carry / 10);
  return { carry: carry - cells * 10, cells };
}
```
and change `tick`: right after `const eating = …;` replace the `bodyAfterMove` line with

```js
  const settings = state.settings ?? PRESETS.medium;
  let growth = state.growth ?? { carry: 0, pending: 0 };
  if (eating) {
    const gained = growthAfterApple(growth, settings.growth);
    growth = { carry: gained.carry, pending: growth.pending + gained.cells };
  }
  const grows = growth.pending > 0;
  const bodyAfterMove = grows ? state.snake : state.snake.slice(0, -1);
  if (grows) growth = { ...growth, pending: growth.pending - 1 };
```
(keep the existing `size` line from Task 2), include `growth` in both non-game-over returns (`{ ...state, snake, direction, queued, hazards: nextHazards, growth }` and the eating return), and leave the game-over return as is. The existing self-collision logic keeps using `bodyAfterMove`.

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `yarn test`
Expected: PASS (whole suite, including every older eating/tail test).

```bash
git add src/core/game.js tests/game.test.js
git commit -m "feat: grow the snake by a fractional Growth Count so easy and hard games differ in how fast you lengthen"
```

---

### Task 5: Hazards read their rules from the settings

**Files:**
- Modify: `src/core/hazards.js`, `src/core/game.js` (one call), `src/renderer.js`
- Modify: `tests/hazards.test.js`, `tests/game.test.js` (small migrations + new tests)

**Interfaces:**
- Produces: `telegraphFor(apples, base = 24)`; `bombCountFor(apples, settings = PRESETS.medium)`; `fadeOpacity(obj)` (and `wallOpacity` kept as an alias); `spawnForApple(world, hazards, rng, apples, settings = PRESETS.medium)`. New objects carry `fades` and `fadeSteps` (walls and bombs); walls carry `origin: 'first' | 'spawn'`. The single `enemy` stays in this task (it becomes a list in Task 6) but spawns from `enemyTrigger`/`enemySize`. `WALL_CELL_CAP`, `FADE_APPLES`, `MAX_BOMBS` are removed; `FADE_STEPS = 40` stays as the default fade length for objects without `fadeSteps`.
- `tick` passes `state.settings` as the fifth argument of `spawnForApple`.

- [ ] **Step 1: Migrate the existing tests (mechanical)** — in `tests/hazards.test.js`:
  - delete uses of `WALL_CELL_CAP` and `MAX_BOMBS` (remove them from the import and drop the `expect(WALL_CELL_CAP).toBe(80)` / `expect(MAX_BOMBS).toBe(12)` lines; the `bombCountFor` cap test keeps working through its own numbers);
  - in 'stops adding walls at the 80-cell cap', mark the 40 parked walls as spawned: add `origin: 'spawn'` to each wall object (the cap now counts only spawned wall cells);
  - leave every other expectation as it is — the Medium defaults reproduce them.

- [ ] **Step 2: Write the new failing tests** — append to `tests/hazards.test.js` (add `PRESETS` from `../src/core/difficulty.js`, and `fadeOpacity` plus anything missing to the hazards import):

```js
describe('rules from the settings', () => {
  const W = () => ({ snake, direction: 'right', food: { x: 3, y: 3 } });
  const custom = (over) => ({ ...PRESETS.medium, ...over });
  const spawn = (h, rng, apples, s) => spawnForApple(W(), h, rng, apples, s);

  describe('ghost time setting', () => {
    it('halves at apple 61 and again at 121, rounding to a whole step', () => {
      expect(telegraphFor(60, 36)).toBe(36);
      expect(telegraphFor(61, 36)).toBe(18);
      expect(telegraphFor(121, 36)).toBe(9);
      expect(telegraphFor(70, 25)).toBe(13);
      expect(telegraphFor(130, 25)).toBe(6);
      expect(telegraphFor(10, 0)).toBe(0);
      expect(telegraphFor(200, 0)).toBe(0);
      expect(telegraphFor(10)).toBe(24); // default is the medium base
    });
    it('stamps new obstacles with the setting, and a 0 ghost time is solid at once', () => {
      const s = custom({ ghostTime: 0, wallTrigger: 5 });
      const h = spawn(emptyHazards(), seeded(1), 5, s);
      expect(h.walls.length).toBeGreaterThan(0);
      expect(h.walls.every((w) => w.telegraph === 0 && isSolid(w, snake))).toBe(true);
    });
  });

  describe('first walls', () => {
    it('place wallCount walls of wallSize cells exactly when the apple count reaches wallTrigger', () => {
      const s = custom({ wallTrigger: 5, wallCount: 2, wallSize: 4 });
      expect(spawn(emptyHazards(), seeded(1), 4, s).walls).toEqual([]);
      const h = spawn(emptyHazards(), seeded(1), 5, s);
      expect(h.walls).toHaveLength(2);
      expect(h.walls.every((w) => w.cells.length === 4 && w.origin === 'first')).toBe(true);
      expect(spawn(h, seeded(2), 6, s).walls).toEqual(h.walls);
    });
  });

  describe('bombs', () => {
    it.each([
      ['easy', [[31, 0], [32, 1], [35, 1], [36, 2], [52, 6], [100, 6]]],
      ['medium', [[31, 0], [32, 1], [36, 2], [76, 12], [200, 12]]],
      ['hard', [[31, 0], [32, 2], [33, 4], [34, 6], [41, 20], [60, 20]]],
    ])('has the right target on %s', (name, table) => {
      table.forEach(([apples, count]) => expect(bombCountFor(apples, PRESETS[name])).toBe(count));
    });
    it('follows custom trigger, rate, count and max', () => {
      const s = custom({ bombTrigger: 10, bombRate: 3, bombCount: 2, bombMax: 5 });
      expect([9, 10, 12, 13, 16, 19, 40].map((a) => bombCountFor(a, s))).toEqual([0, 2, 2, 4, 5, 5, 5]);
    });
    it('places a whole batch at the trigger', () => {
      const s = custom({ bombTrigger: 10, bombCount: 3, bombRate: 2, bombMax: 9 });
      expect(spawn(emptyHazards(), seeded(3), 10, s).bombs).toHaveLength(3);
    });
  });

  describe('spawning walls', () => {
    const spawnedCells = (h) => h.walls.filter((w) => w.origin === 'spawn').reduce((n, w) => n + w.cells.length, 0);
    it('adds walls only on every rate-th apple from the trigger', () => {
      const s = custom({ wallSpawnTrigger: 10, wallSpawnRate: 3, wallSpawnCount: 1, wallSpawnSize: 2, wallSpawnMax: 250, wallTrigger: 99, bombTrigger: 99, enemyTrigger: 99, movingWallTrigger: 99 });
      let h = emptyHazards();
      const counts = [];
      for (let a = 9; a <= 16; a++) { h = spawn(h, seeded(a), a, s); counts.push(h.walls.length); }
      expect(counts).toEqual([0, 1, 1, 1, 2, 2, 2, 3]); // apples 10, 13 and 16
    });
    it('adds wallSpawnCount walls at a time and stops at the cell max', () => {
      const s = custom({ wallSpawnTrigger: 10, wallSpawnRate: 1, wallSpawnCount: 2, wallSpawnSize: 4, wallSpawnMax: 10, wallTrigger: 99, bombTrigger: 99, enemyTrigger: 99, movingWallTrigger: 99 });
      let h = emptyHazards();
      h = spawn(h, seeded(1), 10, s);
      expect(h.walls).toHaveLength(2); // 8 cells
      h = spawn(h, seeded(2), 11, s);
      expect(h.walls).toHaveLength(2); // another 4 would be 12 > 10
      expect(spawnedCells(h)).toBe(8);
    });
    it('does not count the first walls toward the max', () => {
      const s = custom({ wallTrigger: 5, wallCount: 3, wallSize: 5, wallSpawnTrigger: 6, wallSpawnMax: 10, wallSpawnSize: 5, wallSpawnCount: 1, bombTrigger: 99, enemyTrigger: 99, movingWallTrigger: 99 });
      let h = spawn(emptyHazards(), seeded(1), 5, s);
      expect(h.walls).toHaveLength(3); // 15 first-wall cells
      h = spawn(h, seeded(2), 6, s);
      expect(h.walls).toHaveLength(4); // a spawned 5-cell wall still fits under 10
    });
  });

  describe('moving walls', () => {
    it('re-lays every wall from movingWallTrigger on, and not before', () => {
      const s = custom({ movingWallTrigger: 20, wallSpawnTrigger: 99, bombTrigger: 99, enemyTrigger: 99 });
      const aged = { walls: [{ cells: [{ x: 15, y: 15 }, { x: 16, y: 15 }], age: 40, telegraph: 24, fades: false, origin: 'first' }], bombs: [], enemy: null };
      expect(spawn(aged, seeded(1), 19, s).walls).toEqual(aged.walls);
      const moved = spawn(aged, seeded(1), 20, s).walls;
      expect(moved).toHaveLength(1);
      expect(moved[0].age).toBe(0);
      expect(moved[0].origin).toBe('first');
    });
  });

  describe('invisible hazards', () => {
    const s = custom({ invisibleTrigger: 30, invisibleTiming: 8, movingWallTrigger: 1, bombTrigger: 1, bombMax: 3, wallSpawnTrigger: 99, enemyTrigger: 99, wallTrigger: 1, wallCount: 2 });
    it('makes new walls and bombs fade from the trigger on', () => {
      const before = spawn(emptyHazards(), seeded(1), 29, s);
      expect(before.walls.concat(before.bombs).every((o) => o.fades === false)).toBe(true);
      const after = spawn(emptyHazards(), seeded(1), 30, s);
      const things = after.walls.concat(after.bombs);
      expect(things.length).toBeGreaterThan(0);
      expect(things.every((o) => o.fades === true && o.fadeSteps === 8)).toBe(true);
    });
    it('fades over the configured steps once solid (walls and bombs share the curve)', () => {
      const o = { cells: [{ x: 1, y: 1 }], age: 0, telegraph: 10, fades: true, fadeSteps: 8 };
      expect(fadeOpacity({ ...o, age: 10 })).toBe(1);
      expect(fadeOpacity({ ...o, age: 14 })).toBeCloseTo(0.5);
      expect(fadeOpacity({ ...o, age: 18 })).toBe(0);
      expect(fadeOpacity({ ...o, fades: false, age: 99 })).toBe(1);
      expect(fadeOpacity({ cells: o.cells, age: 64, telegraph: 24, fades: true })).toBe(0); // default 40 steps
    });
  });

  describe('enemies (single, still)', () => {
    it('spawns a ghost of enemySize at enemyTrigger, not before', () => {
      const s = custom({ enemyTrigger: 12, enemySize: 5, wallTrigger: 99, bombTrigger: 99, wallSpawnTrigger: 99, movingWallTrigger: 99 });
      expect(spawn(emptyHazards(), seeded(1), 11, s).enemy).toBeNull();
      const h = spawn(emptyHazards(), seeded(1), 12, s);
      expect(h.enemy.cells).toHaveLength(5);
      expect(h.enemy.status).toBe('ghost');
    });
  });
});
```
Also append to `tests/game.test.js`:
```js
describe('settings reach the spawn rules', () => {
  it('spawns the first walls from the wall trigger of the settings', () => {
    const settings = { ...PRESETS.medium, wallTrigger: 3, wallCount: 2, wallSize: 2 };
    const s = stateWith({
      score: 2, settings,
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }], food: { x: 11, y: 10 }, hazards: emptyHazards(),
    });
    const next = tick(s, () => 0.2);
    expect(next.score).toBe(3);
    expect(next.hazards.walls.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `yarn test`
Expected: FAIL — hazards still use music tiers and the hard-coded numbers; `fadeOpacity` does not exist.

- [ ] **Step 4: Write the implementation** — in `src/core/hazards.js`:

Imports: add `import { PRESETS } from './difficulty.js';` and remove the `musicTier` import and `START_LENGTH`.

Replace the constants/helpers block with (keep `SAFE_DISTANCE`, `LANE_LENGTH`, `PLACEMENT_ATTEMPTS`, `FLASH_PERIOD`, `TELEGRAPH_STEPS = 24`, `FADE_STEPS = 40`, `ENEMY_MOVE_EVERY`):
```js
const MEDIUM = PRESETS.medium;

// Ghost time for an obstacle placed on this apple: the setting, halved after apple 60 and again after 120.
export const telegraphFor = (apples, base = TELEGRAPH_STEPS) =>
  apples > 120 ? Math.round(base / 4) : apples > 60 ? Math.round(base / 2) : base;

// How many bombs there should be after this apple.
export const bombCountFor = (apples, s = MEDIUM) =>
  apples < s.bombTrigger
    ? 0
    : Math.min(s.bombMax, s.bombCount * (1 + Math.floor((apples - s.bombTrigger) / s.bombRate)));

export function fadeOpacity(obj) {
  const ghost = ghostTime(obj);
  if (!obj.fades || obj.age < ghost) return 1;
  return Math.max(0, 1 - (obj.age - ghost) / (obj.fadeSteps ?? FADE_STEPS));
}
export const wallOpacity = fadeOpacity;
```
(delete the old `wallOpacity`, `WALL_CELL_CAP`, `FADE_APPLES`, `MAX_BOMBS`, `FIRST_BOMB_APPLE`, `APPLES_PER_BOMB`, `INITIAL_*`, `PER_APPLE_LENGTH`, `ENEMY_LENGTH`, `wallCellCount`.)

Replace `spawnForApple` with:
```js
const spawnedWallCells = (h) =>
  h.walls.filter((w) => w.origin === 'spawn').reduce((total, w) => total + w.cells.length, 0);

// Hazards after an apple is eaten. `world.food` is the newly placed food; `apples` is the score
// after eating; `s` is the active settings. Existing hazards are not aged here.
export function spawnForApple(world, hazards, rng, apples, s = MEDIUM) {
  const telegraph = telegraphFor(apples, s.ghostTime);
  const fade = { fades: apples >= s.invisibleTrigger, fadeSteps: s.invisibleTiming };
  let h = hazards;
  const at = () => ({ ...world, hazards: h });
  const addWall = (length, origin) => {
    const cells = placeSegment(at(), length, rng);
    if (cells) h = { ...h, walls: [...h.walls, { cells, age: 0, telegraph, origin, ...fade }] };
  };

  if (apples === s.wallTrigger) {
    for (let i = 0; i < s.wallCount; i++) addWall(s.wallSize, 'first');
  }

  const wanted = bombCountFor(apples, s);
  if (wanted > 0) {
    // Every bomb jumps on every apple, one at a time. A bomb that cannot be moved
    // keeps its old cell; a new bomb that cannot be placed is skipped (retried next apple).
    const old = h.bombs;
    const placed = [];
    for (let i = 0; i < wanted; i++) {
      const others = { ...h, bombs: [...placed, ...old.slice(i + 1)] };
      const cells = placeCell({ ...world, hazards: others }, rng);
      if (cells) placed.push({ cells, age: 0, telegraph, ...fade });
      else if (old[i]) placed.push(old[i]);
    }
    h = { ...h, bombs: placed };
  }

  if (apples >= s.wallSpawnTrigger && (apples - s.wallSpawnTrigger) % s.wallSpawnRate === 0) {
    for (let i = 0; i < s.wallSpawnCount; i++) {
      if (spawnedWallCells(h) + s.wallSpawnSize > s.wallSpawnMax) break;
      addWall(s.wallSpawnSize, 'spawn');
    }
  }

  if (apples >= s.movingWallTrigger) {
    // One wall at a time; a wall that cannot be re-laid keeps its old place.
    const old = h.walls;
    const placed = [];
    old.forEach((wall, i) => {
      const others = { ...h, walls: [...placed, ...old.slice(i + 1)] };
      const cells = placeSegment({ ...world, hazards: others }, wall.cells.length, rng);
      placed.push(cells ? { ...wall, cells, age: 0, telegraph, ...fade } : wall);
    });
    h = { ...h, walls: placed };
  }

  if (apples >= s.enemyTrigger && (!h.enemy || h.enemy.status === 'dead')) {
    const without = { ...h, enemy: null };
    const cells = placeSegment({ ...world, hazards: without }, s.enemySize, rng);
    if (cells) h = { ...h, enemy: { cells, age: 0, telegraph, status: 'ghost' } };
  }

  return h;
}
```
In `src/core/game.js` change the call to `spawnForApple({ snake, direction, food, size }, nextHazards, rng, score, state.settings ?? PRESETS.medium)`.
In `src/renderer.js` import `fadeOpacity` (instead of `wallOpacity`), and in `drawBombs` apply it: for a solid bomb compute `const opacity = fadeOpacity(bomb); if (opacity <= 0) return;` and wrap the diamond drawing in `ctx.save(); ctx.globalAlpha = opacity; … ctx.restore();`; walls use `fadeOpacity(wall)`.

- [ ] **Step 5: Run to verify it passes, then commit**

Run: `node --check src/renderer.js && yarn test`
Expected: PASS (whole suite). If a seeded expectation in the new tests fails only because that seed placed an unlucky layout, change the seed; never weaken an assertion.

```bash
git add src tests
git commit -m "feat: drive walls, bombs, spawning walls, moving walls and fading from the difficulty settings"
```

---

### Task 6: Several enemies

**Files:**
- Modify: `src/core/hazards.js`, `src/renderer.js`
- Modify: `tests/hazards.test.js`, `tests/game.test.js`

**Interfaces:**
- Produces: `hazards.enemies: Enemy[]` replaces `hazards.enemy` everywhere (`emptyHazards()` → `{ walls: [], bombs: [], enemies: [] }`); `enemyTargetFor(apples, settings = PRESETS.medium)` = `0` below `enemyTrigger`, else `min(enemyMax, 1 + floor((apples − enemyTrigger) / enemyRate))`; `spawnForApple` replaces each dead enemy with a fresh ghost (keeping the dead one if no spot is found) and tops up to the target; `stepHazards` moves each enemy against walls, bombs and the other enemies' cells; the renderer draws every enemy.

- [ ] **Step 1: Migrate the existing tests (mechanical, goes red until Step 4)** — in `tests/hazards.test.js` and `tests/game.test.js` (find every use with `grep -n "enemy" tests/*.test.js`): `enemy: null` → `enemies: []`; `enemy: { … }` or `enemy` variable → `enemies: [ … ]`; `.enemy.` → `.enemies[0].`; `expect(h.enemy).toBeNull()` → `expect(h.enemies).toEqual([])`; the `emptyHazards()` expectation → `{ walls: [], bombs: [], enemies: [] }`; tests that build `{ walls, bombs, enemy }` for `stepHazards` or `spawnForApple` use `enemies: [enemy]`. Assertions about behavior stay identical.

- [ ] **Step 2: Write the new failing tests** — append to `tests/hazards.test.js` (add `enemyTargetFor` to the imports):

```js
describe('several enemies', () => {
  const W = () => ({ snake, direction: 'right', food: { x: 3, y: 3 } });
  const only = (over) => ({ ...PRESETS.medium, wallTrigger: 99, bombTrigger: 99, wallSpawnTrigger: 99, movingWallTrigger: 99, ...over });
  const live = (cells, status = 'alive') => ({ cells, age: 9, telegraph: 24, status });

  it.each([
    ['medium', [[63, 0], [64, 1], [70, 1], [200, 1]]],
    ['hard', [[63, 0], [64, 1], [68, 1], [69, 2], [74, 3], [79, 4], [200, 4]]],
  ])('has the right target on %s', (name, table) => {
    table.forEach(([apples, n]) => expect(enemyTargetFor(apples, PRESETS[name])).toBe(n));
  });

  it('spawns the first enemy at the trigger and adds one every rate apples', () => {
    const s = only({ enemyTrigger: 10, enemyRate: 3, enemyMax: 3, enemySize: 2 });
    let h = emptyHazards();
    const counts = [];
    for (let a = 9; a <= 16; a++) {
      h = spawnForApple(W(), h, seeded(a), a, s);
      h = { ...h, enemies: h.enemies.map((e) => ({ ...e, status: 'alive', age: 9 })) };
      counts.push(h.enemies.length);
    }
    expect(counts).toEqual([0, 1, 1, 1, 2, 2, 2, 3]); // apples 10, 13, 16
    expect(h.enemies.every((e) => e.cells.length === 2)).toBe(true);
  });

  it('never stops at the max', () => {
    const s = only({ enemyTrigger: 1, enemyRate: 1, enemyMax: 2 });
    let h = emptyHazards();
    for (let a = 1; a <= 10; a++) h = spawnForApple(W(), h, seeded(a), a, s);
    expect(h.enemies).toHaveLength(2);
  });

  it('leaves live enemies alone and replaces each dead one with a fresh ghost', () => {
    const s = only({ enemyTrigger: 10, enemyRate: 100, enemyMax: 2, enemySize: 3 });
    const aliveOne = live([{ x: 17, y: 3 }, { x: 17, y: 2 }, { x: 17, y: 1 }]);
    const deadOne = live([{ x: 17, y: 12 }, { x: 17, y: 11 }, { x: 17, y: 10 }], 'dead');
    const h = spawnForApple(W(), { walls: [], bombs: [], enemies: [aliveOne, deadOne] }, seeded(4), 20, s);
    expect(h.enemies).toHaveLength(2);
    expect(h.enemies[0]).toEqual(aliveOne);
    expect(h.enemies[1].status).toBe('ghost');
    expect(h.enemies[1].age).toBe(0);
  });

  it('keeps a dead enemy as an obstacle when no replacement spot is found', () => {
    const s = only({ enemyTrigger: 10, enemyMax: 1 });
    const deadOne = live([{ x: 17, y: 12 }, { x: 17, y: 11 }, { x: 17, y: 10 }], 'dead');
    let i = 0;
    const alwaysFails = () => [0.5, 0.5][i++ % 2];
    const h = spawnForApple(W(), { walls: [], bombs: [], enemies: [deadOne] }, alwaysFails, 20, s);
    expect(h.enemies).toEqual([deadOne]);
  });

  it('kills the snake on any live or dead enemy and ignores ghost enemies', () => {
    const h = {
      walls: [], bombs: [],
      enemies: [
        live([{ x: 12, y: 10 }, { x: 13, y: 10 }]),
        live([{ x: 14, y: 12 }, { x: 15, y: 12 }], 'dead'),
        { ...live([{ x: 16, y: 14 }, { x: 17, y: 14 }], 'ghost'), age: 3 },
      ],
    };
    expect(hitsHazard(h, { x: 13, y: 10 }, snake)).toBe(true);
    expect(hitsHazard(h, { x: 15, y: 12 }, snake)).toBe(true);
    expect(hitsHazard(h, { x: 17, y: 14 }, snake)).toBe(false);
  });

  it('ages every enemy and never lets two enemies share a cell while they wander', () => {
    let moved = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const rng = seeded(seed);
      let h = {
        walls: [], bombs: [],
        enemies: [
          { cells: [{ x: 16, y: 12 }, { x: 16, y: 11 }, { x: 16, y: 10 }], age: 0, telegraph: 24, status: 'alive' },
          { cells: [{ x: 17, y: 12 }, { x: 17, y: 11 }, { x: 17, y: 10 }], age: 0, telegraph: 24, status: 'alive' },
        ],
      };
      for (let i = 0; i < 60; i++) {
        const before = h.enemies.map((e) => cellKey(e.cells[0]));
        h = stepHazards(h, { snake, food: { x: 18, y: 5 }, size: 20 }, rng);
        h.enemies.forEach((e) => expect(e.age).toBe(i + 1));
        const all = h.enemies.flatMap((e) => e.cells.map(cellKey));
        expect(new Set(all).size).toBe(all.length);
        if (h.enemies.some((e, j) => cellKey(e.cells[0]) !== before[j])) moved++;
      }
    }
    expect(moved).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `yarn test`
Expected: FAIL — the code still uses `hazards.enemy` (the migrated tests and the new tests are red).

- [ ] **Step 4: Write the implementation** — in `src/core/hazards.js`:

```js
export const emptyHazards = () => ({ walls: [], bombs: [], enemies: [] });
```
`hazardCells`: replace the enemy line with `...h.enemies.flatMap((e) => e.cells),`.
`hitsHazard`: replace the enemy line with
```js
  if (h.enemies.some((e) => e.status !== 'ghost' && at(e.cells))) return true;
```
Add:
```js
// How many enemies there should be after this apple.
export const enemyTargetFor = (apples, s = MEDIUM) =>
  apples < s.enemyTrigger ? 0 : Math.min(s.enemyMax, 1 + Math.floor((apples - s.enemyTrigger) / s.enemyRate));
```
In `spawnForApple` replace the whole enemy block with:
```js
  const enemyTarget = enemyTargetFor(apples, s);
  if (enemyTarget > 0) {
    const fresh = (cells) => ({ cells, age: 0, telegraph, status: 'ghost' });
    const old = h.enemies;
    const placed = [];
    old.forEach((enemy, i) => {
      if (enemy.status !== 'dead') {
        placed.push(enemy);
        return;
      }
      // replace a dead enemy with a fresh ghost; keep it as an obstacle if no spot is found
      const others = { ...h, enemies: [...placed, ...old.slice(i + 1)] };
      const cells = placeSegment({ ...world, hazards: others }, s.enemySize, rng);
      placed.push(cells ? fresh(cells) : enemy);
    });
    while (placed.length < enemyTarget) {
      const cells = placeSegment({ ...world, hazards: { ...h, enemies: placed } }, s.enemySize, rng);
      if (!cells) break;
      placed.push(fresh(cells));
    }
    h = { ...h, enemies: placed };
  }
```
Change `stepEnemy` to take the blocked keys of everything else: signature `stepEnemy(enemy, { snake, food, others, size }, rng)` where `others` is a `Set` of keys (walls, bombs and the other enemies); delete its own `blockedKeys({ walls, bombs, enemy: null })` line and use the passed `others`. Replace `stepHazards` with:
```js
export function stepHazards(hazards, { snake, food, size }, rng) {
  const walls = hazards.walls.map((w) => ({ ...w, age: w.age + 1 }));
  const bombs = hazards.bombs.map((b) => ({ ...b, age: b.age + 1 }));
  const enemies = hazards.enemies.map((e) => ({ ...e, age: e.age + 1 }));
  for (let i = 0; i < enemies.length; i++) {
    const rest = enemies.filter((_, j) => j !== i);
    const others = blockedKeys({ walls, bombs, enemies: rest });
    enemies[i] = stepEnemy(enemies[i], { snake, food, others, size }, rng);
  }
  return { walls, bombs, enemies };
}
```
In `src/renderer.js` replace `drawEnemy` with `drawEnemies` that loops `state.hazards.enemies` (same drawing code per enemy) and call it instead of `drawEnemy`.

- [ ] **Step 5: Run to verify it passes, then commit**

Run: `node --check src/renderer.js && yarn test && grep -rn "\.enemy\b\|enemy:" src tests`
Expected: PASS; the grep prints nothing relevant (variable names like `const enemy` for one item are fine).

```bash
git add src tests
git commit -m "feat: allow several enemy snakes that spawn on a schedule and respawn when they die"
```

---

### Task 7: Per-difficulty storage

**Files:**
- Modify: `src/storage.js` (full replacement)
- Modify: `tests/storage.test.js` (full replacement)

**Interfaces:**
- Consumes: `isDifficulty`, `DEFAULT_DIFFICULTY`, `PRESETS`, `sanitize` from `core/difficulty.js`.
- Produces: `SCORED = ['easy','medium','hard']`; `loadBest(difficulty, storage?)` / `saveBest(difficulty, score, storage?)` (keys `snake.highScore.<difficulty>`; **custom is neither read nor written**; Medium falls back to the legacy `snake.highScore` once); `loadDifficulty(storage?)` / `saveDifficulty(difficulty, storage?)` (key `snake.difficulty`); `loadCustom(storage?)` / `saveCustom(custom, storage?)` (key `snake.custom`, JSON validated field by field). Every function resolves `storage ?? globalThis.localStorage` **inside** its `try` and logs once via `console.error` on failure.

- [ ] **Step 1: Write the failing tests** — replace `tests/storage.test.js` with:

```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  loadBest, saveBest, loadDifficulty, saveDifficulty, loadCustom, saveCustom, SCORED,
} from '../src/storage.js';
import { PRESETS } from '../src/core/difficulty.js';

const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
};
const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('best scores', () => {
  it('keeps a separate best for each preset difficulty', () => {
    const s = fakeStorage();
    saveBest('easy', 7, s);
    saveBest('medium', 12, s);
    saveBest('hard', 3, s);
    expect(s.data).toMatchObject({ 'snake.highScore.easy': '7', 'snake.highScore.medium': '12', 'snake.highScore.hard': '3' });
    expect(SCORED.map((d) => loadBest(d, s))).toEqual([7, 12, 3]);
  });
  it('returns 0 when nothing is stored', () => {
    expect(loadBest('easy', fakeStorage())).toBe(0);
  });
  it('never reads or writes a custom score', () => {
    const s = fakeStorage({ 'snake.highScore.custom': '99' });
    expect(loadBest('custom', s)).toBe(0);
    saveBest('custom', 50, s);
    expect(Object.keys(s.data)).toEqual(['snake.highScore.custom']);
    expect(s.data['snake.highScore.custom']).toBe('99'); // untouched
  });
  it('ignores unknown difficulties', () => {
    const s = fakeStorage();
    saveBest('nightmare', 5, s);
    expect(s.data).toEqual({});
    expect(loadBest('nightmare', s)).toBe(0);
  });
  it('uses the old single saved score as medium once', () => {
    expect(loadBest('medium', fakeStorage({ 'snake.highScore': '21' }))).toBe(21);
    expect(loadBest('easy', fakeStorage({ 'snake.highScore': '21' }))).toBe(0);
    expect(loadBest('medium', fakeStorage({ 'snake.highScore': '21', 'snake.highScore.medium': '4' }))).toBe(4);
  });
  it.each(['abc', '-5', 'NaN', '1e999', '1.5', ''])('rejects tampered value %j', (bad) => {
    expect(loadBest('hard', fakeStorage({ 'snake.highScore.hard': bad }))).toBe(0);
  });
  it('survives storage that throws, and storage that is missing', () => {
    const spy = quiet();
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };
    expect(loadBest('easy', broken)).toBe(0);
    expect(() => saveBest('easy', 3, broken)).not.toThrow();
    expect(spy).toHaveBeenCalled();
    vi.stubGlobal('localStorage', undefined);
    expect(loadBest('easy')).toBe(0);
    expect(() => saveBest('easy', 1)).not.toThrow();
  });
  it('survives a localStorage getter that throws', () => {
    const spy = quiet();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    try {
      expect(loadBest('easy')).toBe(0);
      expect(() => saveBest('easy', 1)).not.toThrow();
      expect(spy).toHaveBeenCalled();
    } finally { delete globalThis.localStorage; }
  });
});

describe('chosen difficulty', () => {
  it('round-trips a valid difficulty', () => {
    const s = fakeStorage();
    saveDifficulty('hard', s);
    expect(loadDifficulty(s)).toBe('hard');
    saveDifficulty('custom', s);
    expect(loadDifficulty(s)).toBe('custom');
  });
  it('defaults to medium for missing or invalid values', () => {
    expect(loadDifficulty(fakeStorage())).toBe('medium');
    expect(loadDifficulty(fakeStorage({ 'snake.difficulty': 'nightmare' }))).toBe('medium');
  });
  it('does not save an invalid difficulty', () => {
    const s = fakeStorage();
    saveDifficulty('nightmare', s);
    expect(s.data).toEqual({});
  });
});

describe('custom settings', () => {
  it('round-trips and validates every field', () => {
    const s = fakeStorage();
    saveCustom({ ...PRESETS.medium, gridSize: 33, speed: 1.7 }, s);
    const loaded = loadCustom(s);
    expect(loaded.gridSize).toBe(33);
    expect(loaded.speed).toBe(1.7);
    expect(loaded.growth).toBe(PRESETS.medium.growth);
  });
  it('replaces bad fields with medium defaults and ignores junk', () => {
    const bad = fakeStorage({ 'snake.custom': JSON.stringify({ gridSize: 9999, speed: 'x', growth: 2 }) });
    const loaded = loadCustom(bad);
    expect(loaded.gridSize).toBe(50);
    expect(loaded.speed).toBe(1);
    expect(loaded.growth).toBe(2);
    expect(loadCustom(fakeStorage({ 'snake.custom': 'not json' }))).toEqual(PRESETS.medium);
    expect(loadCustom(fakeStorage({ 'snake.custom': '[1,2]' }))).toEqual(PRESETS.medium);
    expect(loadCustom(fakeStorage())).toEqual(PRESETS.medium);
  });
  it('survives broken storage', () => {
    const spy = quiet();
    const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    expect(loadCustom(broken)).toEqual(PRESETS.medium);
    expect(() => saveCustom(PRESETS.medium, broken)).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/storage.test.js`
Expected: FAIL — the new exports do not exist.

- [ ] **Step 3: Write the implementation** — replace `src/storage.js` with:

```js
import { DEFAULT_DIFFICULTY, PRESETS, isDifficulty, sanitize } from './core/difficulty.js';

export const SCORED = ['easy', 'medium', 'hard'];
const BEST_PREFIX = 'snake.highScore.';
const LEGACY_BEST = 'snake.highScore';
const DIFFICULTY_KEY = 'snake.difficulty';
const CUSTOM_KEY = 'snake.custom';

// Resolve storage inside the try: reading localStorage itself can throw when it is blocked.
function guarded(action, fallback, message) {
  try {
    return action();
  } catch (err) {
    console.error(message, err);
    return fallback;
  }
}

const store = (storage) => storage ?? globalThis.localStorage;

const parseScore = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

// Custom has no best score: it is never read and never written.
export function loadBest(difficulty, storage) {
  if (!SCORED.includes(difficulty)) return 0;
  return guarded(() => {
    const s = store(storage);
    const own = parseScore(s?.getItem(BEST_PREFIX + difficulty));
    if (own !== null) return own;
    if (difficulty === 'medium') return parseScore(s?.getItem(LEGACY_BEST)) ?? 0;
    return 0;
  }, 0, 'Could not read best score');
}

export function saveBest(difficulty, score, storage) {
  if (!SCORED.includes(difficulty)) return;
  guarded(() => store(storage)?.setItem(BEST_PREFIX + difficulty, String(score)), undefined, 'Could not save best score');
}

export function loadDifficulty(storage) {
  return guarded(() => {
    const value = store(storage)?.getItem(DIFFICULTY_KEY);
    return isDifficulty(value) ? value : DEFAULT_DIFFICULTY;
  }, DEFAULT_DIFFICULTY, 'Could not read difficulty');
}

export function saveDifficulty(difficulty, storage) {
  if (!isDifficulty(difficulty)) return;
  guarded(() => store(storage)?.setItem(DIFFICULTY_KEY, difficulty), undefined, 'Could not save difficulty');
}

export function loadCustom(storage) {
  return guarded(() => {
    const raw = store(storage)?.getItem(CUSTOM_KEY);
    if (!raw) return { ...PRESETS.medium };
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ...PRESETS.medium };
    }
    return sanitize(parsed);
  }, { ...PRESETS.medium }, 'Could not read custom settings');
}

export function saveCustom(custom, storage) {
  guarded(() => store(storage)?.setItem(CUSTOM_KEY, JSON.stringify(sanitize(custom))), undefined, 'Could not save custom settings');
}
```
Note: `main.js` still imports the old `loadHighScore`/`saveHighScore`; update it in Task 8 (until then `node --check` passes but the page would break — this task changes tests and storage only, and Task 8 follows immediately).

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `yarn test`
Expected: PASS (whole suite).

```bash
git add src/storage.js tests/storage.test.js
git commit -m "feat: store a best score per difficulty, the chosen difficulty and the custom settings, with none for custom"
```

---

### Task 8: The difficulty menu and wiring

**Files:**
- Create: `src/menu.js`
- Modify: `index.html`, `style.css`, `src/main.js`
- Modify: `tests/page.test.js` (append)

**Interfaces:**
- Consumes: `FIELDS`, `PRESETS`, `settingsFor`, `applyEdit`, `describeRange`, `DIFFICULTIES` (difficulty.js); `loadBest`, `saveBest`, `loadDifficulty`, `saveDifficulty`, `loadCustom`, `saveCustom` (storage.js).
- Produces: `createMenu({ dialog, select, fieldsEl, noteEl, openBtn, applyBtn, cancelBtn, getCurrent, canOpen, onApply })` and `difficultyLabel(d)`. `main.js` owns `difficulty`, `custom`, `settings`, `best`; `applyDifficulty(nextDifficulty, nextCustom)` saves them, resets the run and redraws at the new grid size. Rendering/behaviour of the dialog is verified manually in the browser; the pure parts are covered by Task 1's tests.

- [ ] **Step 1: Write the failing page tests** — append to `tests/page.test.js` (it already reads `index.html` into `html`, `buttons` and has `readFileSync`):

```js
describe('difficulty menu markup', () => {
  it('has an open button, a dialog, a selector with the four difficulties, and Apply and Cancel', () => {
    expect(html).toContain('id="difficulty-open"');
    expect(html).toContain('<dialog id="difficulty-dialog"');
    for (const d of ['easy', 'medium', 'hard', 'custom']) {
      expect(html).toMatch(new RegExp(`<option value="${d}"`));
    }
    expect(html).toContain('id="difficulty-fields"');
    expect(html).toContain('id="difficulty-apply"');
    expect(html).toContain('id="difficulty-cancel"');
    expect(html).toContain('id="best-wrap"');
  });
  it('keeps every button an accessible type=button (the dialog buttons too)', () => {
    const all = [...html.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
    expect(all.length).toBeGreaterThanOrEqual(10);
    all.forEach((b) => { expect(b).toContain('type="button"'); expect(b).toContain('aria-label='); });
  });
  it('builds the fields with DOM APIs, not innerHTML', () => {
    const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
    expect(menu).not.toMatch(/innerHTML|insertAdjacentHTML|eval\(/);
    expect(menu).toContain('createElement');
  });
  it('does not let the game keys fire while the dialog is open', () => {
    const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    expect(main).toContain("dialog[open]");
  });
  it('styles locked fields and lets the dialog scroll inside itself', () => {
    const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    expect(css).toMatch(/dialog[^{]*\{[^}]*overflow/);
    expect(css).toMatch(/\.locked|\[readonly\]/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/page.test.js`
Expected: FAIL — no dialog markup, no `src/menu.js`.

- [ ] **Step 3: Write the implementation**

`index.html` — replace the `<header>` with:
```html
    <header>
      <span>Score: <strong id="score">0</strong></span>
      <span id="best-wrap">Best: <strong id="best">0</strong></span>
      <button id="difficulty-open" type="button" aria-label="Choose difficulty">Difficulty: Medium</button>
      <button id="mute" type="button" data-action="mute" aria-pressed="false" aria-label="Mute (M)">Mute (M)</button>
    </header>
```
and add, just before `<script …>`:
```html
    <dialog id="difficulty-dialog" aria-labelledby="difficulty-title">
      <h2 id="difficulty-title">Difficulty</h2>
      <label class="picker">Difficulty
        <select id="difficulty-select" aria-label="Difficulty">
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      <p id="difficulty-note"></p>
      <div id="difficulty-fields"></div>
      <div class="dialog-actions">
        <button id="difficulty-apply" type="button" aria-label="Apply difficulty and start a new game">Apply &amp; restart</button>
        <button id="difficulty-cancel" type="button" aria-label="Close without changing">Cancel</button>
      </div>
    </dialog>
```

`src/menu.js`:
```js
import { DIFFICULTIES, FIELDS, PRESETS, settingsFor, applyEdit, describeRange } from './core/difficulty.js';

const LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', custom: 'Custom' };
export const difficultyLabel = (difficulty) => LABELS[difficulty] ?? LABELS.medium;

// Builds the dialog's fields with DOM APIs (never innerHTML) and wires its buttons.
export function createMenu({ dialog, select, fieldsEl, noteEl, openBtn, applyBtn, cancelBtn, getCurrent, canOpen, onApply }) {
  let draftDifficulty = 'medium';
  let draftCustom = { ...PRESETS.medium };
  const inputs = new Map();

  let group = null;
  let groupEl = null;
  FIELDS.forEach((field) => {
    if (field.group !== group) {
      group = field.group;
      groupEl = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = group;
      groupEl.append(legend);
      fieldsEl.append(groupEl);
    }
    const label = document.createElement('label');
    label.className = 'field';
    const name = document.createElement('span');
    name.textContent = `${field.label} (${describeRange(field)})`;
    const input = document.createElement('input');
    input.type = 'number';
    input.id = `field-${field.key}`;
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
    input.addEventListener('change', () => {
      draftCustom = applyEdit(draftCustom, field, input.value);
      input.value = String(draftCustom[field.key]);
    });
    label.append(name, input);
    groupEl.append(label);
    inputs.set(field.key, input);
  });

  function refresh() {
    const values = settingsFor(draftDifficulty, draftCustom);
    const locked = draftDifficulty !== 'custom';
    FIELDS.forEach((field) => {
      const input = inputs.get(field.key);
      input.value = String(values[field.key]);
      input.readOnly = locked;
      input.setAttribute('aria-readonly', String(locked));
      input.classList.toggle('locked', locked);
    });
    noteEl.textContent = locked
      ? 'These values are locked. Choose Custom to edit them.'
      : 'Edit any value. It is adjusted to the nearest allowed value.';
  }

  select.addEventListener('change', () => {
    draftDifficulty = DIFFICULTIES.includes(select.value) ? select.value : 'medium';
    refresh();
  });
  openBtn.addEventListener('click', () => {
    if (!canOpen()) return;
    const current = getCurrent();
    draftDifficulty = current.difficulty;
    draftCustom = { ...current.custom };
    select.value = draftDifficulty;
    refresh();
    dialog.showModal();
  });
  applyBtn.addEventListener('click', () => {
    onApply(draftDifficulty, draftCustom);
    dialog.close();
  });
  cancelBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => openBtn.focus());
}
```

`src/main.js` — changes:
1. Imports: replace the storage import with `import { loadBest, saveBest, loadDifficulty, saveDifficulty, loadCustom, saveCustom } from './storage.js';` and add `import { settingsFor } from './core/difficulty.js'; import { createMenu, difficultyLabel } from './menu.js';`.
2. Replace `let best = loadHighScore(); let state = createState(Math.random);` with
```js
let difficulty = loadDifficulty();
let custom = loadCustom();
let settings = settingsFor(difficulty, custom);
let best = loadBest(difficulty);
let state = createState(Math.random, settings);
```
3. Add element lookups near the others: `const bestWrap = document.getElementById('best-wrap');` and `const difficultyBtn = document.getElementById('difficulty-open');` (the dialog parts are looked up inline in the `createMenu` call below).
4. `updateHud()` additionally: `bestWrap.hidden = difficulty === 'custom';` `difficultyBtn.textContent = \`Difficulty: ${difficultyLabel(difficulty)}\`;` `difficultyBtn.disabled = runInProgress();` where `const runInProgress = () => started && state.status !== 'gameOver';`.
5. `advance()`: replace the best-score block with
```js
  if (difficulty !== 'custom' && state.score > best) {
    best = state.score;
    saveBest(difficulty, best);
  }
```
6. `restart()` uses `createState(Math.random, settings)`.
7. Add and wire the menu:
```js
function applyDifficulty(nextDifficulty, nextCustom) {
  stopBeat();
  difficulty = nextDifficulty;
  custom = nextCustom;
  settings = settingsFor(difficulty, custom);
  saveDifficulty(difficulty);
  saveCustom(custom);
  best = loadBest(difficulty);
  state = createState(Math.random, settings);
  started = false;
  draw();
}

createMenu({
  dialog: document.getElementById('difficulty-dialog'),
  select: document.getElementById('difficulty-select'),
  fieldsEl: document.getElementById('difficulty-fields'),
  noteEl: document.getElementById('difficulty-note'),
  openBtn: difficultyBtn,
  applyBtn: document.getElementById('difficulty-apply'),
  cancelBtn: document.getElementById('difficulty-cancel'),
  getCurrent: () => ({ difficulty, custom }),
  canOpen: () => !runInProgress(),
  onApply: applyDifficulty,
});
```
8. In the `keydown` handler, ignore the game keys while the dialog is open (first line after the `typeof event.key` guard): `if (event.target.closest?.('dialog[open]') || document.querySelector('dialog[open]')) return;`.

`style.css` — append:
```css
header { flex-wrap: wrap; row-gap: 0.25rem; }
#difficulty-open { min-height: 48px; }
#difficulty-open:disabled { opacity: 0.5; cursor: not-allowed; }
#best-wrap[hidden] { display: none; }

dialog { width: min(100vw - 1rem, 480px); max-height: 90dvh; overflow: auto; border: 1px solid #9aa5b1;
         border-radius: 12px; padding: 1rem; text-align: left; color: var(--ink); background: #fff; }
dialog::backdrop { background: rgb(0 0 0 / 40%); }
dialog h2 { margin: 0 0 0.5rem; }
.picker { display: grid; gap: 0.25rem; font-weight: 600; }
.picker select { min-height: 48px; font: inherit; }
#difficulty-fields fieldset { margin: 0.75rem 0 0; border: 1px solid #d5dce3; border-radius: 8px; padding: 0.5rem; }
#difficulty-fields legend { font-weight: 600; padding: 0 0.25rem; }
.field { display: grid; gap: 0.15rem; margin: 0.4rem 0; font-size: 0.9rem; }
.field input { min-height: 44px; font: inherit; padding: 0 0.5rem; }
.field input.locked, .field input[readonly] { background: #eef1f4; color: #52606d; }
.dialog-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; position: sticky; bottom: 0; background: #fff; padding-top: 0.5rem; }
.dialog-actions button { min-height: 48px; }
```
The header grows, so re-check the layout in Task 9 and adjust the `336px` canvas constant if the page scrolls at 320×568.

- [ ] **Step 4: Run to verify it passes**

Run: `node --check src/main.js && node --check src/menu.js && yarn test`
Expected: PASS (whole suite).

- [ ] **Step 5: Commit**

```bash
git add index.html style.css src/main.js src/menu.js tests/page.test.js
git commit -m "feat: add a difficulty menu that applies presets or custom values and keeps a best score per difficulty"
```

---

### Task 9: Verify, then squash

**Files:** none (verification, then history). Performed by the controller.

- [ ] **Step 1: Re-run the headless simulation for every preset.** Update the bot harness for the new shapes (`createState(rng, settings)`, `h.enemies`, settings-driven thresholds) and run ~100 seeded games per preset (Easy, Medium, Hard) plus a few extreme Custom settings (10×10, 50×50, speed 2, growth 4 and 0.1, ghost time 0 and 40). Required: zero violations of — no hazard before its trigger; bombs ≤ `bombMax` and ≤ target; spawned wall cells ≤ `wallSpawnMax`; enemies ≤ `enemyMax`; food never on a hazard; new ghosts never within 5 cells of the head; hazards never wall the food off from the head; snake length follows the growth rule (score × growth, floored in tenths, plus pending); all cells inside the board.
- [ ] **Step 2: Browser — the menu.** Open the dialog: the four choices; presets show locked values matching the table; Custom is editable and corrects out-of-range/off-step input (type 999 into Grid Size → 50; abc → previous value); Apply starts a fresh run at the new grid size (draw 10, 16, 20, 40, 50 boards); the Difficulty button is disabled during a run and enabled after game over; the "Best" display is hidden for Custom and each preset keeps its own best across reloads; the old single saved score appears as Medium's best; the chosen difficulty and Custom values survive a reload; keyboard keys do not move the snake while the dialog is open.
- [ ] **Step 3: Browser — layout.** At 375×667, 360×640 and 320×568: no page scroll, every control ≥ 48 px, the dialog scrolls inside itself with Apply/Cancel visible. If the taller header makes the page scroll, adjust the canvas `336px` constant (comment it) and re-measure.
- [ ] **Step 4: Performance on a 50×50 Custom board** with bombs/walls/enemies at their maxima: measure the time of a few `tick` calls in the page (target well under one step; report the numbers).
- [ ] **Step 5: Squash into one commit**

```bash
BASE=$(git merge-base feature/difficulty feature/bomb-swarm)
git reset --soft "$BASE"
git commit -m "feat: add a difficulty menu with Easy, Medium, Hard and Custom

Twenty-three settings now drive the grid size, game speed, growth, ghost time
and every hazard rule. Presets are locked and Custom is editable within each
field's range. Easy, Medium and Hard keep their own best score; Custom shows
and saves none. Tempo, music tier and hazard triggers count apples eaten, so
growth can differ from one cell per apple."
```
Expected: one new commit on top of `60c9f94`; `git status` clean. Do not push; ask the user how to land it.

---

## Self-Review

**Spec coverage (difficulty.md):** the 23 fields, ranges, steps and the three presets → Task 1 (table test); grid size 10–50 and centred start → Task 2; speed modifier after the BPM cap → Task 3; Growth Count carry/pending → Task 4; ghost time halving with rounding and 0 → Task 5; Wall Trigger/Size/Count, Bomb Trigger/Rate/Count/Max, Wall Spawn Trigger/Size/Rate/Count/Max (cells, spawned only), Moving Wall Trigger, Invisible Trigger/Timing for walls and bombs, enemies never fade → Task 5; Enemy Trigger/Size/Rate/Max with dead-enemy replacement → Task 6; per-difficulty best, no Custom score, legacy migration, remembered difficulty and Custom values, validated storage → Task 7; menu (dialog, locked presets, Custom clamping, disabled during a run, fresh run on apply, hidden Best for Custom) → Task 8 and verification in Task 9; apples-not-length → Tasks 3–5; Medium keeps today's game apart from the three stated differences → Task 5 migrations; 320 px layout and 50×50 performance → Task 9.

**Placeholder scan:** none; every code step has code. Task 2 lists exact edits for each file; Task 8 gives the full `menu.js` and the exact `main.js` changes.

**Type consistency:** settings keys are used identically everywhere (`gridSize`, `speed`, `growth`, `ghostTime`, `wallTrigger`, `wallSize`, `wallCount`, `bombTrigger`/`bombRate`/`bombCount`/`bombMax`, `wallSpawn*`, `enemy*`, `movingWallTrigger`, `invisibleTrigger`/`invisibleTiming`); `spawnForApple(world, hazards, rng, apples, settings)` with `world = { snake, direction, food, size }`; `stepHazards(hazards, { snake, food, size }, rng)`; hazards are `{ walls, bombs, enemies }` after Task 6; walls carry `origin`, `fades`, `fadeSteps`; `createState(rng, settings)` returns `settings` and `growth`; `bpm(apples, speed)` and `musicTier(apples)` take apples.
