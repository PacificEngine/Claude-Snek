# Snake Game

## Overview
A single-player, browser-based Snake-style game. It's a personal learning project for practicing how to work with Claude through the SDD workflow (spec → plan → TDD). Success means a playable game that runs in a browser.

## Personas
- **Developer-player (you):** Plays the game and uses building it to learn Claude-assisted development.

## Core Requirements

### Must Have
- The snake moves continuously and turns with arrow keys or WASD. A 180° reversal is ignored.
- Eating food raises the score by 1 and grows the snake by the Growth Count setting (1 cell per apple on Medium; fractional values carry over, 0 never grows; see `./difficulty.md`).
- The board is a square grid whose size (10 to 50) comes from the active difficulty (Medium: 20).
- A difficulty menu offers Easy, Medium, Hard and Custom. Presets are locked; Custom lets every setting be edited within its range. Easy, Medium and Hard each keep their own best score; Custom shows and saves none. The menu is only available when no run is in progress. See `./difficulty.md`.
- Food spawns on a random empty cell, never on the snake.
- The game ends when the snake hits the arena edge, itself, or a solid hazard (walls, bomb, enemy snake; see `./hazards.md`).
- A restart is available after game over.
- Game speed and music tempo move with every apple eaten: the BPM goes from the difficulty's Initial BPM towards its Final BPM by BPM Scale per apple (Medium: 120 to 200, 1 per apple, reached at the 80th apple). See `./difficulty.md`.
- The snake advances exactly one cell per sixteenth note of the music (rhythm-game feel): the music and the game share one beat clock, so every step lands on the beat grid.
- Synthesized MIDI/chiptune-style background music plays during play: a 32-bar track (intro 4, verse 8, chorus 8, bridge 4, final chorus 8) in A minor with melody, a bass line, a synth kick on every quarter note and a synth hi-hat on every eighth note. Tempo rises with apples eaten (above), which also speeds up the game; the track keeps its place when the tempo changes.
- The music grows more complex only as apples are eaten, in 10 tiers (one every 8 apples) that add layers on top of the 32-bar structure; the 80th apple reaches tier 10, a very complex loop with every layer playing:
  - tier 0 (0-7 apples): bass and kick only
  - tier 1 (8-15): hi-hat on eighth notes
  - tier 2 (16-23): melody enters (verse, chorus and the other sections apply)
  - tier 3 (24-31): snare on beats 2 and 4
  - tier 4 (32-39): hi-hat becomes sixteenth notes
  - tier 5 (40-47): fast chord arpeggio under the melody
  - tier 6 (48-55): bass becomes a driving eighth-note pulse
  - tier 7 (56-63): harmony a third above the melody
  - tier 8 (64-71): counter-melody, an octave up and offset
  - tier 9 (72-79): drum fill at the end of every 4th bar
  - tier 10 (80+): everything at once
- A tier change takes effect at the next bar line so a new layer enters on a downbeat. Restarting after game over resets to tier 0 and 0 apples.
- Pausing stops the music and the snake; resuming continues on the next step. Game over stops the music; restart begins the track again from bar 1.
- A mute/unmute toggle for the music.
- On-screen buttons make the game fully playable on touch devices as well as with the keyboard: a four-way D-pad (up, down, left, right), a Pause button, a Restart button, and the existing Mute button. Each button triggers exactly the same game action as its key through one shared action path.
- The first tap on any button counts as the first interaction, so music can start from touch alone.
- Music starts only after the first user interaction.
- Muting silences the music without changing game speed or the beat grid.

### Must Not Do
- No backend, accounts or network requests.
- No multiplayer.
- No external audio files; all sound is synthesized.
- No swipe or other gesture controls in v1 (on-screen buttons only).
- No autoplaying audio before user interaction.
- No `innerHTML` or `eval`.

### Nice to Have
- Pause key
- Persistent high score per difficulty (none for Custom)
- Visual polish (grid, colors)
- A debug overlay showing FPS and tick rate

## Technical Constraints
- Vanilla JavaScript with ES modules, no build step. Served by any static file server (`yarn start`); ES module scripts do not load from `file://`.
- HTML Canvas for rendering and Web Audio for music.
- Hosted as a static site on GitHub Pages: a GitHub Actions workflow runs the tests, then publishes only `index.html`, `style.css` and `src/` from `main`. Asset paths stay relative because Pages serves the site under `/<repo>/`.
- Vitest, run through yarn, as a dev-only test tool. The shipped game has zero runtime dependencies. `[from: user global config]` yarn only, TDD, and small commits on a branch.
- No inherited organization, team or project constraints were found.

## Resilience
No external dependencies. No resilience strategy required. Browser-feature fallbacks:
- If Web Audio is unavailable or blocked, the game runs silently on the same step grid, driven by a timer at the same steps/sec.
- If localStorage is unavailable, the chosen difficulty, Custom values and best scores don't persist and the game continues.

## Observability
- `console.error` for unexpected failures only (audio initialization, storage errors).
- No analytics or telemetry, and no alerts.
- Optional dev debug overlay (FPS, tick rate).

## Security
- **Attack surface:** Keyboard, on-screen button (pointer) input, the difficulty menu's number inputs, and stored values.
- **Data:** No PII or credentials. Stored values are the chosen difficulty, the Custom settings and one best score per preset difficulty; every one is validated on read (best scores as finite non-negative integers, settings field by field against their ranges and steps).
- **Auth:** None.
- **Compliance:** None required. Basic OWASP hygiene applies, and the page includes a restrictive Content-Security-Policy.

## Performance & Scalability
- Redraw on every game tick (nothing animates between ticks). Steps per second = BPM ÷ 15: 8/sec at 120 BPM rising to 13.3/sec at 200 BPM (the tempo steps up once per 4 apples, 20 steps in all).
- Audio events are scheduled ahead on the audio clock so notes and snake steps do not drift apart; throttled background tabs must not cause bursts of notes.
- Input latency under one tick, with no dropped keypresses or taps (a direction queue handles two quick presses). Buttons respond on `pointerdown`, so there is no tap delay.
- Performance is checked manually in the browser. There's no load testing.
- Scaling and growth don't apply: it's single-player and client-side. The grid is at most 50×50 (2,500 cells), which keeps the work per apple bounded; verify performance on a 50×50 Custom board.

## UX/UI
- Clean, modern look: flat colors and rounded cells.
- Square grid from 10×10 to 50×50, set by the difficulty; the canvas stays the same pixel size, so cells shrink as the grid grows.
- A Difficulty button opens a menu dialog (see `./difficulty.md`); it is disabled during a run. The best score shown is for the active preset and is hidden for Custom.
- Playable with the keyboard or the on-screen buttons.
- Touch layout: buttons are at least 48 px square, the D-pad sits below the board, the board scales to fit narrow screens (down to 320 px wide) without page scrolling, and double-tap zoom and text selection are suppressed on the controls (`touch-action: manipulation`).
- Buttons have accessible names (`aria-label`) and a visible pressed state.
- Sufficient color contrast.
- Food differs from the snake by shape, not color alone.
- Respects `prefers-reduced-motion`: nothing animates between steps; obstacle ghosts flash at most about 1.7 times per second (under the 3 per second limit) and become steady outlines under reduced motion (see `./hazards.md`).

## Architecture
- **Core (pure):** `tick(state, rng) → state`, with input applied via `queueDirection(state, dir)`. The active `settings` (see `./difficulty.md`) live in the state and are passed to the places that need them. No DOM or audio access.
- **Adapters:**
  - renderer (canvas)
  - input (keys and on-screen buttons → one shared set of actions)
  - audio (synthesized music: schedules the track's events for each step on the audio clock)
  - storage (per-difficulty best scores, chosen difficulty, Custom settings)
  - difficulty menu (a native dialog; edits Custom, shows presets locked)
- **Beat clock (pure + adapter):** a conductor counts sixteenth-note steps and gives each step's time. Both the game step and the music events for step *n* are scheduled at that step's time. With no Web Audio it runs from a timer instead.
- **Track (pure data):** the 32-bar arrangement indexed by step number (0-511, then loops); `eventsAt(step, tier)` returns what plays at that complexity tier (melody, harmony, counter-melody, arpeggio, bass, kick, snare, hi-hat, fill).
- **`main.js`:** ties the pieces together around the beat clock.

## Testing Strategy
- **Unit tests (Vitest, TDD):**
  - movement
  - blocking a 180° reversal
  - wall and self collision
  - growth
  - food placement
  - scoring
  - the tempo curve (apples eaten to BPM in steps of 4 apples; BPM to step interval, steps/sec = BPM ÷ 15)
  - the tier curve (apples eaten to tier 0-10, one tier per 8 apples, capped at 10)
  - track lookup: which events fire on step *n* at each tier, layers appearing in the tier order above, kick on quarters, wraparound after 512 steps
  - tier changes deferred to the next bar line
  - high-score validation, per-difficulty keys, no Custom score
  - difficulty presets, validation and growth: see `./difficulty.md`
  - button-to-action mapping (each button yields the same action as its key)
  - hazards: see `./hazards.md`
- **Adapter tests:** Light tests with fakes, including the silent fallback when Web Audio is missing.
- **Manual only:** Canvas rendering, actual sound, game feel, and touch behavior on a real phone or emulated touch device (tap targets, no zoom or scroll, music starts on first tap).
- **E2E:** None in v1.

## Data Model
- Cell `{x, y}` on an N×N grid (N from the active settings, 10 to 50).
- Snake is an ordered array of cells, head first.
- Direction is `up`, `down`, `left` or `right`, plus a queued next direction.
- Food is a single cell.
- State is `{snake, direction, food, score, status, hazards, settings, growth}`, with status `playing`, `paused` or `gameOver`; `hazards` is described in `./hazards.md`, `settings` and `growth` in `./difficulty.md`.
- Stored in localStorage: the chosen difficulty, the Custom settings, and one best score per preset difficulty (none for Custom).
- Derived: apples eaten = the score (no longer the snake's length, because growth can differ from 1 per apple); BPM = f(floor(apples ÷ 4)); tier = min(10, floor(apples ÷ 8)); steps/sec and the step interval derive from BPM.
- Beat clock: a step counter (0 at music start or restart) plus the audio-clock time of the next step.

## Decisions (resolved from earlier open questions)
- Speed: one snake step per sixteenth note, so steps/sec = BPM ÷ 15. BPM starts at 120 and rises 4 for every 4 apples eaten, reaching 200 at apple 80 (8 → 13.3 steps/sec; the earlier 20 steps/sec cap is dropped).
- Music: 32-bar A-minor track with melody, bass, synth kick (quarters) and synth hi-hat (eighths); no audio files.
- Pause stops the music; game over stops it; restart replays from bar 1.
- Keys: `P` pause, `Enter` restart, `M` mute. Touch: D-pad, Pause and Restart buttons plus the Mute button, always visible on every device.
- Difficulty: four choices (Easy, Medium, Hard, Custom) with 23 settings, defined in `./difficulty.md`. The Medium preset keeps the previous game.
- Debug overlay: deferred.

## Open Questions
- The melody, bass, tier layers and section details are composed as data and tuned by ear after first listen; expect revisions.

## Feature Breakdown
- Movement and controls: covered in this spec
- Food, growth and score: covered in this spec
- Game over and restart: covered in this spec
- Synthesized 32-bar music with rising tempo and apple-driven complexity tiers: covered in this spec
- Beat-synced movement (one step per sixteenth note): covered in this spec
- Mute toggle: covered in this spec
- Pause, high score, visual polish: nice-to-haves, covered in this spec
- Touch controls (D-pad, Pause, Restart, Mute buttons): covered in this spec
- Hazards (walls, bombs, enemy snakes, re-laid and fading hazards) → `./hazards.md` [complex, has its own spec]
- Difficulty menu, presets, Custom settings and per-difficulty best scores → `./difficulty.md` [complex, has its own spec]
