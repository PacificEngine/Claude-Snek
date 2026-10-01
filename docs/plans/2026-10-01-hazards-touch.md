# Hazards and Touch Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tier-gated hazards (walls, bomb, enemy snake, per-apple walls, re-laid and fading walls) that are always telegraphed and never block the route to the food, plus on-screen touch buttons.

**Architecture:** Pure core modules do the work: `grid.js` (cell helpers), `pathing.js` (time-aware reachability), `hazards.js` (data, placement, per-apple rules, per-step ageing and enemy movement, collisions, visuals math). `game.js` calls them from `tick`. The renderer draws hazards from the same state. Touch buttons and the keyboard feed one `dispatch(action)` in `main.js`.

**Tech Stack:** Vanilla JavaScript (ES modules, no build step), HTML Canvas, Web Audio, Vitest (dev-only, via yarn).

**Specs:** `docs/specs/snake-game/hazards.md` (feature) and `docs/specs/snake-game/snake-game.md` (touch controls).

## Global Constraints

- Vanilla JavaScript with ES modules, no build step, zero runtime dependencies; use `yarn` only (never npm, pnpm or bun).
- Hazards are pure core logic: no DOM or audio access; all randomness injected (`rng`); `state.hazards` may be absent (treated as empty) so older tests stay valid.
- Apples eaten = snake length − 3. Tier = `musicTier(length)` = min(10, floor(apples ÷ 8)). A feature starts on the apple that reaches its tier.
- Tier 2 (16 apples): 4 wall segments of 3 cells. Tier 4 (32): one bomb that relocates on every apple. Tier 6 (48): one new 2-cell wall per apple, total wall cells ≤ 80. Tier 8 (64): a 3-cell enemy snake. Tier 10 (80): all walls re-laid on every apple. From 100 apples: re-laid walls fade (opacity 1 → 0 over 40 steps after turning solid) and stay solid.
- Telegraph: every new/moved obstacle is a ghost (harmless) for 24 steps; a ghost stays a ghost while any snake cell overlaps it. Ghosts flash (visible 4 steps, hidden 4 steps); steady under `prefers-reduced-motion`.
- Safe placement: ≥ 5 cells (Manhattan) from the head and not in the 10 cells straight ahead; not on the snake, food or other hazards; up to 50 attempts then skip.
- A route from the head to the food always exists after any placement; time-aware: snake body cell `i` (head = 0) is vacated after `length − i` steps. Food is placed first, on a reachable free cell; then hazards.
- Enemy: moves every 2nd step (after it turns live), uniformly random among safe moves (in bounds, no walls/bomb, no snake, no own body, route to food preserved); no safe move → dies, stays solid until the next apple, then respawns as a ghost.
- Collisions: head into a solid wall, solid bomb, live or dead enemy ends the game; ghosts are harmless.
- Touch: D-pad (up/down/left/right), Pause, Restart plus Mute, always visible; each runs the same action as its key; ≥ 48 px targets; `pointerdown` (plus keyboard-generated `click`); first tap counts as the first interaction for audio.
- No `innerHTML` or `eval`; CSP unchanged (no inline scripts or styles).
- Work on branch `feature/hazards-touch`; commit after each red-green cycle; commit messages explain why; no Claude signature; squash into one commit before finishing.

---

### Task 1: Grid helpers (extract, then reuse)

**Files:**
- Create: `src/core/grid.js`
- Test: `tests/grid.test.js`
- Modify: `src/core/game.js` (reuse the helpers; behavior unchanged)

**Interfaces:**
- Produces (from `grid.js`): `VECTORS`, `OPPOSITE`, `cellKey(cell): string` (`"x,y"`), `sameCell(a, b)`, `inBounds(cell)`, `manhattan(a, b)`, `neighbors(cell): Cell[]` (in-bounds orthogonal neighbours, order: up, down, left, right), `allCells(): Cell[]` (row-major: y outer, x inner).

- [ ] **Step 1: Write the failing tests** (`tests/grid.test.js`)

```js
import { describe, it, expect } from 'vitest';
import { cellKey, sameCell, inBounds, manhattan, neighbors, allCells } from '../src/core/grid.js';

describe('grid helpers', () => {
  it('keys a cell as "x,y"', () => {
    expect(cellKey({ x: 3, y: 4 })).toBe('3,4');
  });
  it('compares cells by value', () => {
    expect(sameCell({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(sameCell({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
  });
  it('knows the 20x20 bounds', () => {
    expect(inBounds({ x: 0, y: 0 })).toBe(true);
    expect(inBounds({ x: 19, y: 19 })).toBe(true);
    expect(inBounds({ x: 20, y: 0 })).toBe(false);
    expect(inBounds({ x: 5, y: -1 })).toBe(false);
  });
  it('measures Manhattan distance', () => {
    expect(manhattan({ x: 1, y: 2 }, { x: 4, y: 6 })).toBe(7);
  });
  it('lists only in-bounds neighbours', () => {
    expect(neighbors({ x: 0, y: 0 })).toEqual([{ x: 0, y: 1 }, { x: 1, y: 0 }]);
    expect(neighbors({ x: 10, y: 10 })).toHaveLength(4);
  });
  it('lists all 400 cells row by row', () => {
    const cells = allCells();
    expect(cells).toHaveLength(400);
    expect(cells[0]).toEqual({ x: 0, y: 0 });
    expect(cells[1]).toEqual({ x: 1, y: 0 });
    expect(cells[399]).toEqual({ x: 19, y: 19 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/grid.test.js`
Expected: FAIL — cannot find `../src/core/grid.js`.

- [ ] **Step 3: Write the implementation** (`src/core/grid.js`)

```js
import { GRID_SIZE } from './config.js';

export const VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
export const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const cellKey = ({ x, y }) => `${x},${y}`;
export const sameCell = (a, b) => a.x === b.x && a.y === b.y;
export const inBounds = ({ x, y }) => x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;
export const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export const neighbors = (cell) =>
  Object.values(VECTORS)
    .map((v) => ({ x: cell.x + v.x, y: cell.y + v.y }))
    .filter(inBounds);

export function allCells() {
  const cells = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) cells.push({ x, y });
  }
  return cells;
}
```

- [ ] **Step 4: Refactor `src/core/game.js` to reuse them (green bar first, no behavior change)**

Run `yarn test` first and confirm it is green. Then replace the top of `game.js` through `placeFood` with:

```js
import { GRID_SIZE, START_LENGTH } from './config.js';
import { VECTORS, OPPOSITE, cellKey, sameCell, inBounds, allCells } from './grid.js';

const MAX_QUEUED = 2;

export function placeFood(snake, rng) {
  const occupied = new Set(snake.map(cellKey));
  const free = allCells().filter((c) => !occupied.has(cellKey(c)));
  if (free.length === 0) return null;
  return free[Math.floor(rng() * free.length)];
}
```
Delete the local `VECTORS`, `OPPOSITE`, `isOutOfBounds` and `sameCell` definitions, and in `tick` replace `isOutOfBounds(newHead)` with `!inBounds(newHead)`. Everything else in the file stays as is.

- [ ] **Step 5: Run to verify, then commit**

Run: `yarn test`
Expected: PASS (whole suite, unchanged counts plus the new grid tests).

```bash
git add src/core/grid.js src/core/game.js tests/grid.test.js
git commit -m "refactor: share grid helpers so the upcoming hazard modules reuse one definition of a cell"
```

---

### Task 2: Pathing — can the head still reach a cell?

**Files:**
- Create: `src/core/pathing.js`
- Test: `tests/pathing.test.js`

**Interfaces:**
- Consumes: `cellKey`, `neighbors` from `grid.js`.
- Produces: `reachable(snake: Cell[], blocked: Set<string>): Set<string>` — keys of every cell the head can reach, where `blocked` holds permanently blocked `"x,y"` keys and a body cell `i` steps behind the head (head is 0) is entered only at step `k ≥ length − i`; `hasRoute(snake, blocked, food): boolean` (false when `food` is `null`).

- [ ] **Step 1: Write the failing tests** (`tests/pathing.test.js`)

```js
import { describe, it, expect } from 'vitest';
import { reachable, hasRoute } from '../src/core/pathing.js';

const snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
const column = (x) => new Set(Array.from({ length: 20 }, (_, y) => `${x},${y}`));

describe('reachable', () => {
  it('reaches every cell on an empty board (body cells vacate in time)', () => {
    expect(reachable(snake, new Set()).size).toBe(400);
  });

  it('cannot cross a full wall', () => {
    const cells = reachable(snake, column(10));
    expect(cells.has('15,5')).toBe(false);
    expect(cells.has('9,5')).toBe(true);
  });

  it('can enter the tail cell on the next step (tail-follow)', () => {
    // a 2x2 coil: head (0,0), tail (0,1)
    const coil = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const cells = reachable(coil, new Set());
    expect(cells.has('0,1')).toBe(true);
    expect(cells.has('0,2')).toBe(true);
  });

  it('cannot go through a body cell that has not vacated yet', () => {
    const line = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
    // (0,1) is blocked, so the only way out is through the body at (1,0)
    const cells = reachable(line, new Set(['0,1']));
    expect(cells.size).toBe(1);
  });
});

describe('hasRoute', () => {
  it('is true when the food is reachable', () => {
    expect(hasRoute(snake, new Set(), { x: 15, y: 15 })).toBe(true);
  });
  it('is false when the food is walled off', () => {
    expect(hasRoute(snake, column(10), { x: 15, y: 5 })).toBe(false);
  });
  it('is false when there is no food', () => {
    expect(hasRoute(snake, new Set(), null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/pathing.test.js`
Expected: FAIL — cannot find `../src/core/pathing.js`.

- [ ] **Step 3: Write the implementation** (`src/core/pathing.js`)

```js
import { cellKey, neighbors } from './grid.js';

// Cells the snake's head can reach. `blocked` holds permanently blocked "x,y" keys
// (walls, bomb, enemy). A body cell `i` steps behind the head (head is 0) is
// vacated after `length - i` steps, so it can only be entered at step >= length - i.
export function reachable(snake, blocked) {
  const length = snake.length;
  const bodyIndex = new Map(snake.map((cell, i) => [cellKey(cell), i]));
  const head = snake[0];
  const seen = new Set([cellKey(head)]);
  let frontier = [head];
  let steps = 0;
  while (frontier.length > 0) {
    steps += 1;
    const next = [];
    for (const cell of frontier) {
      for (const n of neighbors(cell)) {
        const key = cellKey(n);
        if (seen.has(key) || blocked.has(key)) continue;
        const i = bodyIndex.get(key);
        if (i !== undefined && steps < length - i) continue;
        seen.add(key);
        next.push(n);
      }
    }
    frontier = next;
  }
  return seen;
}

export const hasRoute = (snake, blocked, food) =>
  food !== null && reachable(snake, blocked).has(cellKey(food));
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `yarn test`
Expected: PASS.

```bash
git add src/core/pathing.js tests/pathing.test.js
git commit -m "feat: add time-aware reachability so hazards can never cut the snake off from its food"
```

---

### Task 3: Food only on reachable cells

**Files:**
- Modify: `src/core/game.js` (`placeFood`)
- Modify: `tests/game.test.js` (append)

**Interfaces:**
- Consumes: `reachable` (pathing), `GRID_SIZE`, helpers from `grid.js`.
- Produces: `placeFood(snake, rng, blocked = new Set()): Cell | null` — picks uniformly among free cells (not on the snake or in `blocked`) that the head can reach; if none are reachable, falls back to any free cell; `null` only when no free cell exists. The two-argument call behaves as before on open boards.

- [ ] **Step 1: Write the failing tests** — append to `tests/game.test.js` (the file already imports `placeFood`, `GRID_SIZE`; add nothing else):

```js
describe('placeFood with blocked and unreachable cells', () => {
  const head = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
  const wallColumn = new Set(Array.from({ length: GRID_SIZE }, (_, y) => `10,${y}`));

  it('never picks a blocked cell', () => {
    expect(placeFood(head, () => 0, new Set(['0,0']))).toEqual({ x: 1, y: 0 });
  });

  it('only picks cells the head can reach', () => {
    const food = placeFood(head, () => 0.999, wallColumn);
    expect(food.x).toBeLessThan(10);
  });

  it('falls back to any free cell when nothing is reachable', () => {
    const boxedIn = new Set(['5,4', '5,6', '6,5']);
    expect(placeFood(head, () => 0, boxedIn)).toEqual({ x: 0, y: 0 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/game.test.js`
Expected: FAIL — `placeFood` ignores the third argument (blocked cell chosen; far side of the wall chosen).

- [ ] **Step 3: Write the implementation** — in `src/core/game.js` add `import { reachable } from './pathing.js';` and replace `placeFood`:

```js
export function placeFood(snake, rng, blocked = new Set()) {
  const occupied = new Set([...snake.map(cellKey), ...blocked]);
  const free = allCells().filter((c) => !occupied.has(cellKey(c)));
  if (free.length === 0) return null;
  const reach = reachable(snake, blocked);
  const onRoute = free.filter((c) => reach.has(cellKey(c)));
  const pool = onRoute.length > 0 ? onRoute : free;
  return pool[Math.floor(rng() * pool.length)];
}
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `yarn test`
Expected: PASS (the earlier `placeFood` tests — the lone free cell and the full grid — still pass through the fallback and the empty check).

```bash
git add src/core/game.js tests/game.test.js
git commit -m "feat: place food only where the snake can reach it so obstacles never strand the next apple"
```

---

### Task 4: Hazard data, collisions, visuals math and safe placement

**Files:**
- Create: `src/core/hazards.js`
- Test: `tests/hazards.test.js`

**Interfaces:**
- Consumes: `grid.js`, `pathing.js` (`hasRoute`).
- Produces (all from `hazards.js`):
  - constants `TELEGRAPH_STEPS = 24`, `SAFE_DISTANCE = 5`, `LANE_LENGTH = 10`, `PLACEMENT_ATTEMPTS = 50`, `WALL_CELL_CAP = 80`, `FADE_STEPS = 40`, `FADE_APPLES = 100`, `FLASH_PERIOD = 4`
  - types: wall `{cells, age, fades}`; bomb `{cells: [cell], age}`; enemy `{cells (head first), age, status: 'ghost'|'alive'|'dead'}`; hazards `{walls, bomb, enemy}`
  - `emptyHazards()`, `hazardCells(h): Cell[]`, `blockedKeys(h): Set<string>`
  - `isSolid(obj, snake): boolean` (`obj.age >= 24` and no snake cell overlaps `obj.cells`)
  - `hitsHazard(h, cell, snake): boolean`
  - `isGhostVisible(age, reducedMotion = false): boolean`, `wallOpacity(wall): number`
  - `placeSegment(world, length, rng): Cell[] | null`, `placeCell(world, rng): Cell[] | null` where `world = { snake, direction, food, hazards }`

- [ ] **Step 1: Write the failing tests** (`tests/hazards.test.js`)

```js
import { describe, it, expect } from 'vitest';
import {
  emptyHazards, hazardCells, blockedKeys, isSolid, hitsHazard,
  isGhostVisible, wallOpacity, placeSegment, placeCell,
  SAFE_DISTANCE, LANE_LENGTH,
} from '../src/core/hazards.js';
import { hasRoute } from '../src/core/pathing.js';
import { cellKey, manhattan } from '../src/core/grid.js';

// small deterministic generator for repeatable "random" placement
const seeded = (seed) => {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const cycle = (...values) => { let i = 0; return () => values[i++ % values.length]; };

const snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
const wall = (cells, age = 0, fades = false) => ({ cells, age, fades });
const world = (overrides = {}) => ({
  snake, direction: 'right', food: { x: 3, y: 3 }, hazards: emptyHazards(), ...overrides,
});

describe('hazard bookkeeping', () => {
  it('starts empty', () => {
    expect(emptyHazards()).toEqual({ walls: [], bomb: null, enemy: null });
  });
  it('lists every hazard cell as blocked', () => {
    const h = {
      walls: [wall([{ x: 1, y: 1 }, { x: 2, y: 1 }])],
      bomb: { cells: [{ x: 5, y: 5 }], age: 0 },
      enemy: { cells: [{ x: 7, y: 7 }, { x: 8, y: 7 }, { x: 9, y: 7 }], age: 0, status: 'ghost' },
    };
    expect(hazardCells(h)).toHaveLength(6);
    expect(blockedKeys(h)).toEqual(new Set(['1,1', '2,1', '5,5', '7,7', '8,7', '9,7']));
  });
});

describe('solid versus ghost', () => {
  it('is a ghost for the first 24 steps', () => {
    expect(isSolid(wall([{ x: 1, y: 1 }], 23), snake)).toBe(false);
    expect(isSolid(wall([{ x: 1, y: 1 }], 24), snake)).toBe(true);
  });
  it('stays a ghost while the snake is on it', () => {
    expect(isSolid(wall([{ x: 9, y: 10 }, { x: 9, y: 11 }], 30), snake)).toBe(false);
  });
});

describe('hitsHazard', () => {
  const h = {
    walls: [wall([{ x: 12, y: 10 }], 30)],
    bomb: { cells: [{ x: 14, y: 10 }], age: 30 },
    enemy: { cells: [{ x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }], age: 0, status: 'alive' },
  };
  it('hits a solid wall, the solid bomb, and a live enemy', () => {
    expect(hitsHazard(h, { x: 12, y: 10 }, snake)).toBe(true);
    expect(hitsHazard(h, { x: 14, y: 10 }, snake)).toBe(true);
    expect(hitsHazard(h, { x: 17, y: 10 }, snake)).toBe(true);
  });
  it('hits a dead enemy', () => {
    const dead = { ...h, enemy: { ...h.enemy, status: 'dead' } };
    expect(hitsHazard(dead, { x: 16, y: 10 }, snake)).toBe(true);
  });
  it('passes through ghosts', () => {
    const ghosts = {
      walls: [wall([{ x: 12, y: 10 }], 5)],
      bomb: { cells: [{ x: 14, y: 10 }], age: 5 },
      enemy: { ...h.enemy, status: 'ghost' },
    };
    expect(hitsHazard(ghosts, { x: 12, y: 10 }, snake)).toBe(false);
    expect(hitsHazard(ghosts, { x: 14, y: 10 }, snake)).toBe(false);
    expect(hitsHazard(ghosts, { x: 16, y: 10 }, snake)).toBe(false);
  });
  it('does not hit empty cells', () => {
    expect(hitsHazard(h, { x: 1, y: 1 }, snake)).toBe(false);
  });
});

describe('visuals', () => {
  it('flashes: visible 4 steps, hidden 4 steps', () => {
    expect([0, 1, 2, 3].every((a) => isGhostVisible(a))).toBe(true);
    expect([4, 5, 6, 7].every((a) => !isGhostVisible(a))).toBe(true);
    expect(isGhostVisible(8)).toBe(true);
  });
  it('stays visible under reduced motion', () => {
    expect([4, 5, 6, 7].every((a) => isGhostVisible(a, true))).toBe(true);
  });
  it('keeps ordinary walls fully opaque', () => {
    expect(wallOpacity(wall([{ x: 1, y: 1 }], 500, false))).toBe(1);
  });
  it('fades late walls over 40 steps after they turn solid', () => {
    const cells = [{ x: 1, y: 1 }];
    expect(wallOpacity(wall(cells, 10, true))).toBe(1);
    expect(wallOpacity(wall(cells, 24, true))).toBe(1);
    expect(wallOpacity(wall(cells, 44, true))).toBeCloseTo(0.5);
    expect(wallOpacity(wall(cells, 64, true))).toBe(0);
    expect(wallOpacity(wall(cells, 500, true))).toBe(0);
  });
});

describe('safe placement', () => {
  const lane = (c) => c.y === 10 && c.x > 10 && c.x <= 10 + LANE_LENGTH;

  it('places a straight segment of the requested length inside the board', () => {
    const cells = placeSegment(world(), 3, seeded(1));
    expect(cells).toHaveLength(3);
    const sameRow = cells.every((c) => c.y === cells[0].y);
    const sameCol = cells.every((c) => c.x === cells[0].x);
    expect(sameRow || sameCol).toBe(true);
    cells.forEach((c) => {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(20);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(20);
    });
  });

  it('keeps clear of the head, its straight-ahead lane, the snake and the food', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const cells = placeSegment(world(), 3, seeded(seed));
      if (!cells) continue;
      cells.forEach((c) => {
        expect(manhattan(c, snake[0])).toBeGreaterThanOrEqual(SAFE_DISTANCE);
        expect(lane(c)).toBe(false);
        expect(snake.some((s) => s.x === c.x && s.y === c.y)).toBe(false);
        expect(c.x === 3 && c.y === 3).toBe(false);
      });
    }
  });

  it('does not overlap existing hazards', () => {
    const existing = { walls: [wall([{ x: 15, y: 15 }, { x: 16, y: 15 }, { x: 17, y: 15 }])], bomb: null, enemy: null };
    for (let seed = 1; seed <= 100; seed++) {
      const cells = placeSegment(world({ hazards: existing }), 3, seeded(seed));
      if (!cells) continue;
      expect(cells.some((c) => c.y === 15 && c.x >= 15 && c.x <= 17)).toBe(false);
    }
  });

  it('never leaves the food unreachable', () => {
    // a barrier at x=15 from y=0..18 leaves one gap at (15,19)
    const barrier = wall(Array.from({ length: 19 }, (_, y) => ({ x: 15, y })), 30);
    const hazards = { walls: [barrier], bomb: null, enemy: null };
    const food = { x: 18, y: 5 };
    for (let seed = 1; seed <= 100; seed++) {
      const cells = placeSegment(world({ hazards, food }), 2, seeded(seed));
      if (!cells) continue;
      const blocked = new Set([...blockedKeys(hazards), ...cells.map(cellKey)]);
      expect(hasRoute(snake, blocked, food)).toBe(true);
    }
  });

  it('rejects a cell that would plug the only gap, then skips', () => {
    const barrier = wall(Array.from({ length: 19 }, (_, y) => ({ x: 15, y })), 30);
    const hazards = { walls: [barrier], bomb: null, enemy: null };
    // rng always yields x=15, y=19 (the gap)
    const gap = cycle(0.76, 0.96);
    expect(placeCell(world({ hazards, food: { x: 18, y: 5 } }), gap)).toBeNull();
  });

  it('skips when every attempt lands on the snake', () => {
    expect(placeCell(world(), cycle(0.5, 0.5))).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/hazards.test.js`
Expected: FAIL — cannot find `../src/core/hazards.js`.

- [ ] **Step 3: Write the implementation** (`src/core/hazards.js`)

```js
import { GRID_SIZE } from './config.js';
import { VECTORS, cellKey, sameCell, inBounds, manhattan } from './grid.js';
import { hasRoute } from './pathing.js';

export const TELEGRAPH_STEPS = 24;
export const SAFE_DISTANCE = 5;
export const LANE_LENGTH = 10;
export const PLACEMENT_ATTEMPTS = 50;
export const WALL_CELL_CAP = 80;
export const FADE_STEPS = 40;
export const FADE_APPLES = 100;
export const FLASH_PERIOD = 4;

export const emptyHazards = () => ({ walls: [], bomb: null, enemy: null });

export function hazardCells(h) {
  return [
    ...h.walls.flatMap((w) => w.cells),
    ...(h.bomb ? h.bomb.cells : []),
    ...(h.enemy ? h.enemy.cells : []),
  ];
}

export const blockedKeys = (h) => new Set(hazardCells(h).map(cellKey));

const overlapsSnake = (cells, snake) => cells.some((c) => snake.some((s) => sameCell(c, s)));

// Telegraph over (24 steps) and no part of the snake is on it.
export const isSolid = (obj, snake) => obj.age >= TELEGRAPH_STEPS && !overlapsSnake(obj.cells, snake);

export function hitsHazard(h, cell, snake) {
  const at = (cells) => cells.some((c) => sameCell(c, cell));
  if (h.walls.some((w) => at(w.cells) && isSolid(w, snake))) return true;
  if (h.bomb && at(h.bomb.cells) && isSolid(h.bomb, snake)) return true;
  if (h.enemy && h.enemy.status !== 'ghost' && at(h.enemy.cells)) return true;
  return false;
}

export const isGhostVisible = (age, reducedMotion = false) =>
  reducedMotion || Math.floor(age / FLASH_PERIOD) % 2 === 0;

export function wallOpacity(wall) {
  if (!wall.fades || wall.age < TELEGRAPH_STEPS) return 1;
  return Math.max(0, 1 - (wall.age - TELEGRAPH_STEPS) / FADE_STEPS);
}

function laneKeys(head, direction) {
  const v = VECTORS[direction];
  const keys = new Set();
  for (let i = 1; i <= LANE_LENGTH; i++) keys.add(cellKey({ x: head.x + v.x * i, y: head.y + v.y * i }));
  return keys;
}

function segmentCandidate(length) {
  return (rng) => {
    const horizontal = rng() < 0.5;
    const x = Math.floor(rng() * (horizontal ? GRID_SIZE - length + 1 : GRID_SIZE));
    const y = Math.floor(rng() * (horizontal ? GRID_SIZE : GRID_SIZE - length + 1));
    return Array.from({ length }, (_, i) => ({
      x: horizontal ? x + i : x,
      y: horizontal ? y : y + i,
    }));
  };
}

const singleCandidate = (rng) => [
  { x: Math.floor(rng() * GRID_SIZE), y: Math.floor(rng() * GRID_SIZE) },
];

// Try up to PLACEMENT_ATTEMPTS random candidates; return the first that is free,
// safe (distance and lane from the head) and leaves a route to the food, else null.
function tryPlace(world, makeCells, rng) {
  const { snake, direction, food, hazards } = world;
  const head = snake[0];
  const lane = laneKeys(head, direction);
  const taken = new Set([...snake.map(cellKey), ...blockedKeys(hazards)]);
  if (food) taken.add(cellKey(food));
  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
    const cells = makeCells(rng);
    const ok = cells.every(
      (c) =>
        inBounds(c) &&
        !taken.has(cellKey(c)) &&
        manhattan(c, head) >= SAFE_DISTANCE &&
        !lane.has(cellKey(c)),
    );
    if (!ok) continue;
    const blocked = new Set([...blockedKeys(hazards), ...cells.map(cellKey)]);
    if (hasRoute(snake, blocked, food)) return cells;
  }
  return null;
}

export const placeSegment = (world, length, rng) => tryPlace(world, segmentCandidate(length), rng);
export const placeCell = (world, rng) => tryPlace(world, singleCandidate, rng);
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `yarn test`
Expected: PASS. (The seeded loops skip a seed that finds no spot; they assert the rules for every placement that is returned.)

```bash
git add src/core/hazards.js tests/hazards.test.js
git commit -m "feat: add hazard data, collisions and safe placement so obstacles are fair by construction"
```

---

### Task 5: Per-apple spawn rules by tier

**Files:**
- Modify: `src/core/hazards.js` (append)
- Modify: `tests/hazards.test.js` (append)

**Interfaces:**
- Consumes: `musicTier` from `pacing.js`, `START_LENGTH` from `config.js`, `placeSegment`, `placeCell`.
- Produces: `spawnForApple(world, hazards, rng, apples): Hazards` where `world = { snake, direction, food }` (food is the newly placed food) and `apples` is the score after eating. Rules: crossing tier 2 places 4 L3 walls; from tier 4 the bomb is (re)placed on every apple (the old bomb stays if no new spot is found); from tier 6 one 2-cell wall is added while total wall cells + 2 ≤ 80; at tier 10 every wall is re-laid (same lengths, `fades = apples >= 100`); from tier 8 an enemy ghost (3 cells, age 0) is spawned when there is none or the existing one is dead. New hazards have `age: 0`.

- [ ] **Step 1: Write the failing tests** — append to `tests/hazards.test.js` (add `spawnForApple` and `WALL_CELL_CAP` to the import list at the top of the file):

```js
describe('spawnForApple', () => {
  const w = () => ({ snake, direction: 'right', food: { x: 3, y: 3 } });
  const segmentsOf = (h) => h.walls.map((x) => x.cells.length).sort();

  it('adds nothing below tier 2', () => {
    expect(spawnForApple(w(), emptyHazards(), seeded(1), 15)).toEqual(emptyHazards());
  });

  it('places four 3-cell walls on the apple that reaches tier 2', () => {
    const h = spawnForApple(w(), emptyHazards(), seeded(1), 16);
    expect(segmentsOf(h)).toEqual([3, 3, 3, 3]);
    expect(h.walls.every((x) => x.age === 0 && x.fades === false)).toBe(true);
    expect(h.bomb).toBeNull();
  });

  it('adds no more walls on later apples until tier 6', () => {
    const start = spawnForApple(w(), emptyHazards(), seeded(1), 16);
    expect(spawnForApple(w(), start, seeded(2), 17).walls).toEqual(start.walls);
  });

  it('places the bomb at tier 4 and moves it on every later apple', () => {
    const first = spawnForApple(w(), emptyHazards(), seeded(1), 32);
    expect(first.bomb.cells).toHaveLength(1);
    expect(first.bomb.age).toBe(0);
    const aged = { ...first, bomb: { ...first.bomb, age: 30 } };
    const moved = spawnForApple(w(), aged, seeded(5), 33);
    expect(moved.bomb.age).toBe(0);
    expect(moved.bomb.cells[0]).not.toEqual(first.bomb.cells[0]);
  });

  it('adds one 2-cell wall per apple from tier 6', () => {
    const one = spawnForApple(w(), emptyHazards(), seeded(1), 48);
    expect(segmentsOf(one)).toEqual([2]);
    const two = spawnForApple(w(), one, seeded(2), 49);
    expect(segmentsOf(two)).toEqual([2, 2]);
  });

  it('stops adding walls at the 80-cell cap', () => {
    const full = {
      walls: Array.from({ length: 40 }, (_, i) =>
        wall([{ x: i % 20, y: 2 * Math.floor(i / 20) }, { x: i % 20, y: 2 * Math.floor(i / 20) + 1 }], 30)),
      bomb: null,
      enemy: null,
    };
    expect(WALL_CELL_CAP).toBe(80);
    expect(spawnForApple(w(), full, seeded(1), 50).walls).toHaveLength(40);
  });

  it('spawns a ghost enemy at tier 8', () => {
    const h = spawnForApple(w(), emptyHazards(), seeded(1), 64);
    expect(h.enemy.cells).toHaveLength(3);
    expect(h.enemy.status).toBe('ghost');
    expect(h.enemy.age).toBe(0);
  });

  it('leaves a live enemy alone but replaces a dead one', () => {
    const base = spawnForApple(w(), emptyHazards(), seeded(1), 64);
    const alive = { ...base, enemy: { ...base.enemy, status: 'alive', age: 9 } };
    expect(spawnForApple(w(), alive, seeded(2), 65).enemy).toEqual(alive.enemy);
    const dead = { ...base, enemy: { ...base.enemy, status: 'dead', age: 9 } };
    const respawned = spawnForApple(w(), dead, seeded(3), 65).enemy;
    expect(respawned.status).toBe('ghost');
    expect(respawned.age).toBe(0);
  });

  it('re-lays every wall at tier 10, keeping count and lengths', () => {
    const start = spawnForApple(w(), emptyHazards(), seeded(1), 16);
    const aged = { ...start, walls: start.walls.map((x) => ({ ...x, age: 40 })) };
    const relaid = spawnForApple(w(), aged, seeded(9), 80);
    // four 3-cell walls plus the per-apple 2-cell wall added on this apple, all re-laid
    expect(segmentsOf(relaid)).toEqual([2, 3, 3, 3, 3]);
    expect(relaid.walls.every((x) => x.age === 0)).toBe(true);
  });

  it('marks re-laid walls as fading only from 100 apples', () => {
    const start = spawnForApple(w(), emptyHazards(), seeded(1), 16);
    expect(spawnForApple(w(), start, seeded(2), 99).walls.every((x) => !x.fades)).toBe(true);
    expect(spawnForApple(w(), start, seeded(2), 100).walls.every((x) => x.fades)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/hazards.test.js`
Expected: FAIL — `spawnForApple` is not exported.

- [ ] **Step 3: Write the implementation** — in `src/core/hazards.js` extend the imports and append:

```js
import { GRID_SIZE, START_LENGTH } from './config.js';
import { musicTier } from './pacing.js';
```
(replace the existing `config.js` import line), then append:

```js
const INITIAL_SEGMENTS = 4;
const INITIAL_LENGTH = 3;
const PER_APPLE_LENGTH = 2;
const ENEMY_LENGTH = 3;

const wallCellCount = (h) => h.walls.reduce((total, w) => total + w.cells.length, 0);

// Hazards after an apple is eaten. `world.food` is the newly placed food;
// `apples` is the score after eating. Existing hazards are not aged here.
export function spawnForApple(world, hazards, rng, apples) {
  const tierAt = (n) => musicTier(n + START_LENGTH);
  const tier = tierAt(apples);
  const crossed = (t) => tier >= t && tierAt(apples - 1) < t;
  let h = hazards;
  const at = () => ({ ...world, hazards: h });
  const addWall = (length, fades = false) => {
    const cells = placeSegment(at(), length, rng);
    if (cells) h = { ...h, walls: [...h.walls, { cells, age: 0, fades }] };
  };

  if (crossed(2)) {
    for (let i = 0; i < INITIAL_SEGMENTS; i++) addWall(INITIAL_LENGTH);
  }

  if (tier >= 4) {
    const previous = h.bomb;
    h = { ...h, bomb: null };
    const cells = placeCell(at(), rng);
    h = { ...h, bomb: cells ? { cells, age: 0 } : previous };
  }

  if (tier >= 6 && wallCellCount(h) + PER_APPLE_LENGTH <= WALL_CELL_CAP) {
    addWall(PER_APPLE_LENGTH);
  }

  if (tier >= 10) {
    const lengths = h.walls.map((w) => w.cells.length);
    h = { ...h, walls: [] };
    lengths.forEach((length) => addWall(length, apples >= FADE_APPLES));
  }

  if (tier >= 8 && (!h.enemy || h.enemy.status === 'dead')) {
    const without = { ...h, enemy: null };
    const cells = placeSegment({ ...world, hazards: without }, ENEMY_LENGTH, rng);
    if (cells) h = { ...h, enemy: { cells, age: 0, status: 'ghost' } };
  }

  return h;
}
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `yarn test`
Expected: PASS. (If a seeded expectation such as "bomb moved to a different cell" fails only because that seed happened to land on the same cell, change the seed in the test — the rule is not at fault. Do not weaken the assertion.)

```bash
git add src/core/hazards.js tests/hazards.test.js
git commit -m "feat: introduce each hazard at its tier on the apple that reaches it"
```

---

### Task 6: Per-step ageing and the enemy snake

**Files:**
- Modify: `src/core/hazards.js` (append)
- Modify: `tests/hazards.test.js` (append)

**Interfaces:**
- Produces: `stepHazards(hazards, { snake, food }, rng): Hazards` — ages every wall, bomb and enemy by 1; a ghost enemy becomes `alive` (age reset to 0) once `age ≥ 24` and no snake cell is on it; an alive enemy moves one cell on steps where its age is even, to a uniformly random safe neighbour of its head (in bounds; not wall, bomb, snake or its own body; and a route from the snake's head to the food must remain); with no safe move it becomes `dead`.

- [ ] **Step 1: Write the failing tests** — append to `tests/hazards.test.js` (add `stepHazards` to the import list at the top):

```js
describe('stepHazards', () => {
  const foodAt = { x: 18, y: 5 };
  const step = (h, rng = seeded(1), s = snake, food = foodAt) => stepHazards(h, { snake: s, food }, rng);

  it('ages walls, the bomb and the enemy by one step', () => {
    const h = {
      walls: [wall([{ x: 1, y: 1 }], 3)],
      bomb: { cells: [{ x: 2, y: 2 }], age: 4 },
      enemy: { cells: [{ x: 17, y: 3 }, { x: 17, y: 2 }, { x: 17, y: 1 }], age: 5, status: 'dead' },
    };
    const next = step(h);
    expect(next.walls[0].age).toBe(4);
    expect(next.bomb.age).toBe(5);
    expect(next.enemy.age).toBe(6);
  });

  it('turns a ghost enemy live after 24 steps', () => {
    const enemy = { cells: [{ x: 17, y: 18 }, { x: 17, y: 17 }, { x: 17, y: 16 }], age: 23, status: 'ghost' };
    const next = step({ walls: [], bomb: null, enemy });
    expect(next.enemy.status).toBe('alive');
    expect(next.enemy.age).toBe(0);
  });

  it('keeps a ghost enemy a ghost while the snake is on it', () => {
    const onSnake = { cells: [{ x: 9, y: 10 }, { x: 9, y: 11 }, { x: 9, y: 12 }], age: 30, status: 'ghost' };
    expect(step({ walls: [], bomb: null, enemy: onSnake }).enemy.status).toBe('ghost');
  });

  it('moves a live enemy one cell on even ages only', () => {
    const enemy = { cells: [{ x: 17, y: 18 }, { x: 17, y: 17 }, { x: 17, y: 16 }], age: 0, status: 'alive' };
    const h1 = step({ walls: [], bomb: null, enemy });       // age 1: stays
    expect(h1.enemy.cells).toEqual(enemy.cells);
    const h2 = step(h1);                                       // age 2: moves
    expect(h2.enemy.cells).toHaveLength(3);
    expect(h2.enemy.cells).not.toEqual(enemy.cells);
    expect(manhattan(h2.enemy.cells[0], enemy.cells[0])).toBe(1);
    expect(h2.enemy.cells.slice(1)).toEqual(enemy.cells.slice(0, 2));
  });

  it('dies when trapped and stays on the board', () => {
    const enemy = { cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], age: 1, status: 'alive' };
    const trap = { walls: [wall([{ x: 0, y: 1 }], 30)], bomb: null, enemy };
    const next = step(trap);
    expect(next.enemy.status).toBe('dead');
    expect(next.enemy.cells).toEqual(enemy.cells);
  });

  it('never walks into walls, the bomb or the snake, and always leaves a route', () => {
    const barrier = wall(Array.from({ length: 19 }, (_, y) => ({ x: 15, y })), 30);
    for (let seed = 1; seed <= 5; seed++) {
      const rng = seeded(seed);
      let h = {
        walls: [barrier],
        bomb: { cells: [{ x: 18, y: 18 }], age: 30 },
        enemy: { cells: [{ x: 17, y: 12 }, { x: 17, y: 11 }, { x: 17, y: 10 }], age: 0, status: 'alive' },
      };
      for (let i = 0; i < 80; i++) {
        h = stepHazards(h, { snake, food: foodAt }, rng);
        if (h.enemy.status === 'dead') break;
        const blocked = new Set(blockedKeys(h));
        h.enemy.cells.forEach((c) => {
          expect(c.x).toBeGreaterThanOrEqual(0);
          expect(c.x).toBeLessThan(20);
          expect(c.y).toBeGreaterThanOrEqual(0);
          expect(c.y).toBeLessThan(20);
          expect(barrier.cells.some((b) => b.x === c.x && b.y === c.y)).toBe(false);
          expect(c.x === 18 && c.y === 18).toBe(false);
        });
        expect(hasRoute(snake, blocked, foodAt)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/hazards.test.js`
Expected: FAIL — `stepHazards` is not exported.

- [ ] **Step 3: Write the implementation** — in `src/core/hazards.js` extend the grid import to include `neighbors`, then append:

```js
const ENEMY_MOVE_EVERY = 2;

function stepEnemy(enemy, { snake, food, walls, bomb }, rng) {
  if (enemy.status === 'dead') return enemy;
  if (enemy.status === 'ghost') {
    const live = enemy.age >= TELEGRAPH_STEPS && !overlapsSnake(enemy.cells, snake);
    return live ? { ...enemy, status: 'alive', age: 0 } : enemy;
  }
  if (enemy.age % ENEMY_MOVE_EVERY !== 0) return enemy;

  const others = blockedKeys({ walls, bomb, enemy: null });
  const snakeKeys = new Set(snake.map(cellKey));
  const ownBody = new Set(enemy.cells.slice(0, -1).map(cellKey)); // the tail cell is vacated
  const options = neighbors(enemy.cells[0]).filter((n) => {
    const key = cellKey(n);
    if (others.has(key) || snakeKeys.has(key) || ownBody.has(key)) return false;
    const moved = [n, ...enemy.cells.slice(0, -1)];
    const withEnemy = new Set([...others, ...moved.map(cellKey)]);
    return hasRoute(snake, withEnemy, food);
  });
  if (options.length === 0) return { ...enemy, status: 'dead' };
  const pick = options[Math.floor(rng() * options.length)];
  return { ...enemy, cells: [pick, ...enemy.cells.slice(0, -1)] };
}

// One game step for every hazard: everything ages, and the enemy may move or die.
export function stepHazards(hazards, { snake, food }, rng) {
  const walls = hazards.walls.map((w) => ({ ...w, age: w.age + 1 }));
  const bomb = hazards.bomb && { ...hazards.bomb, age: hazards.bomb.age + 1 };
  let enemy = hazards.enemy && { ...hazards.enemy, age: hazards.enemy.age + 1 };
  if (enemy) enemy = stepEnemy(enemy, { snake, food, walls, bomb }, rng);
  return { walls, bomb, enemy };
}
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `yarn test`
Expected: PASS.

```bash
git add src/core/hazards.js tests/hazards.test.js
git commit -m "feat: age hazards each step and move the enemy snake without ever cutting off the food"
```

---

### Task 7: Wire hazards into `tick` and `createState`

**Files:**
- Modify: `src/core/game.js`
- Modify: `tests/game.test.js` (append)

**Interfaces:**
- Consumes: `emptyHazards`, `hitsHazard`, `stepHazards`, `spawnForApple`, `blockedKeys` from `hazards.js`.
- Produces: `createState` adds `hazards: emptyHazards()`. `tick`: a missing `state.hazards` is treated as empty; the head entering a solid hazard ends the game; hazards step after the snake moves; when an apple is eaten, food is placed first (`placeFood(snake, rng, blockedKeys(...))`) and then `spawnForApple({snake, direction, food}, hazards, rng, newScore)`.

- [ ] **Step 1: Write the failing tests** — append to `tests/game.test.js`; add `import { emptyHazards } from '../src/core/hazards.js';` at the top:

```js
describe('hazards in the game loop', () => {
  const withHazards = (hazards, overrides = {}) => stateWith({ hazards, ...overrides });
  const solidWall = (x, y) => ({ cells: [{ x, y }], age: 30, fades: false });

  it('starts a new game with no hazards', () => {
    expect(createState(rng).hazards).toEqual(emptyHazards());
  });

  it('ends the game when the head hits a solid wall', () => {
    const s = withHazards({ walls: [solidWall(6, 5)], bomb: null, enemy: null });
    expect(tick(s, rng).status).toBe('gameOver');
  });

  it('ends the game on the solid bomb and on a live or dead enemy', () => {
    const bomb = withHazards({ walls: [], bomb: { cells: [{ x: 6, y: 5 }], age: 30 }, enemy: null });
    expect(tick(bomb, rng).status).toBe('gameOver');
    const enemy = (status) => withHazards({
      walls: [], bomb: null,
      enemy: { cells: [{ x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }], age: 0, status },
    });
    expect(tick(enemy('alive'), rng).status).toBe('gameOver');
    expect(tick(enemy('dead'), rng).status).toBe('gameOver');
  });

  it('lets the snake pass through ghosts', () => {
    const ghostWall = { cells: [{ x: 6, y: 5 }], age: 5, fades: false };
    const s = withHazards({ walls: [ghostWall], bomb: null, enemy: { cells: [{ x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }], age: 0, status: 'ghost' } });
    expect(tick(s, rng).status).toBe('playing');
  });

  it('ages hazards every step', () => {
    const s = withHazards({ walls: [{ cells: [{ x: 1, y: 1 }], age: 3, fades: false }], bomb: null, enemy: null });
    expect(tick(s, rng).hazards.walls[0].age).toBe(4);
  });

  it('treats a missing hazards field as empty', () => {
    const s = stateWith();
    expect(tick(s, rng).hazards).toEqual(emptyHazards());
  });

  it('spawns the tier-2 walls on the 16th apple, after placing new food', () => {
    const s = stateWith({
      score: 15,
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
      food: { x: 11, y: 10 },
      hazards: emptyHazards(),
    });
    const next = tick(s, () => 0.37);
    expect(next.score).toBe(16);
    expect(next.hazards.walls.length).toBeGreaterThan(0);
    const wallKeys = new Set(next.hazards.walls.flatMap((w) => w.cells.map((c) => `${c.x},${c.y}`)));
    expect(wallKeys.has(`${next.food.x},${next.food.y}`)).toBe(false);
  });

  it('keeps hazards across a non-eating step and across game over', () => {
    const hz = { walls: [solidWall(1, 1)], bomb: null, enemy: null };
    expect(tick(withHazards(hz), rng).hazards.walls).toHaveLength(1);
    expect(tick(withHazards({ ...hz, walls: [solidWall(6, 5)] }), rng).hazards.walls).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/game.test.js`
Expected: FAIL — `createState` has no `hazards`; walls do not kill; hazards do not age or spawn.

- [ ] **Step 3: Write the implementation** — in `src/core/game.js` add:

```js
import { emptyHazards, hitsHazard, stepHazards, spawnForApple, blockedKeys } from './hazards.js';
```
Add `hazards: emptyHazards(),` to the object returned by `createState`. Replace `tick` with:

```js
export function tick(state, rng) {
  if (state.status !== 'playing') return state;
  const hazards = state.hazards ?? emptyHazards();
  const [next, ...queued] = state.queued;
  const direction = next ?? state.direction;
  const v = VECTORS[direction];
  const head = state.snake[0];
  const newHead = { x: head.x + v.x, y: head.y + v.y };
  const eating = state.food !== null && sameCell(newHead, state.food);
  const bodyAfterMove = eating ? state.snake : state.snake.slice(0, -1);
  if (
    !inBounds(newHead) ||
    bodyAfterMove.some((c) => sameCell(c, newHead)) ||
    hitsHazard(hazards, newHead, state.snake)
  ) {
    return { ...state, direction, queued, hazards, status: 'gameOver' };
  }
  const snake = [newHead, ...bodyAfterMove];
  let nextHazards = stepHazards(hazards, { snake, food: state.food }, rng);
  if (!eating) return { ...state, snake, direction, queued, hazards: nextHazards };

  const score = state.score + 1;
  // Food first, on a reachable cell; then hazards, checked against that food.
  const food = placeFood(snake, rng, blockedKeys(nextHazards));
  nextHazards = spawnForApple({ snake, direction, food }, nextHazards, rng, score);
  return {
    ...state,
    snake,
    direction,
    queued,
    food,
    score,
    hazards: nextHazards,
    status: food === null ? 'gameOver' : 'playing',
  };
}
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `yarn test`
Expected: PASS (all earlier `tick` tests still green).

```bash
git add src/core/game.js tests/game.test.js
git commit -m "feat: run hazards inside the game step so obstacles end runs, age, and spawn with each apple"
```

---

### Task 8: Draw the hazards

**Files:**
- Modify: `src/renderer.js` (full replacement below)
- Modify: `src/main.js` (pass `reducedMotion` to `render`)

**Interfaces:**
- Consumes: `isSolid`, `isGhostVisible`, `wallOpacity` from `hazards.js`.
- Produces: `render(ctx, state, options = {})` where `options.reducedMotion` (boolean) makes ghosts steady instead of flashing. Hazards come from `state.hazards` (absent = none). Rendering is manual-verified (no unit tests), per the spec.

- [ ] **Step 1: Replace `src/renderer.js` with**

```js
import { GRID_SIZE } from './core/config.js';
import { isSolid, isGhostVisible, wallOpacity } from './core/hazards.js';

const SNAKE_COLOR = '#1f7a5c';
const HEAD_COLOR = '#14573f';
const FOOD_COLOR = '#c2410c';
const GRID_COLOR = '#eef1f4';
const WALL_COLOR = '#334155';
const BOMB_COLOR = '#111827';
const SPARK_COLOR = '#f59e0b';
const ENEMY_COLOR = '#7e22ce';
const ENEMY_HEAD_COLOR = '#581c87';
const DEAD_COLOR = '#9ca3af';
const GHOST_STROKE = '#475569';
const GHOST_FILL = 'rgba(100, 116, 139, 0.18)';

function drawGrid(ctx, size) {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * size, 0); ctx.lineTo(i * size, ctx.canvas.height);
    ctx.moveTo(0, i * size); ctx.lineTo(ctx.canvas.width, i * size);
    ctx.stroke();
  }
}

function square(ctx, cell, size, pad) {
  ctx.beginPath();
  ctx.roundRect(cell.x * size + pad, cell.y * size + pad, size - pad * 2, size - pad * 2, size * 0.25);
}

function drawGhost(ctx, cells, age, size, pad, reducedMotion, stroke = GHOST_STROKE) {
  if (!isGhostVisible(age, reducedMotion)) return;
  ctx.save();
  ctx.setLineDash([size * 0.18, size * 0.12]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = GHOST_FILL;
  cells.forEach((cell) => {
    square(ctx, cell, size, pad);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function drawWalls(ctx, state, size, pad, reducedMotion) {
  state.hazards.walls.forEach((wall) => {
    if (!isSolid(wall, state.snake)) {
      drawGhost(ctx, wall.cells, wall.age, size, pad, reducedMotion);
      return;
    }
    const opacity = wallOpacity(wall);
    if (opacity <= 0) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = WALL_COLOR;
    wall.cells.forEach((cell) => {
      ctx.beginPath();
      ctx.rect(cell.x * size + pad / 2, cell.y * size + pad / 2, size - pad, size - pad);
      ctx.fill();
    });
    ctx.restore();
  });
}

function drawBomb(ctx, state, size, pad, reducedMotion) {
  const bomb = state.hazards.bomb;
  if (!bomb) return;
  if (!isSolid(bomb, state.snake)) {
    drawGhost(ctx, bomb.cells, bomb.age, size, pad, reducedMotion);
    return;
  }
  const { x, y } = bomb.cells[0];
  const cx = (x + 0.5) * size;
  const cy = (y + 0.5) * size;
  const r = size * 0.42;
  ctx.fillStyle = BOMB_COLOR;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = SPARK_COLOR;
  ctx.beginPath();
  ctx.arc(cx + r * 0.45, cy - r * 0.45, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemy(ctx, state, size, pad, reducedMotion) {
  const enemy = state.hazards.enemy;
  if (!enemy) return;
  if (enemy.status === 'ghost') {
    drawGhost(ctx, enemy.cells, enemy.age, size, pad, reducedMotion, ENEMY_COLOR);
    return;
  }
  enemy.cells.forEach((cell, i) => {
    ctx.fillStyle = enemy.status === 'dead' ? DEAD_COLOR : i === 0 ? ENEMY_HEAD_COLOR : ENEMY_COLOR;
    square(ctx, cell, size, pad);
    ctx.fill();
    if (enemy.status === 'dead') {
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cell.x * size + size * 0.3, cell.y * size + size * 0.3);
      ctx.lineTo(cell.x * size + size * 0.7, cell.y * size + size * 0.7);
      ctx.moveTo(cell.x * size + size * 0.7, cell.y * size + size * 0.3);
      ctx.lineTo(cell.x * size + size * 0.3, cell.y * size + size * 0.7);
      ctx.stroke();
    }
  });
}

export function render(ctx, state, options = {}) {
  const reducedMotion = options.reducedMotion ?? false;
  const size = ctx.canvas.width / GRID_SIZE;
  const pad = size * 0.08;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawGrid(ctx, size);

  const view = { ...state, hazards: state.hazards ?? { walls: [], bomb: null, enemy: null } };
  drawWalls(ctx, view, size, pad, reducedMotion);
  drawBomb(ctx, view, size, pad, reducedMotion);
  drawEnemy(ctx, view, size, pad, reducedMotion);

  state.snake.forEach((cell, i) => {
    ctx.fillStyle = i === 0 ? HEAD_COLOR : SNAKE_COLOR;
    square(ctx, cell, size, pad);
    ctx.fill();
  });

  if (state.food) {
    ctx.fillStyle = FOOD_COLOR;
    ctx.beginPath();
    ctx.arc((state.food.x + 0.5) * size, (state.food.y + 0.5) * size, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

- [ ] **Step 2: Pass the reduced-motion preference** — in `src/main.js`, add above `function draw()`:

```js
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
```
and change `render(ctx, state);` inside `draw()` to:

```js
  render(ctx, state, { reducedMotion: reducedMotionQuery.matches });
```

- [ ] **Step 3: Verify, then commit**

Run: `node --check src/renderer.js && node --check src/main.js && yarn test`
Expected: syntax checks silent; all suites PASS. (Visual check happens in Task 10.)

```bash
git add src/renderer.js src/main.js
git commit -m "feat: draw walls, the bomb and the enemy with distinct shapes, flashing ghosts and fading walls"
```

---

### Task 9: Touch controls

**Files:**
- Modify: `src/input.js` (add `actionForButton`)
- Modify: `tests/input.test.js` (append)
- Create: `tests/page.test.js`
- Modify: `index.html`, `style.css`
- Modify: `src/synth.js` (add `unlock`), `tests/synth.test.js` (append)
- Modify: `src/main.js` (shared `dispatch`, pointer/click handling)

**Interfaces:**
- Produces: `actionForButton({ action, direction }): Action | null` using the same action objects as `actionForKey`; `synth.unlock(): void` (re-attempts `resume()` on the audio context; no-op before start); in `main.js` a single `dispatch(action)` used by the keyboard and the buttons.

- [ ] **Step 1: Write the failing tests**

Append to `tests/input.test.js` (and add `actionForButton` to its import):

```js
describe('actionForButton', () => {
  it.each(['up', 'down', 'left', 'right'])('maps the %s button to a direction', (direction) => {
    expect(actionForButton({ action: 'direction', direction })).toEqual({ type: 'direction', direction });
  });
  it('maps pause, restart and mute buttons to the same actions as their keys', () => {
    expect(actionForButton({ action: 'pause' })).toEqual(actionForKey('p'));
    expect(actionForButton({ action: 'restart' })).toEqual(actionForKey('Enter'));
    expect(actionForButton({ action: 'mute' })).toEqual(actionForKey('m'));
  });
  it('ignores unknown or incomplete buttons', () => {
    expect(actionForButton({ action: 'direction' })).toBeNull();
    expect(actionForButton({ action: 'direction', direction: 'sideways' })).toBeNull();
    expect(actionForButton({ action: 'explode' })).toBeNull();
    expect(actionForButton({})).toBeNull();
    expect(actionForButton()).toBeNull();
  });
});
```

Create `tests/page.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);

describe('index.html touch controls', () => {
  it.each(['up', 'down', 'left', 'right'])('has a %s direction button', (direction) => {
    expect(buttons.some((b) => b.includes('data-action="direction"') && b.includes(`data-direction="${direction}"`))).toBe(true);
  });
  it.each(['pause', 'restart', 'mute'])('has a %s button', (action) => {
    expect(buttons.some((b) => b.includes(`data-action="${action}"`))).toBe(true);
  });
  it('gives every button an accessible name and type=button', () => {
    buttons.forEach((b) => {
      expect(b).toContain('aria-label=');
      expect(b).toContain('type="button"');
    });
  });
  it('keeps the page free of inline scripts and styles (CSP)', () => {
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)/);
    expect(html).not.toMatch(/\sstyle=/);
  });
});
```

Append to `tests/synth.test.js`:

```js
describe('unlock', () => {
  it('is a safe no-op before start and with no Web Audio', () => {
    expect(() => createSynth(null).unlock()).not.toThrow();
    const { FakeAudioContext } = makeFakeContextClass();
    expect(() => createSynth(FakeAudioContext).unlock()).not.toThrow();
  });

  it('asks a started context to resume again', () => {
    const { FakeAudioContext, log } = makeFakeContextClass();
    const synth = createSynth(FakeAudioContext);
    synth.start();
    let resumed = 0;
    log.contexts[0].resume = () => { resumed += 1; return Promise.resolve(); };
    synth.unlock();
    expect(resumed).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/input.test.js tests/page.test.js tests/synth.test.js`
Expected: FAIL — `actionForButton` and `unlock` do not exist; `index.html` has no touch buttons.

- [ ] **Step 3: Write the implementation**

`src/input.js` — append:

```js
const BUTTON_DIRECTIONS = ['up', 'down', 'left', 'right'];
const BUTTON_ACTIONS = ['pause', 'restart', 'mute'];

// Maps a touch button's data attributes to the same actions the keyboard produces.
export function actionForButton({ action, direction } = {}) {
  if (action === 'direction') {
    return BUTTON_DIRECTIONS.includes(direction) ? { type: 'direction', direction } : null;
  }
  return BUTTON_ACTIONS.includes(action) ? { type: action } : null;
}
```

`src/synth.js` — add to the returned object (next to `silence`):

```js
    // Some mobile browsers only unlock audio on a later gesture event; try again.
    unlock() {
      ctx?.resume?.()?.catch?.(() => {});
    },
```

`index.html` — replace the `<main>` contents with:

```html
  <main>
    <header>
      <span>Score: <strong id="score">0</strong></span>
      <span>Best: <strong id="best">0</strong></span>
      <button id="mute" type="button" data-action="mute" aria-pressed="false" aria-label="Mute music">Mute (M)</button>
    </header>
    <canvas id="board" width="400" height="400" aria-label="Snake game board"></canvas>
    <p id="message" role="status">Press an arrow key or WASD, or tap a direction, to start</p>
    <div class="controls" role="group" aria-label="Touch controls">
      <div class="dpad">
        <button type="button" class="up" data-action="direction" data-direction="up" aria-label="Up">&#9650;</button>
        <button type="button" class="left" data-action="direction" data-direction="left" aria-label="Left">&#9664;</button>
        <button type="button" class="right" data-action="direction" data-direction="right" aria-label="Right">&#9654;</button>
        <button type="button" class="down" data-action="direction" data-direction="down" aria-label="Down">&#9660;</button>
      </div>
      <div class="side">
        <button type="button" data-action="pause" aria-label="Pause or resume">Pause</button>
        <button type="button" data-action="restart" aria-label="Restart game">Restart</button>
      </div>
    </div>
    <p class="help">P pause · Enter restart · M mute</p>
  </main>
```

`style.css` — replace `main`, `canvas` and `button` rules and append the control rules, so the file reads:

```css
:root { --bg: #f4f6f8; --board: #ffffff; --ink: #1f2933; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center;
       background: var(--bg); color: var(--ink); font-family: system-ui, sans-serif;
       touch-action: manipulation; }
main { text-align: center; width: min(100vw - 1.5rem, 420px); padding: 0.5rem 0; }
header { display: flex; gap: 1.5rem; justify-content: center; align-items: center;
         margin-bottom: 0.75rem; font-size: 1.1rem; }
canvas { width: min(100%, 400px); height: auto; aspect-ratio: 1;
         background: var(--board); border-radius: 12px; box-shadow: 0 4px 16px rgb(0 0 0 / 12%); }
button { font: inherit; padding: 0.25rem 0.75rem; border-radius: 8px; border: 1px solid #9aa5b1;
         background: #fff; color: var(--ink); cursor: pointer; }
#message { min-height: 1.5rem; font-weight: 600; }
.help { color: #52606d; font-size: 0.9rem; }

.controls { display: flex; justify-content: center; align-items: center; gap: 1.25rem; margin: 0.5rem 0; }
.dpad { display: grid; grid-template: repeat(3, 56px) / repeat(3, 56px); gap: 6px; }
.dpad .up { grid-area: 1 / 2; }
.dpad .left { grid-area: 2 / 1; }
.dpad .right { grid-area: 2 / 3; }
.dpad .down { grid-area: 3 / 2; }
.side { display: grid; gap: 8px; }
.controls button { min-width: 56px; min-height: 56px; font-size: 1.25rem; padding: 0.25rem 0.75rem;
                   touch-action: manipulation; user-select: none; -webkit-user-select: none;
                   -webkit-tap-highlight-color: transparent; }
.controls button:active { background: #dbe4ee; transform: scale(0.96); }
```

`src/main.js` — three changes:

1. Update the imports: `import { actionForKey, actionForButton } from './input.js';`
2. Delete the existing `muteBtn.addEventListener('click', toggleMute);` line and replace the whole `document.addEventListener('keydown', ...)` block with:

```js
function dispatch(action) {
  if (!action) return;
  if (action.type === 'direction') {
    state = queueDirection(state, action.direction);
    if (!started) {
      started = true;
      synth.start();
      conductor.start();
      draw();
    }
  } else if (action.type === 'pause' && started) {
    state = togglePause(state);
    if (state.status === 'paused') stopBeat();
    else if (state.status === 'playing') conductor.resume();
    draw();
  } else if (action.type === 'restart' && state.status === 'gameOver') {
    restart();
  } else if (action.type === 'mute') {
    toggleMute();
  }
}

document.addEventListener('keydown', (event) => {
  if (typeof event.key !== 'string') return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const action = actionForKey(event.key);
  if (!action) return;
  if (event.repeat && action.type !== 'direction') return;
  event.preventDefault();
  synth.unlock();
  dispatch(action);
});

// On-screen buttons: respond on pointerdown (no tap delay); a keyboard- or
// assistive-tech-generated click (detail 0) also works. Real clicks are ignored
// here because pointerdown already handled them.
function onButton(event) {
  const button = event.target.closest?.('button[data-action]');
  if (!button) return;
  event.preventDefault();
  synth.unlock();
  dispatch(actionForButton(button.dataset));
}
document.addEventListener('pointerdown', onButton);
document.addEventListener('click', (event) => {
  if (event.detail === 0) onButton(event);
});
document.addEventListener('pointerup', () => synth.unlock());
```

- [ ] **Step 4: Run to verify it passes, then commit**

Run: `node --check src/main.js && yarn test`
Expected: syntax check silent; all suites PASS.

```bash
git add src/input.js src/synth.js src/main.js index.html style.css tests/input.test.js tests/page.test.js tests/synth.test.js
git commit -m "feat: add on-screen controls that run the same actions as the keyboard so the game plays on phones"
```

---

### Task 10: Verify in the browser, sync the spec, then squash

**Files:**
- Modify: `docs/specs/snake-game/hazards.md` (enemy has no `direction` field)

- [ ] **Step 1: Serve** — `yarn start`, open http://localhost:8000. Expected: no console errors, CSP unchanged.

- [ ] **Step 2: Look at every hazard** — in the page, build a state and draw it (this also exercises the renderer on every shape): `const g = await import('/src/core/game.js'); const r = await import('/src/renderer.js');` then `r.render(ctx, state)` with a hand-made `state.hazards` containing a solid wall, a ghost wall (age 0, 4 and 8), a late wall with `fades: true` at ages 24, 44 and 64, a solid bomb, a ghost bomb, and an enemy in each of `ghost`, `alive`, `dead`. Take a screenshot of each flash phase.
  - [ ] Walls are dark squares, the bomb a dark diamond with a spark, the enemy purple with a darker head, the dead enemy grey with crosses.
  - [ ] Ghosts are dashed outlines that disappear on the hidden flash phase and stay steady with `reducedMotion: true`.
  - [ ] The fading wall's opacity drops with age and is gone by age 64.

- [ ] **Step 3: Play it for real** — drive the page with the apple-eating bot (read food from the canvas) to 16+ apples.
  - [ ] No walls before apple 16; four ghost walls appear on apple 16 and turn solid ~24 steps later, none within 5 cells of the head or in front of it.
  - [ ] Driving into a solid wall ends the game; passing through a ghost does not.
  - [ ] After a restart there are no hazards.
  - Higher tiers (bomb at 32, per-apple walls at 48, enemy at 64, re-lay at 80, fading at 100) are covered by unit tests; ask the user to play on to hear and see them, and note balance feedback as follow-ups.

- [ ] **Step 4: Touch** — use the Browser pane's mobile preset (375×812) and a 320×568 size, reload, then:
  - [ ] No horizontal or vertical page scroll (`document.documentElement.scrollWidth <= innerWidth`) and the board fits.
  - [ ] Every control is at least 48×48 px (`getBoundingClientRect`).
  - [ ] Dispatching `PointerEvent('pointerdown')` on the Right button starts the snake and the music; Up/Down/Left steer; Pause pauses and resumes; Restart works only after game over; Mute toggles `aria-pressed`.
  - [ ] Keyboard still works, and `Enter` with a button focused restarts rather than double-firing.
  - [ ] Reset the viewport to desktop afterwards.

- [ ] **Step 5: Sync the spec** — in `docs/specs/snake-game/hazards.md`, Data Model, change the enemy shape to `{cells: Cell[] (head first), age: number, status: 'ghost'|'alive'|'dead'}` (no `direction`). Commit:

```bash
git add docs/specs/snake-game/hazards.md
git commit -m "docs: match the hazards data model to the built enemy shape"
```

- [ ] **Step 6: Squash into one commit**

```bash
BASE=$(git merge-base feature/hazards-touch feature/rhythm-music)
git reset --soft "$BASE"
git commit -m "feat: add tier-gated hazards and touch controls

Obstacles arrive as the music grows: walls, a bomb, per-apple walls, an enemy
snake, re-laid walls, and walls that fade from sight at 100 apples. Every one is
telegraphed as a ghost first, kept clear of the head, and checked so the food is
always reachable. On-screen buttons run the same actions as the keyboard so the
game plays on phones."
```
Expected: `git log --oneline` shows one new commit on top of `574fa17`; `git status` is clean. Do not push; ask the user how to land it (PR route).

---

## Self-Review

**Spec coverage (hazards.md):** tier 2 four L3 walls, tier 4 bomb relocating each apple, tier 6 per-apple 2-cell wall with 80 cap, tier 8 enemy, tier 10 re-lay, 100-apple fade → Task 5 (rules), Task 4 (`wallOpacity`), Task 8 (drawing); telegraph 24 steps and ghost-stays-ghost-under-snake → Tasks 4, 6 (`isSolid`, enemy ghost→alive); flash every 4 steps and steady under reduced motion → Tasks 4, 8; safe distance, lane, retries then skip → Task 4; always a route (time-aware), food first then hazards, enemy filter → Tasks 2, 3, 4, 6, 7; collisions (solid wall/bomb, live/dead enemy; ghosts harmless) → Tasks 4, 7; enemy movement, death, stays solid, respawns as ghost → Tasks 5, 6; reset on restart → `createState` (Task 7); shapes → Task 8; no obstacle exceeds the cap → Task 5. Touch (snake-game.md): D-pad, Pause, Restart, Mute, same actions as keys, pointerdown + keyboard click, ≥48 px, scales to 320 px, no zoom/scroll, aria-labels, first tap starts audio → Task 9 and Task 10 Step 4.

**Placeholder scan:** none; every code step has full code. Task 10 steps are manual checks with explicit expectations. Seeded tests note how to handle an unlucky seed without weakening assertions.

**Type consistency:** `placeFood(snake, rng, blocked)`; `reachable/hasRoute(snake, blocked, food)`; `placeSegment/placeCell(world, …, rng)` with `world = {snake, direction, food, hazards}`; `spawnForApple(world, hazards, rng, apples)` and `stepHazards(hazards, {snake, food}, rng)` are called with exactly those shapes in `tick` (Task 7); `isSolid(obj, snake)` and `wallOpacity(wall)` are used identically by the renderer; `actionForButton` returns the same action objects `dispatch` already handles.
