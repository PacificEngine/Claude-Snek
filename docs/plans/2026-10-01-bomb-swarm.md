# Bomb Swarm and Shrinking Ghost Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new bomb every 4 apples (all bombs jump on every apple, capped at 12) and shrink the ghost time as the game goes on (24 steps → 12 after apple 60 → 6 after apple 120).

**Architecture:** Each obstacle (wall, bomb, enemy) carries its own `telegraph` (ghost time) stamped when it is placed, so solidity, flashing, fading and the enemy's go-live all read it from the object. The single `bomb` in `state.hazards` becomes a `bombs` list; `spawnForApple` re-places every bomb one at a time (keeping the old one if a new spot cannot be found) and tops the list up to a target count that grows with apples.

**Tech Stack:** Vanilla JavaScript (ES modules, no build step), HTML Canvas, Vitest (dev-only, via yarn).

**Spec:** `docs/specs/snake-game/hazards.md` (Tier 4 bullet, Telegraph section, Data Model, Testing Strategy).

## Global Constraints

- Vanilla JavaScript with ES modules, no build step, zero runtime dependencies; use `yarn` only (never npm, pnpm or bun).
- Pure core logic; all randomness injected (`rng`).
- Ghost time for a NEW obstacle, by the score after the apple that placed it (`apples`): 24 steps if `apples <= 60`, 12 if `61..120`, 6 if `apples > 120`. It applies to walls, bombs and the enemy's respawn. Each obstacle keeps the `telegraph` it was created with (objects without a `telegraph` field behave as 24, so older states and tests stay valid). A wall kept by a failed re-lay keeps its old telegraph.
- The last 4 steps of a ghost's life are steadily visible (`age >= telegraph - 4`); otherwise it flashes 4 steps visible / 4 hidden; reduced motion is always steady. With a 6-step ghost this means it never flashes off.
- Fading walls start fading when they turn solid: opacity `1 - (age - telegraph) / 40`.
- Bombs: target count is `0` below apple 32, then `min(12, 1 + floor((apples - 32) / 4))` (1 at 32, 2 at 36, … 12 at 76). On every apple every bomb is re-placed (old cell clears, new cell is a ghost); a bomb that cannot be re-placed keeps its old cell and age; a new bomb that cannot be placed is skipped and retried on the next apple. Never more than 12 bombs.
- All placement rules from the existing hazards spec still hold (safe distance, lane, not on snake/food/hazards, route to the food after every placement, 50 attempts then skip).
- The snake dies on any solid bomb. Data model: `hazards = { walls, bombs, enemy }`, `bombs: [{ cells: [cell], age, telegraph }]`.
- No `innerHTML` or `eval`; CSP unchanged.
- Work on branch `feature/bomb-swarm`; commit after each red-green cycle; commit messages explain why; no Claude signature; squash into one commit before finishing.

---

### Task 1: Per-obstacle ghost time

**Files:**
- Modify: `src/core/hazards.js`
- Modify: `src/renderer.js`
- Modify: `tests/hazards.test.js` (append)

**Interfaces:**
- Produces: `telegraphFor(apples: number): number` (24 / 12 / 6 per the constraints); every wall, bomb and enemy that `spawnForApple` creates carries `telegraph`; `isSolid(obj, snake)`, `wallOpacity(wall)` and the enemy's ghost→alive switch read `obj.telegraph ?? 24`; `isGhostVisible(age, reducedMotion = false, telegraph = 24)`. The renderer passes each obstacle's `telegraph` to `isGhostVisible`.
- The bomb is still a single `bomb` object in this task (Task 2 makes it a list).

- [ ] **Step 1: Write the failing tests** — append to `tests/hazards.test.js` (add `telegraphFor` to the hazards import list at the top; helpers `seeded`, `wall`, `snake`, and the `w` world used in the `spawnForApple` describe are described below, so define what you need locally):

```js
describe('ghost time by apple count', () => {
  it('is 24 steps up to and including apple 60', () => {
    expect(telegraphFor(0)).toBe(24);
    expect(telegraphFor(16)).toBe(24);
    expect(telegraphFor(60)).toBe(24);
  });
  it('is 12 steps from apple 61 to apple 120', () => {
    expect(telegraphFor(61)).toBe(12);
    expect(telegraphFor(120)).toBe(12);
  });
  it('is 6 steps from apple 121 on', () => {
    expect(telegraphFor(121)).toBe(6);
    expect(telegraphFor(500)).toBe(6);
  });
});

describe('each obstacle keeps its own ghost time', () => {
  const cell = [{ x: 1, y: 1 }];
  it('turns solid at its own ghost time, defaulting to 24', () => {
    expect(isSolid({ cells: cell, age: 11, telegraph: 12 }, snake)).toBe(false);
    expect(isSolid({ cells: cell, age: 12, telegraph: 12 }, snake)).toBe(true);
    expect(isSolid({ cells: cell, age: 6, telegraph: 6 }, snake)).toBe(true);
    expect(isSolid({ cells: cell, age: 23 }, snake)).toBe(false);
    expect(isSolid({ cells: cell, age: 24 }, snake)).toBe(true);
  });

  it('stays visible for the last 4 steps of any ghost time, so a 6-step ghost never flashes off', () => {
    const visible = (telegraph) => Array.from({ length: telegraph }, (_, age) => isGhostVisible(age, false, telegraph));
    expect(visible(12)).toEqual([true, true, true, true, false, false, false, false, true, true, true, true]);
    expect(visible(6).every(Boolean)).toBe(true);
    expect(visible(24).slice(20).every(Boolean)).toBe(true);
  });

  it('starts fading when a wall turns solid, using its own ghost time', () => {
    const cells = [{ x: 1, y: 1 }];
    expect(wallOpacity({ cells, age: 12, telegraph: 12, fades: true })).toBe(1);
    expect(wallOpacity({ cells, age: 32, telegraph: 12, fades: true })).toBeCloseTo(0.5);
    expect(wallOpacity({ cells, age: 52, telegraph: 12, fades: true })).toBe(0);
  });

  it('turns a ghost enemy live at its own ghost time', () => {
    const enemy = { cells: [{ x: 17, y: 18 }, { x: 17, y: 17 }, { x: 17, y: 16 }], age: 11, telegraph: 12, status: 'ghost' };
    const next = stepHazards({ walls: [], bomb: null, enemy }, { snake, food: { x: 18, y: 5 } }, seeded(1));
    expect(next.enemy.status).toBe('alive');
  });
});

describe('spawnForApple stamps the ghost time', () => {
  const world = () => ({ snake, direction: 'right', food: { x: 3, y: 3 } });
  it('stamps 24 on the tier-2 walls', () => {
    const h = spawnForApple(world(), emptyHazards(), seeded(1), 16);
    expect(h.walls.length).toBeGreaterThan(0);
    expect(h.walls.every((x) => x.telegraph === 24)).toBe(true);
  });
  it('stamps 12 after apple 60 and 6 after apple 120 on a new bomb and a new wall', () => {
    const at61 = spawnForApple(world(), emptyHazards(), seeded(2), 61);
    expect(at61.bomb.telegraph).toBe(12);
    expect(at61.walls.every((x) => x.telegraph === 12)).toBe(true);
    const at121 = spawnForApple(world(), emptyHazards(), seeded(3), 121);
    expect(at121.bomb.telegraph).toBe(6);
    expect(at121.walls.every((x) => x.telegraph === 6)).toBe(true);
  });
  it('stamps the ghost time on a respawned enemy', () => {
    const dead = { walls: [], bomb: null, enemy: { cells: [{ x: 17, y: 12 }, { x: 17, y: 11 }, { x: 17, y: 10 }], age: 9, telegraph: 24, status: 'dead' } };
    const h = spawnForApple(world(), dead, seeded(4), 125);
    expect(h.enemy.status).toBe('ghost');
    expect(h.enemy.telegraph).toBe(6);
  });
  it('lets a wall that could not be re-laid keep its old ghost time', () => {
    const old = { cells: [{ x: 15, y: 15 }, { x: 16, y: 15 }], age: 40, telegraph: 24, fades: false };
    const kept = spawnForApple(world(), { walls: [old], bomb: null, enemy: null }, (() => { let i = 0; const v = [0.5, 0.5]; return () => v[i++ % 2]; })(), 125);
    expect(kept.walls).toContainEqual(old);
  });
});
```
(The last test relies on an always-failing rng — `0.5, 0.5` lands every attempt on the snake's head — so the wall cannot be re-laid and must be kept unchanged, `telegraph: 24` included. Add `isSolid`, `isGhostVisible`, `wallOpacity`, `spawnForApple`, `stepHazards` to the import list if any are missing.)

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/hazards.test.js`
Expected: FAIL — `telegraphFor` is not exported; solidity and visibility ignore `telegraph`; spawns do not stamp it.

- [ ] **Step 3: Write the implementation** — in `src/core/hazards.js`:

Directly under `export const TELEGRAPH_STEPS = 24;` add:
```js
// Ghost time for an obstacle placed on this apple: it shrinks as the game goes on.
export const telegraphFor = (apples) => (apples > 120 ? 6 : apples > 60 ? 12 : TELEGRAPH_STEPS);
// Each obstacle keeps the ghost time it was created with (24 for older objects).
const ghostTime = (obj) => obj.telegraph ?? TELEGRAPH_STEPS;
```
Replace `isSolid`, `isGhostVisible` and `wallOpacity`:
```js
// Ghost time over and no part of the snake is on it.
export const isSolid = (obj, snake) => obj.age >= ghostTime(obj) && !overlapsSnake(obj.cells, snake);

export const isGhostVisible = (age, reducedMotion = false, telegraph = TELEGRAPH_STEPS) =>
  reducedMotion || age >= telegraph - FLASH_PERIOD || Math.floor(age / FLASH_PERIOD) % 2 === 0;

export function wallOpacity(wall) {
  const ghost = ghostTime(wall);
  if (!wall.fades || wall.age < ghost) return 1;
  return Math.max(0, 1 - (wall.age - ghost) / FADE_STEPS);
}
```
In `spawnForApple`, right after `const crossed = ...` add `const telegraph = telegraphFor(apples);` and stamp every new object:
- `addWall`: `{ cells, age: 0, telegraph, fades }`
- the bomb: `{ cells, age: 0, telegraph }`
- the tier-10 re-lay replacement: `{ cells, age: 0, telegraph, fades }` (a kept old wall stays untouched)
- the enemy: `{ cells, age: 0, telegraph, status: 'ghost' }`

In `stepEnemy`, replace `enemy.age >= TELEGRAPH_STEPS` with `enemy.age >= ghostTime(enemy)`.

In `src/renderer.js` change `drawGhost` to take the obstacle so it can read its ghost time:
```js
function drawGhost(ctx, obj, size, pad, reducedMotion, stroke = GHOST_STROKE) {
  if (!isGhostVisible(obj.age, reducedMotion, obj.telegraph)) return;
  ctx.save();
  ctx.setLineDash([size * 0.18, size * 0.12]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = GHOST_FILL;
  obj.cells.forEach((cell) => {
    square(ctx, cell, size, pad);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}
```
and update its three callers to pass the obstacle: `drawGhost(ctx, wall, size, pad, reducedMotion)`, `drawGhost(ctx, bomb, size, pad, reducedMotion)`, `drawGhost(ctx, enemy, size, pad, reducedMotion, ENEMY_COLOR)`.

- [ ] **Step 4: Run to verify it passes**

Run: `node --check src/renderer.js && yarn test`
Expected: PASS (whole suite, existing tests unchanged — objects without `telegraph` default to 24).

- [ ] **Step 5: Commit**

```bash
git add src/core/hazards.js src/renderer.js tests/hazards.test.js
git commit -m "feat: give each obstacle its own ghost time so late-game hazards can shrink it without changing earlier ones"
```

---

### Task 2: A growing swarm of bombs

**Files:**
- Modify: `src/core/hazards.js`
- Modify: `src/renderer.js`
- Modify: `tests/hazards.test.js`, `tests/game.test.js`

**Interfaces:**
- Produces: `hazards.bombs: Bomb[]` replaces `hazards.bomb` everywhere (`emptyHazards()` → `{ walls: [], bombs: [], enemy: null }`); `bombCountFor(apples): number`; `MAX_BOMBS = 12`; `spawnForApple` re-places every bomb on each apple and tops up to `bombCountFor(apples)`.

- [ ] **Step 1: Migrate the existing tests to the list shape (green-bar-neutral rename first)** — in `tests/hazards.test.js` and `tests/game.test.js` change the data shape only, no assertions about new behavior:
  - every `bomb: null` → `bombs: []`
  - every `bomb: { cells: …, age: … }` → `bombs: [{ cells: …, age: … }]`
  - `emptyHazards()` expectation → `{ walls: [], bombs: [], enemy: null }`
  - `expect(h.bomb).toBeNull()` → `expect(h.bombs).toEqual([])`
  - the bomb tier test ("places the bomb at tier 4 and moves it on every later apple"): `first.bomb` → `first.bombs[0]`, `moved.bomb` → `moved.bombs[0]`, and `{ ...first, bomb: { ...first.bomb, age: 30 } }` → `{ ...first, bombs: [{ ...first.bombs[0], age: 30 }] }`
  - "keeps the old bomb" test: `const bomb = …; { walls: [], bomb, enemy: null }` → `{ walls: [], bombs: [bomb], enemy: null }`, and `expect(kept.bomb).toEqual(bomb)` → `expect(kept.bombs).toEqual([bomb])`
  - the aging test: `next.bomb.age` → `next.bombs[0].age`
  - Task 1's new tests that read `.bomb` (`at61.bomb.telegraph`, `at121.bomb.telegraph`, and the `bomb: null` objects) get the same treatment (`.bombs[0].telegraph`, `bombs: []`).
  These tests will FAIL until Step 3 (they now describe the list shape) — that is the red state for this task; also add the new tests of Step 2 before implementing.

- [ ] **Step 2: Write the new failing tests** — append to `tests/hazards.test.js` (add `bombCountFor` and `MAX_BOMBS` to the hazards import list):

```js
describe('bombCountFor', () => {
  it('is 0 before apple 32', () => {
    expect(bombCountFor(0)).toBe(0);
    expect(bombCountFor(31)).toBe(0);
  });
  it('is 1 at apple 32 and adds one every 4th apple', () => {
    expect(bombCountFor(32)).toBe(1);
    expect(bombCountFor(35)).toBe(1);
    expect(bombCountFor(36)).toBe(2);
    expect(bombCountFor(40)).toBe(3);
    expect(bombCountFor(60)).toBe(8);
  });
  it('caps at 12, reached at apple 76', () => {
    expect(MAX_BOMBS).toBe(12);
    expect(bombCountFor(72)).toBe(11);
    expect(bombCountFor(76)).toBe(12);
    expect(bombCountFor(500)).toBe(12);
  });
});

describe('bomb swarm', () => {
  const world = () => ({ snake, direction: 'right', food: { x: 3, y: 3 } });
  // n bombs parked in the top-right, away from the snake, food and its lane
  const parked = (n, age = 30) => Array.from({ length: n }, (_, i) => ({
    cells: [{ x: 12 + (i % 8), y: 2 + Math.floor(i / 8) * 2 }], age, telegraph: 24,
  }));
  const withBombs = (bombs) => ({ walls: [], bombs, enemy: null });
  const keys = (bombs) => bombs.map((b) => `${b.cells[0].x},${b.cells[0].y}`).sort();

  it('places the first bomb on apple 32 and none before', () => {
    expect(spawnForApple(world(), emptyHazards(), seeded(1), 31).bombs).toEqual([]);
    const first = spawnForApple(world(), emptyHazards(), seeded(1), 32).bombs;
    expect(first).toHaveLength(1);
    expect(first[0].age).toBe(0);
  });

  it('adds one more bomb on every 4th apple and not in between', () => {
    expect(spawnForApple(world(), withBombs(parked(1)), seeded(2), 33).bombs).toHaveLength(1);
    expect(spawnForApple(world(), withBombs(parked(1)), seeded(2), 35).bombs).toHaveLength(1);
    expect(spawnForApple(world(), withBombs(parked(1)), seeded(2), 36).bombs).toHaveLength(2);
    expect(spawnForApple(world(), withBombs(parked(2)), seeded(2), 40).bombs).toHaveLength(3);
  });

  it('moves every bomb on every apple (fresh ghosts, new cells)', () => {
    const before = parked(3);
    const after = spawnForApple(world(), withBombs(before), seeded(3), 40).bombs;
    expect(after).toHaveLength(3);
    expect(after.every((b) => b.age === 0)).toBe(true);
    expect(keys(after)).not.toEqual(keys(before));
  });

  it('keeps a bomb that cannot be moved, and skips a new one that cannot be placed', () => {
    const before = parked(1);
    // an rng that always lands on the snake's head makes every placement fail
    let i = 0;
    const alwaysFails = () => [0.5, 0.5][i++ % 2];
    const after = spawnForApple(world(), withBombs(before), alwaysFails, 36).bombs;
    expect(after).toEqual(before); // old bomb kept (cells, age), the new second bomb skipped
  });

  it('retries a skipped bomb on the next apple', () => {
    const after = spawnForApple(world(), withBombs(parked(1)), seeded(5), 37).bombs;
    expect(after).toHaveLength(2); // target at 37 is 2
  });

  it('never has more than 12 bombs', () => {
    const after = spawnForApple(world(), withBombs(parked(12)), seeded(6), 80).bombs;
    expect(after.length).toBeLessThanOrEqual(MAX_BOMBS);
  });

  it('stamps new bombs with the current ghost time', () => {
    expect(spawnForApple(world(), emptyHazards(), seeded(7), 40).bombs.every((b) => b.telegraph === 24)).toBe(true);
    expect(spawnForApple(world(), emptyHazards(), seeded(7), 80).bombs.every((b) => b.telegraph === 12)).toBe(true);
    expect(spawnForApple(world(), emptyHazards(), seeded(7), 130).bombs.every((b) => b.telegraph === 6)).toBe(true);
  });

  it('kills the snake on any solid bomb and ignores ghost bombs', () => {
    const h = withBombs([
      { cells: [{ x: 12, y: 10 }], age: 30, telegraph: 24 },
      { cells: [{ x: 14, y: 10 }], age: 3, telegraph: 24 },
    ]);
    expect(hitsHazard(h, { x: 12, y: 10 }, snake)).toBe(true);
    expect(hitsHazard(h, { x: 14, y: 10 }, snake)).toBe(false);
  });

  it('ages every bomb each step', () => {
    const next = stepHazards(withBombs(parked(3, 4)), { snake, food: { x: 18, y: 5 } }, seeded(1));
    expect(next.bombs.map((b) => b.age)).toEqual([5, 5, 5]);
  });
});
```
(`hitsHazard`, `stepHazards`, `spawnForApple`, `emptyHazards` must be in the import list; `seeded` and `snake` already exist in the file.)

- [ ] **Step 3: Run to verify it fails**

Run: `yarn test`
Expected: FAIL — the code still uses `hazards.bomb`; `bombCountFor`/`MAX_BOMBS` are not exported.

- [ ] **Step 4: Write the implementation** — in `src/core/hazards.js`:

```js
export const MAX_BOMBS = 12;
const FIRST_BOMB_APPLE = 32;
const APPLES_PER_BOMB = 4;
// How many bombs there should be after this apple: 1 at apple 32, +1 every 4th apple, max 12.
export const bombCountFor = (apples) =>
  apples < FIRST_BOMB_APPLE
    ? 0
    : Math.min(MAX_BOMBS, 1 + Math.floor((apples - FIRST_BOMB_APPLE) / APPLES_PER_BOMB));
```
Change the data shape:
```js
export const emptyHazards = () => ({ walls: [], bombs: [], enemy: null });
```
`hazardCells`: replace the bomb line with `...h.bombs.flatMap((b) => b.cells),`.
`hitsHazard`: replace the bomb line with
```js
  if (h.bombs.some((b) => at(b.cells) && isSolid(b, snake))) return true;
```
In `spawnForApple` replace the whole `if (tier >= 4) { … }` block with:
```js
  const wanted = bombCountFor(apples);
  if (wanted > 0) {
    // Every bomb jumps on every apple, one at a time. A bomb that cannot be moved
    // keeps its old cell; a new bomb that cannot be placed is skipped (retried next apple).
    const old = h.bombs;
    const placed = [];
    for (let i = 0; i < wanted; i++) {
      const others = { ...h, bombs: [...placed, ...old.slice(i + 1)] };
      const cells = placeCell({ ...world, hazards: others }, rng);
      if (cells) placed.push({ cells, age: 0, telegraph });
      else if (old[i]) placed.push(old[i]);
    }
    h = { ...h, bombs: placed };
  }
```
`stepEnemy`: rename the destructured parameter `bomb` → `bombs` and use `blockedKeys({ walls, bombs, enemy: null })`.
`stepHazards`:
```js
  const bombs = hazards.bombs.map((b) => ({ ...b, age: b.age + 1 }));
  ...
  if (enemy) enemy = stepEnemy(enemy, { snake, food, walls, bombs }, rng);
  return { walls, bombs, enemy };
```
In `src/renderer.js` replace `drawBomb` with a version that draws every bomb:
```js
function drawBombs(ctx, state, size, pad, reducedMotion) {
  state.hazards.bombs.forEach((bomb) => {
    if (!isSolid(bomb, state.snake)) {
      drawGhost(ctx, bomb, size, pad, reducedMotion);
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
  });
}
```
and call `drawBombs(ctx, view, size, pad, reducedMotion)` instead of `drawBomb(...)`. The renderer's fallback for a missing `state.hazards` must now be `emptyHazards()` (it already imports it).

- [ ] **Step 5: Run to verify it passes, then commit**

Run: `node --check src/renderer.js && yarn test`
Expected: PASS (whole suite). If a seeded expectation (for example "moves every bomb … new cells") fails only because that seed happened to repeat a cell, change the seed in the test; do not weaken the assertion.

```bash
git add src/core/hazards.js src/renderer.js tests/hazards.test.js tests/game.test.js
git commit -m "feat: grow a swarm of bombs that all jump on every apple so the late game closes in"
```

---

### Task 3: Verify, then squash

**Files:** none (verification, then history).

- [ ] **Step 1: Re-run the headless simulation** (the bot harness from the earlier hazards work: bot plays the real `createState`/`tick` over many seeded games). Update it for the list shape (`h.bombs`), then run 200 games and require zero invariant violations. Add checks: bombs ≤ 12; the bomb count never exceeds `bombCountFor(apples)`; every obstacle created at apples `> 60` has `telegraph <= 12` and at `> 120` has `telegraph === 6`; no hazard before its tier; wall cap 80; food never on a hazard; new ghosts never within 5 cells of the head; hazards never wall the food off from the head.
- [ ] **Step 2: Look at it in a browser** — render a hand-made state with 12 bombs (a mix of solid and ghosts at different ages, including a 12-step and 6-step ghost) and take a screenshot; confirm the diamonds are distinguishable from the food circle, ghost bombs flash, and a 6-step ghost bomb stays steady. Play the real game briefly to confirm nothing errors in the console.
- [ ] **Step 3: Squash into one commit**

```bash
BASE=$(git merge-base feature/bomb-swarm feature/hazards-touch)
git reset --soft "$BASE"
git commit -m "feat: add a growing swarm of bombs and shrink ghost time late in the game

A new bomb joins every 4 apples from apple 32 (up to 12) and every bomb jumps
on every apple. Obstacles now carry their own ghost time: 24 steps, 12 after
apple 60 and 6 after apple 120, so late-game hazards give less warning while
earlier ones keep the time they were created with."
```
Expected: one new commit on top of `7057fc2`; `git status` clean. Do not push; ask the user how to land it.

---

## Self-Review

**Spec coverage:** bomb added every 4th apple from 32, cap 12, reached at 76 → Task 2 (`bombCountFor`, `MAX_BOMBS`, tests); all bombs jump on every apple, old cell clears, new cell is a ghost, un-movable bomb stays, un-placeable new bomb skipped and retried → Task 2 (placement loop and tests); ghost time 24 / 12 (apples 61–120) / 6 (121+) for walls, bombs and enemy respawn, each obstacle keeps its own, kept walls keep theirs → Task 1 (`telegraphFor`, stamping, `ghostTime`); fade start uses the wall's own ghost time → Task 1; last-4-steps-steady rule and the never-flashing 6-step ghost → Task 1 test; data model `bombs` with `telegraph` → Tasks 1–2; route/safe-distance rules apply to every bomb → reuse of `placeCell` (Task 2); renderer draws all bombs and uses each ghost time → Tasks 1–2; verification of invariants and visuals → Task 3.

**Placeholder scan:** none; every code step contains the code to write. Task 2 Step 1 is a mechanical rename with every affected assertion listed.

**Type consistency:** `telegraph` is a number on walls, bombs and the enemy and is read only through `ghostTime(obj)` (core) or `obj.telegraph` (renderer, defaulting in `isGhostVisible`); `hazards.bombs` is an array everywhere after Task 2 (`emptyHazards`, `hazardCells`, `hitsHazard`, `stepHazards`, `stepEnemy`, `spawnForApple`, renderer, tests); `spawnForApple(world, hazards, rng, apples)` and `stepHazards(hazards, { snake, food }, rng)` keep their signatures.
