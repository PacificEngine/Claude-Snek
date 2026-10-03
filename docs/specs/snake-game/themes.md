# Themes

## Overview
A theme sets the colour and shape of every object on the board. There is one theme per soundtrack (same name), each editable; the game can use the theme that matches the playing soundtrack, a chosen theme, a random theme per game, or a fully random style per game. Themes are edited in a **Theme** group of the options menu, below Music.

## Parent Domain
`./snake-game.md`

## Dependencies
- The renderer (`src/renderer.js`) draws every object from the active theme.
- The soundtracks (`./difficulty.md`, Soundtracks): themes are named after and matched to them.
- Browser localStorage for the edited themes and the toggles.

## Core Requirements

### Must Have

**What a theme contains**
- Colours (hex `#rrggbb`) for: board background, grid lines, snake head, snake body, apple, wall, bomb, bomb spark, enemy head, enemy body, dead enemy.
- A shape for each drawable object: snake head, snake body, apple, wall, bomb, enemy head, enemy body, dead enemy. Shapes: square, rounded square, circle, diamond, triangle, hexagon, star, cross. A ghost (an obstacle that is not solid yet) is drawn as the dashed outline of its object's shape in the object's colour.
- The Classic theme reproduces today's look exactly (today's colours and shapes: rounded squares for snake and enemies, circle apple, square walls, diamond bomb with a spark, cross on dead enemy cells drawn over a rounded square in grey).

**Twelve default themes, one per soundtrack** (id = the soundtrack id, name = the soundtrack name): Classic, Sunrise (warm light), Midnight (deep blue/indigo, dark board), Neon (dark board, cyan/magenta/lime glow colours), Tropic (sand board, teal/coral/yellow), Haunted (near-black board, violet/bone/orange), Parade (cream board, red/blue/gold), Abyss (deep teal board, bioluminescent greens/blues), Dune (sand/ochre board, terracotta/rust), Disco (dark purple board, gold/hot pink/cyan), Storm (slate board, lightning yellow/steel/red), Lullaby (pale pastel board, soft pink/lavender/mint). Every default theme must keep every object readable against its board colour (contrast of at least 3:1 for each object colour against the board background) and keep wall, bomb and enemy shapes pairwise different.

**Menu: the Theme group** (a collapsible group below Music, collapsed when the dialog opens)
1. **Theme to Edit** dropdown listing the twelve themes by soundtrack name. It chooses which theme's colours and shapes are shown and edited. It is also the *selected theme* used when Match Theme with Soundtrack is off.
2. Three checkboxes, in this order:
   a. **Match Theme with Soundtrack** — default checked. When checked, the active theme is the theme of the soundtrack that is playing this game. When unchecked, the active theme is the one selected in Theme to Edit (saved on Apply).
   b. **Randomize Theme on Every Game** — each new game uses a randomly chosen theme out of the twelve (as edited).
   c. **Randomize Style on Every Game** — each new game gets a freshly generated style: every colour and every shape is randomized. A generated style is never saved.
   Precedence when several apply: Randomize Style, then Randomize Theme, then Match Theme with Soundtrack, then the selected theme. A saved edit is never overwritten by any randomization.
3. The colour and shape fields of the theme being edited: one colour input (`type=color`, with its hex shown and editable) and, for drawable objects, one shape select per object, each with a clear label ("Snake Head Colour", "Snake Head Shape"…).
4. A live **preview** (a small canvas) showing every object of the theme being edited.
5. **Randomize** and **Reset to default** buttons at the bottom of the group, acting on the theme being edited: Randomize generates a random style into the draft, Reset restores that theme's built-in default. Both are disabled while Randomize Style on Every Game is checked, and the fields are then disabled with a note.
- Edits are draft values until Apply (Cancel discards), like Music. Invalid colours revert to the previous valid value.

**Random style generator (pure, injected rng)**
- Picks a board background and then colours for every object with at least 3:1 contrast against the background (retrying a bounded number of times, falling back to black or white), a grid colour close to the board colour (subtle), distinct colours for snake, apple, wall, bomb and enemy, and a shape per object such that wall, bomb and enemy shapes are pairwise different.

**Storage**
- `snake.themes` (JSON object keyed by theme id; each theme validated field by field, defaulting to that theme's built-in default), `snake.themeChoice` (a theme id, default classic), `snake.themeMatch` (`true|false`, default true), `snake.themeRandom` and `snake.styleRandom` (`true|false`, default false). All access is guarded and validated: colours must match `^#[0-9a-fA-F]{6}$`, shapes must be one of the eight names.

**Per game**
- The active theme is decided at the same points as the soundtrack and the triggers (initial load, Apply, after each game over). It never changes mid-run, except that, with Match on, changing the header soundtrack selector switches to the new soundtrack's theme at once.

### Must Not Do
- Never read colours into the DOM as HTML or CSS text from storage without validating them.
- Never save a randomized style or a per-game random pick over the player's saved themes.
- Never make a shape the only difference that identifies a hazard type when randomizing: wall, bomb and enemy must keep different shapes.

## Technical Constraints
- Vanilla JS, ES modules, no build step, yarn only. Theme data and the random generator are pure (injected rng). The renderer only takes the theme as a parameter.
- Menu built with createElement/textContent; colour inputs are the native `input type=color`.

## Security
Stored values are validated against a strict hex pattern and a fixed shape list before use; nothing from storage is inserted as HTML.

## UX/UI
- The group fits a 320 px dialog (fields stack in one column), all controls are keyboard operable with real labels, and the preview has a text alternative.

## Testing Strategy
- Unit: theme sanitize (bad colours/shapes/unknown ids), the twelve defaults (contrast ≥ 3:1 for each object colour, pairwise-different hazard shapes, names equal soundtrack names, Classic equals the old constants), random style (validity, contrast, distinct hazard shapes, determinism), `themeForGame` precedence table, storage round-trips and corrupt data.
- Renderer: shape path functions (each shape produces a path inside its cell), render uses theme colours (fake context recording calls), ghost outline uses the object's shape.
- Source-level page tests for the menu wiring, as elsewhere. Manual: how each theme looks.

## Open Questions
- The default themes' exact palettes will be tuned by eye.
