# Difficulty

## Overview
A difficulty menu with six choices — Easy, Medium, Hard, Frantic, Random and Custom — that changes the grid size, the tempo curve, how fast the snake grows and how big it can get, and every hazard rule. Easy, Medium, Hard and Frantic are fixed presets (Random re-rolls its values every game) whose values are shown but locked; Custom lets the player edit every value within its allowed range. Easy, Medium, Hard and Frantic each keep their own best score. Custom and Random show and save none.

## Parent Domain
`./snake-game.md`

## Dependencies
- The hazard rules in `./hazards.md`, which now read their numbers from the active settings.
- Game start, tick, food placement, pacing and the renderer, which read the grid size, growth, max size and BPM from the settings.
- Browser localStorage for the remembered difficulty, the Custom values and the four best scores.

## Personas
- **Developer-player (you):** wants a gentler game to learn on, a harsher one to be challenged by, and a way to tune every knob.

## Core Requirements

### Must Have

**The four difficulties and their settings**

| # | Heading | Setting | Allowed values | Easy | Medium | Hard | Frantic |
|---|---|---|---|---|---|---|---|
| 1 | Board | Grid Size | 10–50, whole numbers | 16 | 20 | 40 | 50 |
| 2 | BPM | Initial BPM | 20–400, step 1 | 72 | 120 | 144 | 160 |
| 3 | BPM | Final BPM | 20–400, step 1 (may be below Initial) | 120 | 200 | 240 | 280 |
| 4 | BPM | BPM Scale | 0.1–20, step 0.1 | 0.6 | 1.0 | 1.2 | 1.4 |
| 5 | Growth | Growth Count | 0–4, step 0.1 | 0.5 | 1 | 2 | 2 |
| 6 | Growth | Max Snake Size | 3–1000, whole cells | 128 | 200 | 800 | 1000 |
| 7 | Ghost | Ghost Time | 0–40, whole steps | 36 | 24 | 12 | 6 |
| 8 | Ghost | Ghost Time Half Trigger | comma list of 1–1000 | 60, 120, 180, 240 | 60, 120, 180, 240 | 60, 120, 180, 240 | 60, 120, 180, 240 |
| 9 | Walls | Wall Trigger | 1–1000 | 16 | 16 | 16 | 16 |
| 10 | Walls | Wall Size | 1–10 | 2 | 3 | 6 | 10 |
| 11 | Walls | Wall Count | 1–20 | 2 | 4 | 8 | 20 |
| 12 | Bombs | Bomb Trigger | 1–1000 | 32 | 32 | 32 | 32 |
| 13 | Bombs | Bomb Spawn Rate | 1–10 | 4 | 4 | 1 | 1 |
| 14 | Bombs | Bomb Spawn Count | 1–5 | 1 | 1 | 2 | 5 |
| 15 | Bombs | Bomb Spawn Max | 1–50 | 6 | 12 | 20 | 30 |
| 16 | Spawning walls | Wall Spawn Trigger | 1–1000 | 48 | 48 | 48 | 48 |
| 17 | Spawning walls | Wall Spawn Size | 1–10 | 1 | 2 | 4 | 6 |
| 18 | Spawning walls | Wall Spawn Rate | 1–10 | 2 | 1 | 1 | 1 |
| 19 | Spawning walls | Wall Spawn Count | 1–5 | 1 | 1 | 2 | 4 |
| 20 | Spawning walls | Wall Spawn Max | 10–1000 cells | 40 | 80 | 200 | 1000 |
| 21 | Enemies | Enemy Spawn Trigger | 1–1000 | 64 | 64 | 64 | 64 |
| 22 | Enemies | Enemy Spawn Size | 1–25 | 2 | 3 | 6 | 10 |
| 23 | Enemies | Enemy Spawn Rate | 1–10 | 5 | 5 | 5 | 3 |
| 24 | Enemies | Enemy Spawn Max | 1–10 | 1 | 1 | 4 | 8 |
| 25 | Effects | Moving Wall Trigger | 1–1000 | 80 | 80 | 80 | 80 |
| 26 | Effects | Invisible Hazard Trigger | 1–1000 | 100 | 100 | 100 | 100 |
| 27 | Effects | Invisible Hazard Timing | 1–40 steps | 20 | 16 | 8 | 8 |
| 28 | Effects | Invisible Hazard Half Trigger | comma list of 1–1000 | 200, 400, 600, 800 | 200, 400, 600, 800 | 200, 400, 600, 800 | 200, 400, 600, 800 |
| 29 | Music | Kick Trigger | 0–1000 | 0 | 0 | 0 | 0 |
| 30 | Music | Bass Trigger | 0–1000 | 0 | 0 | 0 | 0 |
| 31 | Music | Hi-Hat Trigger | 0–1000 | 8 | 8 | 8 | 8 |
| 32 | Music | Melody Trigger | 0–1000 | 16 | 16 | 16 | 16 |
| 33 | Music | Snare Trigger | 0–1000 | 24 | 24 | 24 | 24 |
| 34 | Music | Fast Hi-Hat Trigger | 0–1000 | 32 | 32 | 32 | 32 |
| 35 | Music | Arpeggio Trigger | 0–1000 | 40 | 40 | 40 | 40 |
| 36 | Music | Bass Pulse Trigger | 0–1000 | 48 | 48 | 48 | 48 |
| 37 | Music | Harmony Trigger | 0–1000 | 56 | 56 | 56 | 56 |
| 38 | Music | Counter-Melody Trigger | 0–1000 | 64 | 64 | 64 | 64 |
| 39 | Music | Drum Fill Trigger | 0–1000 | 72 | 72 | 72 | 72 |

Every "Trigger" is an apple count: the feature starts on the apple whose count reaches that number. "Apples" always means apples eaten (the score), not the snake's length.

**What each setting does**
1. **Grid Size:** the board is Size × Size. The snake starts with 3 cells at the centre heading right. The canvas stays the same pixel size, so cells get smaller as the grid grows.
2–4. **BPM:** the tempo starts at *Initial BPM* and moves by *BPM Scale* for every apple eaten (not every 4th), towards *Final BPM*, where it stops: `bpm = min(Final, Initial + Scale × apples)` when Final is above Initial, and `max(Final, Initial − Scale × apples)` when Final is below it (equal values give a constant tempo). The value may be fractional. One step is still one sixteenth note, so the step rate follows the tempo. The music layers still follow the apple count, not the tempo (see 29–39).
5. **Growth Count:** each apple eaten adds this amount to a growth carry. Whenever the carry reaches a whole number, the snake grows by that many cells and the carry drops by that amount. So 0.1 grows 1 cell every 10th apple, 0.5 grows 1 cell every 2nd apple, 1 grows 1 cell per apple, 4 grows 4 cells per apple, and 0 never grows. The new cells appear one per step as the tail stays in place. The score always goes up by exactly 1 per apple regardless of growth. The carry is computed in whole tenths so no rounding error builds up.
6. **Max Snake Size:** the snake never grows beyond this many cells. Once it reaches the size, apples still score and still raise the tempo and the game goes on, but growth stops: pending growth and the carry are dropped and the tail moves normally. While growing, pending is never more than the room left under the max.
7–8. **Ghost:** *Ghost Time* is how many steps a new obstacle is a harmless ghost before it turns solid; 0 means solid at once. *Ghost Time Half Trigger* is a comma-separated list of apple counts. For an obstacle placed on an apple, the ghost time is halved once for every list entry that is **less than** the apple count (so with 60, an obstacle placed on apple 61 or later is halved). A value listed twice halves twice (quartering), three times is an eighth, and so on. Each halving is rounded **up** to a whole step: 36 → 18 → 9 → 5 → 3, 12 → 6 → 3 → 2 → 1. A ghost time of 0 stays 0. The list always keeps at least one entry (an empty or unreadable entry is ignored and the previous list kept). Entries are order-independent; up to 10 entries are kept.
9–11. **Walls:** when the apple count reaches *Wall Trigger*, place *Wall Count* straight wall segments, each *Wall Size* cells long, once.
12–15. **Bombs:** when the apple count reaches *Bomb Trigger*, bombs start. The target number of bombs is `min(Bomb Spawn Max, Bomb Spawn Count × (1 + floor((apples − Bomb Trigger) ÷ Bomb Spawn Rate)))`, so a batch of *Bomb Spawn Count* bombs is added every *Bomb Spawn Rate* apples, up to the max. Every bomb still jumps to a new spot on every apple.
16–20. **Spawning walls:** from *Wall Spawn Trigger* on, on every apple where `(apples − trigger) ÷ rate` is a whole number, add *Wall Spawn Count* segments of *Wall Spawn Size* cells each, as long as the spawned wall cells stay within *Wall Spawn Max*. The max counts only these spawned walls, not the first walls from items 9–11.
21–24. **Enemies:** the first enemy appears when the apple count reaches *Enemy Spawn Trigger*, each *Enemy Spawn Size* cells long. One more enemy is added every *Enemy Spawn Rate* apples after that, up to *Enemy Spawn Max* (target = `min(max, 1 + floor((apples − trigger) ÷ rate))`). A dead enemy is replaced by a fresh ghost enemy on your next apple.
25. **Moving Wall Trigger:** from this apple on, every apple re-lays all wall segments (same count and sizes) at new random places.
26–28. **Invisible hazards:** walls and bombs placed on or after the *Invisible Hazard Trigger* apple flash as ghosts, turn solid, then fade to fully invisible over *Invisible Hazard Timing* steps while staying solid. *Invisible Hazard Half Trigger* works exactly like the ghost one: the timing is halved (rounded up, minimum 1) once for each list entry less than the apple count the obstacle is placed on, and duplicates halve again. Enemies never become invisible.

Music (items 29–39). **Music (global):** the eleven Music triggers are NOT part of a difficulty. They are one shared set that never changes when the difficulty changes, is always editable (even while Easy, Medium, Hard, Frantic or Random is selected), is saved on its own and is merged into whatever settings are active. The table columns for these rows are only the defaults. Details: one trigger per instrument layer, including *Kick* and *Bass* triggers (default 0, so they play from the start as before; setting them later silences them until then). One trigger per instrument layer, named for the instrument rather than a tier number: Kick, Bass, Hi-Hat, Melody, Snare, Fast Hi-Hat, Arpeggio, Bass Pulse, Harmony, Counter-Melody and Drum Fill. Bass Pulse still replaces the quarter-note bass pattern once it is active, but only while the Bass layer itself is playing. A layer plays once the apple count has reached its trigger (`apples >= trigger`); 0 means from the very first step. Triggers are independent and may be in any order (the snare may come before the hi-hat, the harmony before the melody, and so on); two layers may share a value. Values are whole numbers 0–1000. The defaults are 8, 16, 24 … 72 in the order above, which reproduces the old tiers (one every 8 apples). Fast Hi-Hat, when active, plays the hi-hat on every sixteenth and replaces the eighth-note Hi-Hat pattern; Bass Pulse replaces the quarter-note bass pattern. Harmony is computed from the melody line a third above, and Counter-Melody from the same bar pattern, so each plays even when its Melody trigger has not been reached. A change takes effect at the next bar line, as before. The overall music tier number is gone.

All six "Trigger" fields (Wall, Bomb, Wall Spawn, Enemy Spawn, Moving Wall, Invisible Hazard) accept 1–1000; the Music triggers accept 0–1000, and the half-trigger lists accept 1–1000 per entry.

**The Medium preset keeps today's game.** It reproduces the current rules exactly, apart from these deliberate changes: the tempo now rises by 1 BPM on every apple instead of 4 on every 4th apple, halved values round up instead of to nearest, the snake is capped at 200 cells (the old game had no cap), the ghost time halves two more times at apples 181 and 241 (24, 12, 6, 3, 2 instead of stopping at 6), the Wall Spawn Max counts spawned wall cells only (so the total can reach 92 including the first 12 cells), bombs now also fade from apple 100, and the fade takes 16 steps instead of 40.

**Frantic and Random**
- **Frantic** is a fourth locked preset (column above): a 50×50 board at 160 → 280 BPM (Scale 1.4), growth 2, up to 1000 cells, six-step ghosts and the biggest, densest hazards. Values the request did not state use the Hard (shared) values. It keeps its own best score under `snake.highScore.frantic`.
- **Random** is a locked mode that re-rolls every setting at the start of each new game (when it is chosen and on every restart after game over), using the injected random source. The menu shows the values of the current roll, locked, with a note that they change every game. Limits of a roll (all settings stay inside their normal ranges and steps):
  - every non-list trigger (Wall, Bomb, Wall Spawn, Enemy Spawn, Moving Wall, Invisible Hazard) is below 100 (1–99). Random rolls its own Music triggers (see below, they follow the ramp rule instead);
  - Max Snake Size is at most 50% of the board cells (grid size squared), and at least 3;
  - Wall Spawn Max is at most 20% of the board cells (at least its minimum of 10), Bomb Spawn Max at most 10% (at least 1) and Enemy Spawn Max at most 10% (at least 1);
  - in each half-trigger list the first value is at most 200, the second at most 400, the third at most 600 and the fourth at most 800 (each at least 1); both lists have four values;
  - Initial BPM and Final BPM are each between 60 and 260;
  - the eleven Music triggers are rolled too, as a build-up: sorted from lowest to highest, the first is 0, the second at most 10, the third at most 20 and so on up to the eleventh at most 100 (whole numbers, 0–100), assigned to the instruments in a random order so any instrument can come in early or late. A Random roll's music is used only for that Random game: it is never saved and never replaces the player's own global Music settings, which come back unchanged as soon as another difficulty is chosen. While Random is selected the Music fields in the menu show the roll and are locked, and Reset to default is disabled;
  - all other settings are uniform over their allowed values.
- Random shows and saves no best score, exactly like Custom (the rules differ every game, so scores are not comparable). A Random roll (including its music) is never saved; only the choice of Random is remembered.

**Per-difficulty best score**
- Easy, Medium, Hard and Frantic each have their own best score, saved separately and shown as "Best" for the active difficulty.
- Custom and Random show no best score and save none: the "Best" display is hidden while either is active, and their runs never write to storage.
- The old single saved best score becomes Medium's best the first time the new version loads (if Medium has none yet).

**The menu**
- A "Difficulty: Medium" button in the header opens a dialog with a difficulty selector and all 39 settings, grouped under headings (Board, BPM, Growth, Ghost, Walls, Bombs, Spawning walls, Enemies, Effects, Music), each with its label and allowed range.
- While Custom is selected, a **Reset to default** button (in the same place as Random's Reroll, under the note) sets every Custom value back to the Medium preset in the dialog; Apply keeps it, Cancel discards it. It is hidden and disabled for every other difficulty and never touches the Music settings.
- The Music section is always editable and has a **Reset to default** button that restores the eleven defaults (0, 0, 8, 16 … 72) in the dialog; like the other edits it is kept when you Apply (Cancel discards it). Music values are corrected like Custom ones (whole numbers 0–1000, on leaving the field or pressing Enter). For every other section in Easy, Medium, Hard, Frantic and Random every field shows that preset's value and is locked (read-only). Only Custom fields are editable.
- While Random is selected a **Reroll** button appears that draws a fresh roll (music included) to preview; Apply runs exactly the roll shown and Cancel discards it. It is hidden and disabled for every other difficulty.
- The Music section also has a **Randomize** button that rolls new values for your own Music using Random's build-up rule. It is a draft until Apply (Cancel discards it), works under every difficulty except Random, where it is disabled because the fields show the locked roll.
- The Music section has a **Randomize every game** checkbox. When on (and the difficulty is not Random, where it is disabled because Random already rolls its own music), every new game, on Apply and after each game over, uses a fresh Music roll under Random's build-up rule; that roll is for that game only and never changes your saved Music. While on, the Music fields show the roll the next game will use, locked, and Randomize and Reset to default are disabled; your own values come back when it is turned off. The choice is kept when you Apply (Cancel discards it).
- List fields (the two half triggers) are typed as comma-separated numbers; entries are trimmed, each clamped to 1–1000 and rounded to a whole number, non-numbers dropped, and the corrected list is shown back. If nothing valid remains the previous list is kept.
- Custom values are corrected when you leave the field or press Enter: out-of-range or off-step values are corrected to the nearest allowed value (clamped and rounded to the step), and anything that is not a number reverts to the previous valid value.
- The menu can only be opened or applied when no run is in progress (before the first move, and after game over). While playing, the button is disabled.
- Applying a difficulty starts a fresh run: score 0, no hazards, the beat restarts from bar 1, and the board is redrawn at the new grid size.
- The last chosen difficulty and the Custom values are remembered between visits. The default is Medium.

### Must Not Do
- Never allow a setting outside its range or step, from the menu or from stored data.
- Never save a score for Custom or Random.
- Never let the menu change settings mid-run.
- Never trust stored settings without validating every field.

### Nice to Have
- Showing each setting's preset value next to the Custom input.

## Technical Constraints
- Settings are plain data passed into the pure game core; no global state. All randomness stays injected.
- Vanilla JavaScript with ES modules, no build step, zero runtime dependencies; yarn only; TDD.
- The menu is a native `<dialog>` with ordinary form inputs; no inline scripts or styles (CSP unchanged).

## Resilience
No external dependencies. If localStorage is unavailable, the chosen difficulty, Custom values and best scores simply are not remembered and the game continues. Corrupt stored values are ignored field by field and replaced by defaults.

## Observability
None beyond the parent spec. Invalid stored settings are silently replaced, not logged.

## Security
- **Attack surface:** the menu's text/number inputs and stored values in localStorage.
- **Data:** every field is parsed as a number, clamped to its range and rounded to its step before use; stored JSON that is not an object or has non-numeric fields is rejected field by field. Inputs are never inserted as HTML (`textContent` and input values only).
- **Auth/compliance:** none.

## Performance & Scalability
- A 50×50 grid is 2,500 cells. The route check is a breadth-first search over at most 2,500 cells, with at most 50 attempts per placement and up to a few dozen placements per apple (Hard: 20 bombs plus many walls), so the per-apple cost stays in the tens of milliseconds. Verify on a 50×50 Custom board.
- Rendering stays one redraw per step; cells are drawn at canvas width ÷ grid size pixels.

## UX/UI
- The dialog fits a 320 px wide phone (fields stack in one column and the dialog scrolls inside itself, so the page still never scrolls).
- Locked fields look locked (greyed, with `readonly`/`disabled` semantics and an accessible explanation); editable fields show their allowed range.
- The dialog and its controls are keyboard-operable, have accessible names, and return focus to the Difficulty button on close.

## Data Model
- `settings`: a plain object with the numeric fields above (the eleven Music triggers are held separately and merged in) plus the two half-trigger lists (arrays of numbers), camelCase names, always complete and valid.
- Presets: `easy`, `medium`, `hard`, `frantic` constants; `custom` is built from stored values.
- Stored (localStorage): `snake.difficulty` (`easy|medium|hard|frantic|random|custom`), `snake.music` (JSON of the eleven music triggers, validated field by field, defaults when missing), `snake.musicRandom` (`true` or `false`, anything else is off), `snake.custom` (JSON of the non-music fields; an old save without the new fields or with the old speed field is filled field by field from Medium), `snake.highScore.easy|medium|hard|frantic` (non-negative integers). The legacy `snake.highScore` is read once as Medium's best.
- The active `settings` live in the game state (`state.settings`); `state.growth` holds `{ carry, pending }` (carry in tenths; pending is cells still to grow).

## Testing Strategy
- **Unit tests (Vitest, TDD):**
  - the four presets equal the table exactly; every preset value is inside its own range and step
  - field validation: clamp to range, round to step, non-numbers rejected; building settings from partial/corrupt custom data fills defaults per field
  - ghost and invisible timing by apple count with a half-trigger list: halved once per entry below the apple count, duplicates halve twice, rounded up, 0 stays 0, empty list never halves, minimum 1 for timing
  - bpm: rises/falls by Scale per apple, stops at Final, constant when equal, fractional values
  - max snake size: growth stops at the max, pending and carry dropped, score and tempo unaffected
  - list field parsing: trimmed, clamped, non-numbers dropped, order-independent, at most 10 entries
  - growth: carries of 0.1, 0.5, 1, 4 and 0 over many apples; pending growth adds one cell per step; score always +1
  - grid size: start position is the centre; bounds, neighbours, cell listing, pathing and placement honour any size from 10 to 50
  - bombs: target count formula for the four presets (including Hard: 2 at the trigger, 4 next apple, … 20 at the max) and custom rates
  - spawning walls: trigger, rate, count, size and the cell max
  - enemies: trigger, rate and max; dead ones replaced on the next apple
  - moving walls and invisible hazards: triggers; walls and bombs fade over the configured timing; enemies never fade
  - best scores: separate keys per difficulty, Custom neither read nor written, legacy key migrated to Medium once, tampered values rejected
  - Randomize every game: the pure music-for-a-game helper returns the saved music when off, a valid build-up roll when on, keeps Random's own roll, never mutates the saved music; the toggle's storage round-trips and rejects junk
  - persistence of the chosen difficulty and Custom values, with validation of corrupt data
  - menu: locked fields for presets, editable for Custom, disabled during a run, values clamped on input (DOM-light tests of the pure helpers)
- **Manual only:** the dialog's look and feel, behaviour on a phone, balance of each preset, and how a 50×50 board performs.
- **E2E:** None in v1.

## Open Questions
- Hard is extreme by design (a 40×40 grid at 144 → 240 BPM, growth of 2, bombs reaching 20 by apple 41). Tune by play.
- Extreme Custom values (an Initial BPM of 20 or 400; a 10×10 grid with the 5-cell safe zone) are allowed and may be unpleasant; the placement rules simply skip what does not fit.
- A ghost time of 0 removes the telegraph entirely; this is allowed for Custom only because the range includes 0.
