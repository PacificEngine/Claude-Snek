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
- Game speed and music tempo increase once for every 4 apples eaten (not on every apple): BPM rises 4 per 4 apples, from 120 to 200 at the 80th apple.
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
- Music starts only after the first user interaction.
- Muting silences the music without changing game speed or the beat grid.

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
- Hosted as a static site on GitHub Pages: a GitHub Actions workflow runs the tests, then publishes only `index.html`, `style.css` and `src/` from `main`. Asset paths stay relative because Pages serves the site under `/<repo>/`.
- Vitest, run through yarn, as a dev-only test tool. The shipped game has zero runtime dependencies. `[from: user global config]` yarn only, TDD, and small commits on a branch.
- No inherited organization, team or project constraints were found.

## Resilience
No external dependencies. No resilience strategy required. Browser-feature fallbacks:
- If Web Audio is unavailable or blocked, the game runs silently on the same step grid, driven by a timer at the same steps/sec.
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
- Redraw on every game tick (nothing animates between ticks). Steps per second = BPM ÷ 15: 8/sec at 120 BPM rising to 13.3/sec at 200 BPM (the tempo steps up once per 4 apples, 20 steps in all).
- Audio events are scheduled ahead on the audio clock so notes and snake steps do not drift apart; throttled background tabs must not cause bursts of notes.
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
  - audio (synthesized music: schedules the track's events for each step on the audio clock)
  - storage (high score)
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
- Derived: apples eaten = snake length minus the starting length; BPM = f(floor(apples ÷ 4)); tier = min(10, floor(apples ÷ 8)); steps/sec and the step interval derive from BPM.
- Beat clock: a step counter (0 at music start or restart) plus the audio-clock time of the next step.

## Decisions (resolved from earlier open questions)
- Speed: one snake step per sixteenth note, so steps/sec = BPM ÷ 15. BPM starts at 120 and rises 4 for every 4 apples eaten, reaching 200 at apple 80 (8 → 13.3 steps/sec; the earlier 20 steps/sec cap is dropped).
- Music: 32-bar A-minor track with melody, bass, synth kick (quarters) and synth hi-hat (eighths); no audio files.
- Pause stops the music; game over stops it; restart replays from bar 1.
- Keys: `P` pause, `Enter` restart, `M` mute.
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
