# Snake Game

## Overview
A single-player, browser-based Snake-style game. It's a personal learning project for practicing how to work with Claude through the SDD workflow (spec → plan → TDD). Success means a playable game that runs in a browser.

## Personas
- **Developer-player (you):** Plays the game and uses building it to learn Claude-assisted development.

## Core Requirements

### Must Have
- The snake moves continuously and turns with arrow keys or WASD. A 180° reversal is ignored.
- Eating food grows the snake by one cell and raises the score.
- Food spawns on a random empty cell, never on the snake.
- The game ends when the snake hits a wall or itself.
- A restart is available after game over.
- Game speed increases as the snake grows.
- Synthesized MIDI/chiptune-style background music plays during play, and its tempo rises as the snake grows.
- A mute/unmute toggle for the music.
- Music starts only after the first user interaction.

### Must Not Do
- No backend, accounts or network requests.
- No multiplayer.
- No external audio files; all sound is synthesized.
- No mobile or touch controls in v1.
- No autoplaying audio before user interaction.
- No `innerHTML` or `eval`.

### Nice to Have
- Pause key
- Persistent high score
- Visual polish (grid, colors)
- A debug overlay showing FPS and tick rate

## Technical Constraints
- Vanilla JavaScript with ES modules, no build step. Served by any static file server (`yarn start`); ES module scripts do not load from `file://`.
- HTML Canvas for rendering and Web Audio for music.
- Vitest, run through yarn, as a dev-only test tool. The shipped game has zero runtime dependencies. `[from: user global config]` yarn only, TDD, and small commits on a branch.
- No inherited organization, team or project constraints were found.

## Resilience
No external dependencies. No resilience strategy required. Browser-feature fallbacks:
- If Web Audio is unavailable or blocked, the game runs silently.
- If localStorage is unavailable, the high score doesn't persist and the game continues.

## Observability
- `console.error` for unexpected failures only (audio initialization, storage errors).
- No analytics or telemetry, and no alerts.
- Optional dev debug overlay (FPS, tick rate).

## Security
- **Attack surface:** Keyboard input only.
- **Data:** No PII or credentials. The only stored value is the high score, which is validated as a finite non-negative number on read.
- **Auth:** None.
- **Compliance:** None required. Basic OWASP hygiene applies, and the page includes a restrictive Content-Security-Policy.

## Performance & Scalability
- Redraw on every game tick (nothing animates between ticks). Logic ticks start around 8/sec and rise with snake length.
- Input latency under one tick, with no dropped keypresses (a direction queue handles two quick presses).
- Performance is checked manually in the browser. There's no load testing.
- Scaling and growth don't apply: it's single-player and client-side, and the 20×20 grid keeps the work per frame bounded.

## UX/UI
- Clean, modern look: flat colors and rounded cells.
- 20×20 grid.
- Keyboard-only play.
- Sufficient color contrast.
- Food differs from the snake by shape, not color alone.
- Respects `prefers-reduced-motion`.

## Architecture
- **Core (pure):** `tick(state, rng) → state`, with input applied via `queueDirection(state, dir)`. No DOM or audio access.
- **Adapters:**
  - renderer (canvas)
  - input (keys → directions)
  - audio (synthesized music, tempo from snake length)
  - storage (high score)
- **`main.js`:** ties the pieces together with a timer loop.

## Testing Strategy
- **Unit tests (Vitest, TDD):**
  - movement
  - blocking a 180° reversal
  - wall and self collision
  - growth
  - food placement
  - scoring
  - the tempo curve
  - high-score validation
- **Adapter tests:** Light tests with fakes, including the silent fallback when Web Audio is missing.
- **Manual only:** Canvas rendering, actual sound, and game feel.
- **E2E:** None in v1.

## Data Model
- Cell `{x, y}` on a 20×20 grid.
- Snake is an ordered array of cells, head first.
- Direction is `up`, `down`, `left` or `right`, plus a queued next direction.
- Food is a single cell.
- State is `{snake, direction, food, score, status}`, with status `playing`, `paused` or `gameOver`.
- Stored: only `highScore` in localStorage.
- Derived: tick rate and music BPM, both pure functions of snake length.

## Decisions (resolved from earlier open questions)
- Speed: starts at 8 ticks/sec, +0.5 per food, max 20.
- Music: 100 BPM, +4 per food, max 200; A-minor pentatonic square-wave loop.
- Keys: `P` pause, `Enter` restart, `M` mute.
- Debug overlay: deferred.

## Open Questions
None.

## Feature Breakdown
- Movement and controls: covered in this spec
- Food, growth and score: covered in this spec
- Game over and restart: covered in this spec
- Synthesized music with rising tempo: covered in this spec
- Mute toggle: covered in this spec
- Pause, high score, visual polish: nice-to-haves, covered in this spec
