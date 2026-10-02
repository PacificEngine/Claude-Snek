# Difficulty

## Overview
A difficulty menu with four choices — Easy, Medium, Hard and Custom — that changes the grid size, the game speed, how fast the snake grows, and every hazard rule. Easy, Medium and Hard are fixed presets whose values are shown but locked; Custom lets the player edit every value within its allowed range. Easy, Medium and Hard each keep their own best score. Custom shows and saves no best score at all.

## Parent Domain
`./snake-game.md`

## Dependencies
- The hazard rules in `./hazards.md`, which now read their numbers from the active settings.
- Game start, tick, food placement, pacing and the renderer, which read the grid size, growth and speed from the settings.
- Browser localStorage for the remembered difficulty, the Custom values and the three best scores.

## Personas
- **Developer-player (you):** wants a gentler game to learn on, a harsher one to be challenged by, and a way to tune every knob.

## Core Requirements

### Must Have

**The four difficulties and their settings**

| # | Setting | Allowed values | Easy | Medium | Hard |
|---|---|---|---|---|---|
| 1 | Grid Size | 10–50, whole numbers | 16 | 20 | 40 |
| 2 | Game Speed Modifier | 0.1–2, step 0.1 | 0.6 | 1.0 | 1.2 |
| 3 | Growth Count | 0–4, step 0.1 | 0.5 | 1 | 2 |
| 4 | Ghost Time | 0–40, whole steps | 36 | 24 | 12 |
| 5 | Wall Trigger | 1–100 | 16 | 16 | 16 |
| 6 | Wall Size | 1–10 | 2 | 3 | 6 |
| 7 | Wall Count | 1–20 | 2 | 4 | 8 |
| 8 | Bomb Trigger | 1–100 | 32 | 32 | 32 |
| 9 | Bomb Spawn Rate | 1–10 | 4 | 4 | 1 |
| 10 | Bomb Spawn Count | 1–5 | 1 | 1 | 2 |
| 11 | Bomb Spawn Max | 1–25 | 6 | 12 | 20 |
| 12 | Wall Spawn Trigger | 1–100 | 48 | 48 | 48 |
| 13 | Wall Spawn Size | 1–10 | 1 | 2 | 4 |
| 14 | Wall Spawn Rate | 1–10 | 2 | 1 | 1 |
| 15 | Wall Spawn Count | 1–5 | 1 | 1 | 2 |
| 16 | Wall Spawn Max | 10–250 cells | 40 | 80 | 200 |
| 17 | Enemy Spawn Trigger | 1–100 | 64 | 64 | 64 |
| 18 | Enemy Spawn Size | 1–10 | 2 | 3 | 6 |
| 19 | Enemy Spawn Rate | 1–10 | 5 | 5 | 5 |
| 20 | Enemy Spawn Max | 1–5 | 1 | 1 | 4 |
| 21 | Moving Wall Trigger | 1–100 | 80 | 80 | 80 |
| 22 | Invisible Hazard Trigger | 1–100 | 100 | 100 | 100 |
| 23 | Invisible Hazard Timing | 1–40 steps | 20 | 16 | 8 |

Every "Trigger" is an apple count: the feature starts on the apple whose count reaches that number. "Apples" always means apples eaten (the score), not the snake's length.

**What each setting does**
1. **Grid Size:** the board is Size × Size. The snake starts with 3 cells at the centre heading right. The canvas stays the same pixel size, so cells get smaller as the grid grows.
2. **Game Speed Modifier:** the tempo (BPM) is multiplied by this number. The base BPM is 120, rising 4 for every 4 apples to a cap of 200 (as before); the cap applies before the multiplier. One step is still one sixteenth note, so the step rate scales with the modifier too.
3. **Growth Count:** each apple eaten adds this amount to a growth carry. Whenever the carry reaches a whole number, the snake grows by that many cells and the carry drops by that amount. So 0.1 grows 1 cell every 10th apple, 0.5 grows 1 cell every 2nd apple, 1 grows 1 cell per apple, 4 grows 4 cells per apple, and 0 never grows. The new cells appear one per step as the tail stays in place. The score always goes up by exactly 1 per apple regardless of growth. The carry is computed in whole tenths so no rounding error builds up.
4. **Ghost Time:** how many steps a new obstacle is a harmless ghost before it turns solid. The value is halved for obstacles placed from apple 61 and halved again from apple 121 (a quarter of the setting), each rounded to the nearest whole step: 36 → 18 → 9, 24 → 12 → 6, 12 → 6 → 3. A ghost time of 0 means obstacles are solid the moment they appear.
5–7. **Walls:** when the apple count reaches *Wall Trigger*, place *Wall Count* straight wall segments, each *Wall Size* cells long, once.
8–11. **Bombs:** when the apple count reaches *Bomb Trigger*, bombs start. The target number of bombs is `min(Bomb Spawn Max, Bomb Spawn Count × (1 + floor((apples − Bomb Trigger) ÷ Bomb Spawn Rate)))`, so a batch of *Bomb Spawn Count* bombs is added every *Bomb Spawn Rate* apples, up to the max. Every bomb still jumps to a new spot on every apple.
12–16. **Spawning walls:** from *Wall Spawn Trigger* on, on every apple where `(apples − trigger) ÷ rate` is a whole number, add *Wall Spawn Count* segments of *Wall Spawn Size* cells each, as long as the spawned wall cells stay within *Wall Spawn Max*. The max counts only these spawned walls, not the first walls from items 5–7.
17–20. **Enemies:** the first enemy appears when the apple count reaches *Enemy Spawn Trigger*, each *Enemy Spawn Size* cells long. One more enemy is added every *Enemy Spawn Rate* apples after that, up to *Enemy Spawn Max* (target = `min(max, 1 + floor((apples − trigger) ÷ rate))`). A dead enemy is replaced by a fresh ghost enemy on your next apple.
21. **Moving Wall Trigger:** from this apple on, every apple re-lays all wall segments (same count and sizes) at new random places.
22–23. **Invisible hazards:** walls and bombs placed on or after the *Invisible Hazard Trigger* apple flash as ghosts, turn solid, then fade to fully invisible over *Invisible Hazard Timing* steps while staying solid. Enemies never become invisible.

**The Medium preset keeps today's game.** It reproduces the current rules exactly, apart from three deliberate changes: the Wall Spawn Max counts spawned wall cells only (so the total can reach 92 including the first 12 cells), bombs now also fade from apple 100, and the fade takes 16 steps instead of 40.

**Per-difficulty best score**
- Easy, Medium and Hard each have their own best score, saved separately and shown as "Best" for the active difficulty.
- Custom shows no best score and saves none: the "Best" display is hidden while Custom is active, and a Custom run never writes to storage.
- The old single saved best score becomes Medium's best the first time the new version loads (if Medium has none yet).

**The menu**
- A "Difficulty: Medium" button in the header opens a dialog with a difficulty selector and all 23 settings, grouped (Board, Walls, Bombs, Spawning walls, Enemies, Effects), each with its label and allowed range.
- For Easy, Medium and Hard every field shows that preset's value and is locked (read-only). Only Custom fields are editable.
- Custom values are corrected when you leave the field or press Enter: out-of-range or off-step values are corrected to the nearest allowed value (clamped and rounded to the step), and anything that is not a number reverts to the previous valid value.
- The menu can only be opened or applied when no run is in progress (before the first move, and after game over). While playing, the button is disabled.
- Applying a difficulty starts a fresh run: score 0, no hazards, the beat restarts from bar 1, and the board is redrawn at the new grid size.
- The last chosen difficulty and the Custom values are remembered between visits. The default is Medium.

### Must Not Do
- Never allow a setting outside its range or step, from the menu or from stored data.
- Never save a score for Custom.
- Never let the menu change settings mid-run.
- Never trust stored settings without validating every field.

### Nice to Have
- A "Reset Custom to Medium" button.
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
- `settings`: a plain object with the 23 numeric fields above (camelCase names), always complete and valid.
- Presets: `easy`, `medium`, `hard` constants; `custom` is built from stored values.
- Stored (localStorage): `snake.difficulty` (`easy|medium|hard|custom`), `snake.custom` (JSON of the 23 fields), `snake.highScore.easy|medium|hard` (non-negative integers). The legacy `snake.highScore` is read once as Medium's best.
- The active `settings` live in the game state (`state.settings`); `state.growth` holds `{ carry, pending }` (carry in tenths; pending is cells still to grow).

## Testing Strategy
- **Unit tests (Vitest, TDD):**
  - the three presets equal the table exactly; every preset value is inside its own range and step
  - field validation: clamp to range, round to step, non-numbers rejected; building settings from partial/corrupt custom data fills defaults per field
  - ghost time by apple count: setting G gives G up to apple 60, round(G ÷ 2) for 61–120, round(G ÷ 4) from 121; G = 0 gives 0
  - growth: carries of 0.1, 0.5, 1, 4 and 0 over many apples; pending growth adds one cell per step; score always +1
  - speed: BPM = base × modifier, cap applied before the multiplier
  - grid size: start position is the centre; bounds, neighbours, cell listing, pathing and placement honour any size from 10 to 50
  - bombs: target count formula for the three presets (including Hard: 2 at the trigger, 4 next apple, … 20 at the max) and custom rates
  - spawning walls: trigger, rate, count, size and the cell max
  - enemies: trigger, rate and max; dead ones replaced on the next apple
  - moving walls and invisible hazards: triggers; walls and bombs fade over the configured timing; enemies never fade
  - best scores: separate keys per difficulty, Custom neither read nor written, legacy key migrated to Medium once, tampered values rejected
  - persistence of the chosen difficulty and Custom values, with validation of corrupt data
  - menu: locked fields for presets, editable for Custom, disabled during a run, values clamped on input (DOM-light tests of the pure helpers)
- **Manual only:** the dialog's look and feel, behaviour on a phone, balance of each preset, and how a 50×50 board performs.
- **E2E:** None in v1.

## Open Questions
- Hard is extreme by design (a 40×40 grid at 1.2× speed, growth of 2, bombs reaching 20 by apple 41). Tune by play.
- Extreme Custom values (speed 0.1 gives about 12 BPM; speed 2 gives about 400 BPM; a 10×10 grid with the 5-cell safe zone) are allowed and may be unpleasant; the placement rules simply skip what does not fit.
- A ghost time of 0 removes the telegraph entirely; this is allowed for Custom only because the range includes 0.
