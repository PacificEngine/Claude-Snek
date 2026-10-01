# Snake Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based Snake game with synthesized chiptune music whose tempo rises as the snake grows.

**Architecture:** A pure game core (`tick(state, rng) → state`) with no DOM or audio access, surrounded by thin adapters (renderer, input, audio, storage) wired together by `main.js` on a `setTimeout` loop. Pacing (tick rate and music BPM) is a pure function of snake length.

**Tech Stack:** Vanilla JavaScript (ES modules, no build step), HTML Canvas, Web Audio, Vitest (dev-only, via yarn).

**Spec:** `docs/specs/snake-game/snake-game.md` (costs: `docs/specs/snake-game/snake-game-costs.md`)

## Global Constraints

- Vanilla JavaScript with ES modules, no build step, zero runtime dependencies.
- Vitest is a dev-only dependency; use `yarn` only (never npm, yarn or bun).
- Grid is 20×20; snake starts at length 3, heading right.
- Controls: arrow keys or WASD to turn, `P` pause, `Enter` restart, `M` mute.
- A 180° reversal is ignored; at most 2 queued directions per tick.
- Pacing: 8 ticks/sec +0.5 per food, max 20. Music: 100 BPM +4 per food, max 200.
- No backend, no network requests, no external audio files, no touch controls.
- No `innerHTML` or `eval`. The page has a restrictive Content-Security-Policy.
- Music starts only after the first user interaction; if Web Audio is missing the game runs silently.
- High score is validated as a finite non-negative integer on read; if localStorage is unavailable the game continues.
- `console.error` only for unexpected failures. No analytics.
- Food differs from the snake by shape (circle vs. rounded square), not color alone. No animations in v1 (satisfies `prefers-reduced-motion`).
- Work on branch `feature/snake-game`; commit after each red-green cycle; squash into one commit before finishing; commit messages explain why; no Claude signature.

---

### Task 1: Project scaffold and branch

**Files:**
- Create: `package.json`, `.gitignore`

**Interfaces:**
- Produces: `yarn test` (runs Vitest once), `yarn start` (serves the folder on http://localhost:8000).

- [ ] **Step 1: Initialize git and the branch**

```bash
cd /Users/joe.salomone/Workspace/claude-demo
git init
git checkout -b feature/snake-game
```

- [ ] **Step 2: Create package.json and install Vitest**

```bash
yarn init -y
yarn add -D vitest
```

Then edit `package.json` by hand (Yarn 1 has no `pkg set`) so it contains:

```json
"type": "module",
"private": true,
"scripts": {
  "test": "vitest run --passWithNoTests",
  "start": "python3 -m http.server 8000"
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
```

- [ ] **Step 4: Verify the toolchain**

Run: `yarn test`
Expected: exits 0 with "No test files found".

- [ ] **Step 5: Commit**

```bash
git add package.json yarn.lock .gitignore .claude docs
git commit -m "chore: scaffold project with yarn and vitest so TDD can start"
```

---

### Task 2: Pacing (tick rate and BPM)

**Files:**
- Create: `src/core/config.js`, `src/core/pacing.js`
- Test: `tests/pacing.test.js`

**Interfaces:**
- Produces: `config.js` exports `GRID_SIZE = 20`, `START_LENGTH = 3`. `pacing.js` exports `ticksPerSecond(length: number): number` and `bpm(length: number): number`.

- [ ] **Step 1: Write the failing test** (`tests/pacing.test.js`)

```js
import { describe, it, expect } from 'vitest';
import { ticksPerSecond, bpm } from '../src/core/pacing.js';

describe('ticksPerSecond', () => {
  it('starts at 8 for the starting length', () => {
    expect(ticksPerSecond(3)).toBe(8);
  });
  it('adds 0.5 per food eaten', () => {
    expect(ticksPerSecond(4)).toBe(8.5);
    expect(ticksPerSecond(5)).toBe(9);
  });
  it('caps at 20', () => {
    expect(ticksPerSecond(100)).toBe(20);
  });
});

describe('bpm', () => {
  it('starts at 100 for the starting length', () => {
    expect(bpm(3)).toBe(100);
  });
  it('adds 4 per food eaten', () => {
    expect(bpm(4)).toBe(104);
  });
  it('caps at 200', () => {
    expect(bpm(100)).toBe(200);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/pacing.test.js`
Expected: FAIL — cannot find `../src/core/pacing.js`.

- [ ] **Step 3: Write minimal implementation**

`src/core/config.js`:
```js
export const GRID_SIZE = 20;
export const START_LENGTH = 3;
```

`src/core/pacing.js`:
```js
import { START_LENGTH } from './config.js';

const BASE_TICKS_PER_SEC = 8;
const TICKS_PER_FOOD = 0.5;
const MAX_TICKS_PER_SEC = 20;
const BASE_BPM = 100;
const BPM_PER_FOOD = 4;
const MAX_BPM = 200;

const foodEaten = (length) => Math.max(0, length - START_LENGTH);

export const ticksPerSecond = (length) =>
  Math.min(MAX_TICKS_PER_SEC, BASE_TICKS_PER_SEC + foodEaten(length) * TICKS_PER_FOOD);

export const bpm = (length) =>
  Math.min(MAX_BPM, BASE_BPM + foodEaten(length) * BPM_PER_FOOD);
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test tests/pacing.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: derive tick rate and music tempo from snake length so difficulty and music escalate together"
```

---

### Task 3: Game core — state, food placement, movement, direction queue

**Files:**
- Create: `src/core/game.js`
- Test: `tests/game.test.js`

**Interfaces:**
- Consumes: `GRID_SIZE`, `START_LENGTH` from `config.js`.
- Produces (all from `game.js`):
  - `createState(rng: () => number): State`
  - `placeFood(snake: Cell[], rng): Cell | null`
  - `queueDirection(state, dir: 'up'|'down'|'left'|'right'): State`
  - `tick(state, rng): State`
  - Types: `Cell = {x, y}`; `State = {snake: Cell[] (head first), direction, queued: string[], food: Cell|null, score: number, status: 'playing'|'paused'|'gameOver'}`

- [ ] **Step 1: Write the failing tests** (`tests/game.test.js`)

```js
import { describe, it, expect } from 'vitest';
import { createState, placeFood, queueDirection, tick } from '../src/core/game.js';
import { GRID_SIZE, START_LENGTH } from '../src/core/config.js';

const rng = () => 0;

export const stateWith = (overrides = {}) => ({
  snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }],
  direction: 'right',
  queued: [],
  food: { x: 15, y: 15 },
  score: 0,
  status: 'playing',
  ...overrides,
});

describe('createState', () => {
  it('starts centered, length 3, heading right, playing, score 0', () => {
    const s = createState(rng);
    expect(s.snake).toHaveLength(START_LENGTH);
    expect(s.snake[0]).toEqual({ x: GRID_SIZE / 2, y: GRID_SIZE / 2 });
    expect(s.direction).toBe('right');
    expect(s.status).toBe('playing');
    expect(s.score).toBe(0);
  });
  it('places food off the snake', () => {
    const s = createState(rng);
    expect(s.snake).not.toContainEqual(s.food);
  });
});

describe('tick movement', () => {
  it('moves the snake one cell in its direction, keeping length', () => {
    const s = tick(stateWith(), rng);
    expect(s.snake).toEqual([{ x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }]);
  });
  it('applies a queued turn', () => {
    const s = tick(stateWith({ queued: ['down'] }), rng);
    expect(s.snake[0]).toEqual({ x: 5, y: 6 });
    expect(s.direction).toBe('down');
    expect(s.queued).toEqual([]);
  });
});

describe('queueDirection', () => {
  it('ignores a 180 degree reversal', () => {
    const s = stateWith();
    expect(queueDirection(s, 'left')).toBe(s);
  });
  it('ignores a repeat of the current direction', () => {
    const s = stateWith();
    expect(queueDirection(s, 'right')).toBe(s);
  });
  it('checks reversal against the last queued direction, not the current one', () => {
    const s = queueDirection(stateWith(), 'down');
    expect(queueDirection(s, 'up')).toBe(s);
  });
  it('keeps two quick turns in order', () => {
    const s = queueDirection(queueDirection(stateWith(), 'down'), 'left');
    expect(s.queued).toEqual(['down', 'left']);
  });
  it('holds at most two queued directions', () => {
    const s = queueDirection(queueDirection(stateWith(), 'down'), 'left');
    expect(queueDirection(s, 'up')).toBe(s);
  });
});

describe('placeFood', () => {
  it('returns the only free cell', () => {
    const snake = [];
    for (let y = 0; y < GRID_SIZE; y++)
      for (let x = 0; x < GRID_SIZE; x++)
        if (!(x === 3 && y === 4)) snake.push({ x, y });
    expect(placeFood(snake, () => 0.9)).toEqual({ x: 3, y: 4 });
  });
  it('returns null when the grid is full', () => {
    const snake = [];
    for (let y = 0; y < GRID_SIZE; y++)
      for (let x = 0; x < GRID_SIZE; x++) snake.push({ x, y });
    expect(placeFood(snake, rng)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/game.test.js`
Expected: FAIL — cannot find `../src/core/game.js`.

- [ ] **Step 3: Write minimal implementation** (`src/core/game.js`)

```js
import { GRID_SIZE, START_LENGTH } from './config.js';

const VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const MAX_QUEUED = 2;

export function placeFood(snake, rng) {
  const occupied = new Set(snake.map((c) => `${c.x},${c.y}`));
  const free = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(rng() * free.length)];
}

export function createState(rng) {
  const mid = Math.floor(GRID_SIZE / 2);
  const snake = Array.from({ length: START_LENGTH }, (_, i) => ({ x: mid - i, y: mid }));
  return {
    snake,
    direction: 'right',
    queued: [],
    food: placeFood(snake, rng),
    score: 0,
    status: 'playing',
  };
}

export function queueDirection(state, dir) {
  const last = state.queued.at(-1) ?? state.direction;
  if (dir === last || dir === OPPOSITE[last]) return state;
  if (state.queued.length >= MAX_QUEUED) return state;
  return { ...state, queued: [...state.queued, dir] };
}

export function tick(state, rng) {
  if (state.status !== 'playing') return state;
  const [next, ...queued] = state.queued;
  const direction = next ?? state.direction;
  const v = VECTORS[direction];
  const head = state.snake[0];
  const newHead = { x: head.x + v.x, y: head.y + v.y };
  const snake = [newHead, ...state.snake.slice(0, -1)];
  return { ...state, snake, direction, queued };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test tests/game.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: add pure game core with movement and a direction queue so quick double-turns are not lost"
```

---

### Task 4: Collisions (wall, self, tail-follow)

**Files:**
- Modify: `src/core/game.js` (`tick`)
- Modify: `tests/game.test.js` (append)

**Interfaces:**
- Consumes: `tick`, `stateWith` helper from Task 3.
- Produces: `tick` sets `status: 'gameOver'` on wall or self collision and returns the same state object once not `playing`.

- [ ] **Step 1: Write the failing tests** (append to `tests/game.test.js`)

```js
describe('tick collisions', () => {
  it('ends the game when the head hits the right wall', () => {
    const s = stateWith({
      snake: [{ x: GRID_SIZE - 1, y: 5 }, { x: GRID_SIZE - 2, y: 5 }, { x: GRID_SIZE - 3, y: 5 }],
    });
    expect(tick(s, rng).status).toBe('gameOver');
  });
  it('ends the game when the head hits the top wall', () => {
    const s = stateWith({
      snake: [{ x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 2 }],
      direction: 'up',
    });
    expect(tick(s, rng).status).toBe('gameOver');
  });
  it('ends the game when the head hits its own body', () => {
    const s = stateWith({
      snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 4 }],
      direction: 'up',
      queued: ['left'],
    });
    expect(tick(s, rng).status).toBe('gameOver');
  });
  it('allows the head to move into the cell the tail is leaving', () => {
    const s = stateWith({
      snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }],
      direction: 'up',
      queued: ['left'],
    });
    expect(tick(s, rng).status).toBe('playing');
  });
  it('does nothing once the game is over', () => {
    const s = stateWith({ status: 'gameOver' });
    expect(tick(s, rng)).toBe(s);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/game.test.js`
Expected: FAIL — wall and self-collision tests report `playing`.

- [ ] **Step 3: Replace `tick` in `src/core/game.js`**

```js
const isOutOfBounds = ({ x, y }) => x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE;
const sameCell = (a, b) => a.x === b.x && a.y === b.y;

export function tick(state, rng) {
  if (state.status !== 'playing') return state;
  const [next, ...queued] = state.queued;
  const direction = next ?? state.direction;
  const v = VECTORS[direction];
  const head = state.snake[0];
  const newHead = { x: head.x + v.x, y: head.y + v.y };
  const bodyAfterMove = state.snake.slice(0, -1);
  if (isOutOfBounds(newHead) || bodyAfterMove.some((c) => sameCell(c, newHead))) {
    return { ...state, direction, queued, status: 'gameOver' };
  }
  return { ...state, snake: [newHead, ...bodyAfterMove], direction, queued };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test tests/game.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: end the game on wall or self collision, allowing tail-follow like classic snake"
```

---

### Task 5: Eating, growth, scoring, and pause

**Files:**
- Modify: `src/core/game.js` (`tick`, add `togglePause`)
- Modify: `tests/game.test.js` (append)

**Interfaces:**
- Consumes: `tick`, `placeFood`, `stateWith`.
- Produces: `togglePause(state): State` — `playing ↔ paused`; `gameOver` is unchanged. `tick` grows the snake by one, adds 1 to `score` and respawns food when the new head is on the food; if the grid is then full (`food` would be `null`) the status becomes `gameOver`.

- [ ] **Step 1: Write the failing tests** (append; add `togglePause` to the import list)

```js
describe('tick eating', () => {
  const eating = () =>
    stateWith({
      snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }],
      food: { x: 6, y: 5 },
    });

  it('grows the snake by one and scores a point', () => {
    const s = tick(eating(), rng);
    expect(s.snake).toHaveLength(4);
    expect(s.snake[0]).toEqual({ x: 6, y: 5 });
    expect(s.score).toBe(1);
    expect(s.status).toBe('playing');
  });
  it('respawns food on a free cell', () => {
    const s = tick(eating(), rng);
    expect(s.snake).not.toContainEqual(s.food);
    expect(s.food).toEqual({ x: 0, y: 0 });
  });
  it('does not grow or score when not eating', () => {
    const s = tick(stateWith(), rng);
    expect(s.snake).toHaveLength(3);
    expect(s.score).toBe(0);
  });
});

describe('togglePause', () => {
  it('pauses a playing game and resumes a paused one', () => {
    const paused = togglePause(stateWith());
    expect(paused.status).toBe('paused');
    expect(togglePause(paused).status).toBe('playing');
  });
  it('leaves a finished game alone', () => {
    const s = stateWith({ status: 'gameOver' });
    expect(togglePause(s)).toBe(s);
  });
  it('does not advance while paused', () => {
    const s = stateWith({ status: 'paused' });
    expect(tick(s, rng)).toBe(s);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/game.test.js`
Expected: FAIL — snake does not grow; `togglePause` is not exported.

- [ ] **Step 3: Replace `tick` and add `togglePause` in `src/core/game.js`**

```js
export function togglePause(state) {
  if (state.status === 'playing') return { ...state, status: 'paused' };
  if (state.status === 'paused') return { ...state, status: 'playing' };
  return state;
}

export function tick(state, rng) {
  if (state.status !== 'playing') return state;
  const [next, ...queued] = state.queued;
  const direction = next ?? state.direction;
  const v = VECTORS[direction];
  const head = state.snake[0];
  const newHead = { x: head.x + v.x, y: head.y + v.y };
  const eating = state.food !== null && sameCell(newHead, state.food);
  const bodyAfterMove = eating ? state.snake : state.snake.slice(0, -1);
  if (isOutOfBounds(newHead) || bodyAfterMove.some((c) => sameCell(c, newHead))) {
    return { ...state, direction, queued, status: 'gameOver' };
  }
  const snake = [newHead, ...bodyAfterMove];
  if (!eating) return { ...state, snake, direction, queued };
  const food = placeFood(snake, rng);
  return {
    ...state,
    snake,
    direction,
    queued,
    food,
    score: state.score + 1,
    status: food === null ? 'gameOver' : 'playing',
  };
}
```

Note: when eating, the tail is kept, so moving into the tail cell correctly counts as a self-collision.

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test`
Expected: PASS (all core and pacing tests).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: add eating, growth, scoring and pause to complete the game rules"
```

---

### Task 6: High-score storage

**Files:**
- Create: `src/storage.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Produces: `loadHighScore(storage = globalThis.localStorage): number` (returns 0 for anything invalid or unavailable) and `saveHighScore(score: number, storage = globalThis.localStorage): void`.

- [ ] **Step 1: Write the failing tests** (`tests/storage.test.js`)

```js
import { describe, it, expect, vi } from 'vitest';
import { loadHighScore, saveHighScore } from '../src/storage.js';

const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
};

describe('loadHighScore', () => {
  it('returns 0 when nothing is stored', () => {
    expect(loadHighScore(fakeStorage())).toBe(0);
  });
  it('returns the stored integer', () => {
    expect(loadHighScore(fakeStorage({ 'snake.highScore': '12' }))).toBe(12);
  });
  it.each(['abc', '-5', 'NaN', '1e999', '1.5', ''])('rejects tampered value %j', (bad) => {
    expect(loadHighScore(fakeStorage({ 'snake.highScore': bad }))).toBe(0);
  });
  it('returns 0 and logs when storage throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { getItem() { throw new Error('denied'); } };
    expect(loadHighScore(broken)).toBe(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
  it('returns 0 when storage is unavailable', () => {
    expect(loadHighScore(undefined)).toBe(0);
  });
});

describe('saveHighScore', () => {
  it('stores the score', () => {
    const s = fakeStorage();
    saveHighScore(7, s);
    expect(s.data['snake.highScore']).toBe('7');
  });
  it('swallows and logs storage errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { setItem() { throw new Error('full'); } };
    expect(() => saveHighScore(7, broken)).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/storage.test.js`
Expected: FAIL — cannot find `../src/storage.js`.

- [ ] **Step 3: Write minimal implementation** (`src/storage.js`)

```js
const KEY = 'snake.highScore';

export function loadHighScore(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    if (raw === null || raw === undefined || raw === '') return 0;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch (err) {
    console.error('Could not read high score', err);
    return 0;
  }
}

export function saveHighScore(score, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, String(score));
  } catch (err) {
    console.error('Could not save high score', err);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test tests/storage.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: persist a validated high score so tampered or blocked storage cannot break the game"
```

---

### Task 7: Input mapping

**Files:**
- Create: `src/input.js`
- Test: `tests/input.test.js`

**Interfaces:**
- Produces: `actionForKey(key: string): Action | null` where `Action = {type: 'direction', direction} | {type: 'pause'} | {type: 'restart'} | {type: 'mute'}`. `key` is a `KeyboardEvent.key` value; letters are case-insensitive.

- [ ] **Step 1: Write the failing tests** (`tests/input.test.js`)

```js
import { describe, it, expect } from 'vitest';
import { actionForKey } from '../src/input.js';

describe('actionForKey', () => {
  it.each([
    ['ArrowUp', 'up'], ['ArrowDown', 'down'], ['ArrowLeft', 'left'], ['ArrowRight', 'right'],
    ['w', 'up'], ['a', 'left'], ['s', 'down'], ['d', 'right'], ['W', 'up'],
  ])('maps %s to direction %s', (key, direction) => {
    expect(actionForKey(key)).toEqual({ type: 'direction', direction });
  });
  it('maps P to pause, Enter to restart, M to mute', () => {
    expect(actionForKey('p')).toEqual({ type: 'pause' });
    expect(actionForKey('Enter')).toEqual({ type: 'restart' });
    expect(actionForKey('M')).toEqual({ type: 'mute' });
  });
  it('returns null for unmapped keys', () => {
    expect(actionForKey('x')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/input.test.js`
Expected: FAIL — cannot find `../src/input.js`.

- [ ] **Step 3: Write minimal implementation** (`src/input.js`)

```js
const DIRECTIONS = {
  arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};

export function actionForKey(key) {
  const k = key.toLowerCase();
  if (k in DIRECTIONS) return { type: 'direction', direction: DIRECTIONS[k] };
  if (k === 'p') return { type: 'pause' };
  if (k === 'enter') return { type: 'restart' };
  if (k === 'm') return { type: 'mute' };
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test tests/input.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: map keys to game actions in a pure function so input stays testable"
```

---

### Task 8: Audio — synthesized music with rising tempo

**Files:**
- Create: `src/audio.js`
- Test: `tests/audio.test.js`

**Interfaces:**
- Produces: `createMusic(AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext): Music` where `Music = { start(): void, setBpm(bpm: number): void, setMuted(muted: boolean): void, isMuted(): boolean }`. `start()` must be called from a user-gesture handler; it is idempotent. If the constructor is missing or throws, every method is a safe no-op (silent game). Notes are eighth notes: spacing = `60 / bpm / 2` seconds, scheduled 0.1 s ahead on a 25 ms timer.

- [ ] **Step 1: Write the failing tests** (`tests/audio.test.js`)

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMusic } from '../src/audio.js';

function makeFakeContextClass() {
  const starts = [];
  const gains = [];
  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = {};
      FakeAudioContext.instance = this;
    }
    resume() { return Promise.resolve(); }
    createGain() {
      const g = { gain: { value: 1 }, connect() {} };
      gains.push(g);
      return g;
    }
    createOscillator() {
      return {
        type: '',
        frequency: { value: 0 },
        connect() {},
        start: (t) => starts.push(t),
        stop() {},
      };
    }
  }
  return { FakeAudioContext, starts, gains };
}

describe('createMusic', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is a silent no-op when Web Audio is unavailable', () => {
    const music = createMusic(undefined);
    expect(() => { music.start(); music.setBpm(150); music.setMuted(true); }).not.toThrow();
  });

  it('is a silent no-op when the constructor throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = class { constructor() { throw new Error('blocked'); } };
    const music = createMusic(Boom);
    expect(() => music.start()).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('schedules eighth notes at the starting 100 BPM', () => {
    const { FakeAudioContext, starts } = makeFakeContextClass();
    const music = createMusic(FakeAudioContext);
    music.start();
    FakeAudioContext.instance.currentTime = 1;
    vi.advanceTimersByTime(25);
    expect(starts[1] - starts[0]).toBeCloseTo(0.3);
  });

  it('spaces notes closer together after the BPM rises', () => {
    const { FakeAudioContext, starts } = makeFakeContextClass();
    const music = createMusic(FakeAudioContext);
    music.start();
    music.setBpm(200);
    FakeAudioContext.instance.currentTime = 5;
    vi.advanceTimersByTime(25);
    const gaps = starts.slice(1).map((t, i) => t - starts[i]).slice(1);
    expect(Math.min(...gaps)).toBeCloseTo(0.15);
  });

  it('does not double-schedule when start is called twice', () => {
    const { FakeAudioContext, starts } = makeFakeContextClass();
    const music = createMusic(FakeAudioContext);
    music.start();
    const afterFirst = starts.length;
    music.start();
    expect(starts.length).toBe(afterFirst);
  });

  it('mutes by setting master gain to 0 and restores it', () => {
    const { FakeAudioContext, gains } = makeFakeContextClass();
    const music = createMusic(FakeAudioContext);
    music.start();
    const master = gains[0];
    music.setMuted(true);
    expect(master.gain.value).toBe(0);
    expect(music.isMuted()).toBe(true);
    music.setMuted(false);
    expect(master.gain.value).toBeGreaterThan(0);
  });
});
```

Note on the spacing assertions: at 100 BPM an eighth note is `60/100/2 = 0.3 s`; at 200 BPM it is `0.15 s`. The first gap after `setBpm(200)` still reflects the old 0.3 s interval, and the melody's rest step produces one doubled gap per loop (rests schedule no oscillator). So the tempo test skips the first gap and asserts the *smallest* gap is 0.15 s.

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test tests/audio.test.js`
Expected: FAIL — cannot find `../src/audio.js`.

- [ ] **Step 3: Write minimal implementation** (`src/audio.js`)

```js
// A-minor pentatonic loop as MIDI note numbers (0 = rest).
const MELODY = [69, 72, 76, 72, 69, 67, 64, 67, 69, 72, 76, 79, 76, 72, 69, 0];
const LOOKAHEAD_SECONDS = 0.1;
const TIMER_MS = 25;
const MASTER_VOLUME = 0.15;
const INITIAL_BPM = 100;

const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);

const silent = {
  start() {},
  setBpm() {},
  setMuted() {},
  isMuted: () => false,
};

export function createMusic(
  AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext,
) {
  if (!AudioContextCtor) return silent;

  let ctx = null;
  let master = null;
  let timer = null;
  let bpm = INITIAL_BPM;
  let muted = false;
  let noteIndex = 0;
  let nextNoteTime = 0;

  function playNote(midi, time, duration) {
    if (midi === 0) return;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = midiToHz(midi);
    osc.connect(master);
    osc.start(time);
    osc.stop(time + duration * 0.9);
  }

  function schedule() {
    const eighth = 60 / bpm / 2;
    while (nextNoteTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      playNote(MELODY[noteIndex], nextNoteTime, eighth);
      noteIndex = (noteIndex + 1) % MELODY.length;
      nextNoteTime += eighth;
    }
  }

  return {
    start() {
      if (timer !== null) return;
      try {
        ctx = new AudioContextCtor();
        ctx.resume();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : MASTER_VOLUME;
        master.connect(ctx.destination);
        nextNoteTime = ctx.currentTime;
        schedule();
        timer = setInterval(schedule, TIMER_MS);
      } catch (err) {
        console.error('Audio unavailable, continuing silently', err);
        ctx = null;
      }
    },
    setBpm(next) {
      bpm = next;
    },
    setMuted(next) {
      muted = next;
      if (master) master.gain.value = muted ? 0 : MASTER_VOLUME;
    },
    isMuted: () => muted,
  };
}
```

Known limitation: if `start()` fails once, `timer` stays `null`, so a later call retries — acceptable because it is only triggered by a user keypress.

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test`
Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: synthesize looping chiptune music whose tempo follows snake length, silent when Web Audio is missing"
```

---

### Task 9: Page, renderer and main loop (manually verified)

**Files:**
- Create: `index.html`, `style.css`, `src/renderer.js`, `src/main.js`

**Interfaces:**
- Consumes: `createState`, `queueDirection`, `tick`, `togglePause` (game.js); `ticksPerSecond`, `bpm` (pacing.js); `loadHighScore`, `saveHighScore`; `actionForKey`; `createMusic`; `GRID_SIZE`.
- Produces: `render(ctx, state): void` from `renderer.js`.

Rendering and sound are manual-only per the spec, so this task is verified in the browser, not by unit tests.

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'">
  <title>Snake</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main>
    <header>
      <span>Score: <strong id="score">0</strong></span>
      <span>Best: <strong id="best">0</strong></span>
      <button id="mute" type="button" aria-pressed="false">Mute (M)</button>
    </header>
    <canvas id="board" width="400" height="400" aria-label="Snake game board"></canvas>
    <p id="message" role="status">Press an arrow key or WASD to start</p>
    <p class="help">P pause · Enter restart · M mute</p>
  </main>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `style.css`**

```css
:root { --bg: #f4f6f8; --board: #ffffff; --ink: #1f2933; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center;
       background: var(--bg); color: var(--ink); font-family: system-ui, sans-serif; }
main { text-align: center; }
header { display: flex; gap: 1.5rem; justify-content: center; align-items: center;
         margin-bottom: 0.75rem; font-size: 1.1rem; }
canvas { background: var(--board); border-radius: 12px; box-shadow: 0 4px 16px rgb(0 0 0 / 12%); }
button { font: inherit; padding: 0.25rem 0.75rem; border-radius: 8px; border: 1px solid #9aa5b1;
         background: #fff; color: var(--ink); cursor: pointer; }
#message { min-height: 1.5rem; font-weight: 600; }
.help { color: #52606d; font-size: 0.9rem; }
```

- [ ] **Step 3: Create `src/renderer.js`**

```js
import { GRID_SIZE } from './core/config.js';

const SNAKE_COLOR = '#1f7a5c';
const HEAD_COLOR = '#14573f';
const FOOD_COLOR = '#c2410c';
const GRID_COLOR = '#eef1f4';

export function render(ctx, state) {
  const size = ctx.canvas.width / GRID_SIZE;
  const pad = size * 0.08;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * size, 0); ctx.lineTo(i * size, ctx.canvas.height);
    ctx.moveTo(0, i * size); ctx.lineTo(ctx.canvas.width, i * size);
    ctx.stroke();
  }

  state.snake.forEach((cell, i) => {
    ctx.fillStyle = i === 0 ? HEAD_COLOR : SNAKE_COLOR;
    ctx.beginPath();
    ctx.roundRect(cell.x * size + pad, cell.y * size + pad, size - pad * 2, size - pad * 2, size * 0.25);
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

- [ ] **Step 4: Create `src/main.js`**

```js
import { createState, queueDirection, tick, togglePause } from './core/game.js';
import { ticksPerSecond, bpm } from './core/pacing.js';
import { loadHighScore, saveHighScore } from './storage.js';
import { actionForKey } from './input.js';
import { createMusic } from './audio.js';
import { render } from './renderer.js';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const messageEl = document.getElementById('message');
const muteBtn = document.getElementById('mute');

const music = createMusic();
let best = loadHighScore();
let state = createState(Math.random);
let started = false;
let timer = null;

function updateHud() {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(best);
  muteBtn.setAttribute('aria-pressed', String(music.isMuted()));
  if (state.status === 'gameOver') messageEl.textContent = 'Game over — press Enter to restart';
  else if (state.status === 'paused') messageEl.textContent = 'Paused — press P to resume';
  else messageEl.textContent = started ? '' : 'Press an arrow key or WASD to start';
}

function draw() {
  render(ctx, state);
  updateHud();
}

function scheduleNext() {
  clearTimeout(timer);
  if (state.status !== 'playing') return;
  timer = setTimeout(step, 1000 / ticksPerSecond(state.snake.length));
}

function step() {
  state = tick(state, Math.random);
  music.setBpm(bpm(state.snake.length));
  if (state.score > best) {
    best = state.score;
    saveHighScore(best);
  }
  draw();
  scheduleNext();
}

function restart() {
  state = createState(Math.random);
  started = false;
  music.setBpm(bpm(state.snake.length));
  clearTimeout(timer);
  draw();
}

function toggleMute() {
  music.setMuted(!music.isMuted());
  updateHud();
}

document.addEventListener('keydown', (event) => {
  const action = actionForKey(event.key);
  if (!action) return;
  event.preventDefault();
  music.start();

  if (action.type === 'direction') {
    state = queueDirection(state, action.direction);
    if (!started) {
      started = true;
      draw();
      scheduleNext();
    }
  } else if (action.type === 'pause' && started) {
    state = togglePause(state);
    draw();
    scheduleNext();
  } else if (action.type === 'restart' && state.status === 'gameOver') {
    restart();
  } else if (action.type === 'mute') {
    toggleMute();
  }
});

muteBtn.addEventListener('click', toggleMute);

draw();
```

- [ ] **Step 5: Smoke-run the unit suite**

Run: `yarn test`
Expected: PASS — all earlier suites still green.

- [ ] **Step 6: Commit**

```bash
git add index.html style.css src
git commit -m "feat: wire the core to a canvas page, keyboard input and music so the game is playable"
```

---

### Task 10: Manual verification, security scan, spec update, squash

**Files:**
- Modify: `docs/specs/snake-game/snake-game.md` (resolve Open Questions; note static-server requirement)

- [ ] **Step 1: Run the game**

```bash
yarn start
```
Open http://localhost:8000 and check each item; report failures instead of assuming:

- [ ] Snake sits still until the first arrow/WASD key; music begins on that key.
- [ ] Arrow keys and WASD both turn; pressing the opposite direction does nothing.
- [ ] Eating the orange circle grows the snake and raises the score.
- [ ] Hitting a wall or the snake's own body shows "Game over"; `Enter` restarts.
- [ ] Game speed and music tempo both audibly increase as the snake grows.
- [ ] `P` pauses and resumes; `M` and the button mute and unmute.
- [ ] Best score survives a page reload.
- [ ] Browser console shows no CSP violations or errors.

- [ ] **Step 2: Run the Snyk code scan** on the new first-party code (`src/`, `index.html`) using the `snyk_code_scan` tool; fix any findings and rescan until clean.

- [ ] **Step 3: Update the spec** — in `docs/specs/snake-game/snake-game.md`:
  - Replace the Open Questions section with the decisions: start 8 ticks/sec, +0.5 per food, max 20; music 100 BPM, +4 per food, max 200, A-minor pentatonic square-wave loop; `P` pause, `Enter` restart, `M` mute; debug overlay deferred.
  - In Technical Constraints, replace "opens straight from `index.html`" with "served by any static file server (`yarn start`); ES module scripts do not load from `file://`".

- [ ] **Step 4: Squash into one commit**

```bash
git add -A
git commit -m "docs: record resolved pacing, key and serving decisions in the spec"
git reset --soft $(git rev-list --max-parents=0 HEAD)
git commit --amend -m "feat: add Snake game with rising-tempo chiptune music

Built spec-first as a vehicle for learning the SDD + TDD workflow with Claude.
A pure game core keeps rules testable; thin adapters isolate canvas, audio and storage."
```

Expected: `git log --oneline` shows a single commit on `feature/snake-game`.

---

## Self-Review

**Spec coverage:** movement/WASD/arrows → Tasks 3, 7, 9; reversal ignored → Task 3; growth/score/food-off-snake → Tasks 3, 5; wall/self game over → Task 4; restart → Task 9; speed rising → Tasks 2, 9; music with rising tempo → Tasks 2, 8, 9; mute → Tasks 8, 9; music after first interaction → Tasks 8, 9 (`start()` in keydown); high score + validation → Task 6; pause → Task 5/9; visual polish, rounded cells, shape-distinct food, reduced-motion → Tasks 9 (no animations); CSP, no `innerHTML`/`eval` → Task 9; Web Audio/localStorage fallbacks → Tasks 6, 8; zero runtime deps, yarn, TDD → Task 1. The debug overlay is deferred (nice-to-have, recorded in Task 10).

**Placeholder scan:** none; every code step contains full code.

**Type consistency:** `tick(state, rng)`, `queueDirection(state, dir)`, `togglePause(state)`, `placeFood(snake, rng)`, `createMusic(...) → {start, setBpm, setMuted, isMuted}`, `actionForKey(key)` and `render(ctx, state)` are used with identical signatures across tasks. `stateWith` is defined once in Task 3 and reused.
