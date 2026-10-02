# Hazards

## Overview
Obstacles that appear as the player eats apples and make the board harder: first walls, a growing swarm of moving bombs, spawning walls, enemy snakes, walls that are re-laid after every apple, and hazards that fade from sight. Each starts at an apple count set by the active difficulty (see `./difficulty.md`; the numbers below are the Medium preset). Every new or moved obstacle is telegraphed so the player has time to react, and a route from the snake's head to the food always exists.

## Parent Domain
`./snake-game.md`

## Dependencies
- Apples eaten (the score) and the active difficulty settings (`./difficulty.md`). The music tier no longer controls hazards.
- The board's grid size, which comes from the settings.
- The game step (one step per sixteenth note, from the beat clock).
- Food placement and the snake's body in the core game state.

## Personas
- **Developer-player (you):** wants the game to escalate in difficulty alongside the music, and to feel fair rather than random.

## Core Requirements

### Must Have

**Introduction by apple count** (every number below is a difficulty setting; the figures shown are Medium; a feature starts on the apple whose count reaches its trigger):
- **First walls (Wall Trigger 16, Wall Size 3, Wall Count 4):** that many straight wall segments (random orientation), placed once. They stay put until the moving-wall effect starts.
- **Bombs (Bomb Trigger 32, Spawn Rate 4, Spawn Count 1, Spawn Max 12):** bombs are single cells. When the apple count reaches the trigger, bombs start. The target number of bombs is `min(max, count × (1 + floor((apples − trigger) ÷ rate)))`, so a batch of `count` bombs is added every `rate` apples. On every apple eaten, every bomb moves to a new random cell: the old cell clears immediately and the new one is telegraphed as a ghost. A bomb that cannot be moved (no valid spot found) stays where it is.
- **Spawning walls (Trigger 48, Size 2, Rate 1, Count 1, Max 80 cells):** from the trigger, on every apple where `(apples − trigger) ÷ rate` is a whole number, add `count` wall segments of `size` cells, as long as the total of these spawned wall cells stays within the max. The max counts only spawned walls, not the first walls.
- **Enemies (Trigger 64, Size 3, Rate 5, Max 1):** the first enemy snake appears at the trigger; one more is added every `rate` apples after that, up to the max (target = `min(max, 1 + floor((apples − trigger) ÷ rate))`).
- **Moving walls (Moving Wall Trigger 80):** from this apple on, every apple eaten re-lays all wall segments in new random positions (same count and lengths). The old cells clear immediately; the new ones are telegraphed.
- **Invisible hazards (Trigger 100, Timing 16 steps):** walls and bombs placed on or after this apple flash while telegraphed, turn solid, then fade to fully invisible over the Timing steps. They stay solid while invisible. Walls and bombs placed earlier never fade, and enemies never fade.

**Telegraph (time to react):**
- Every new or moved obstacle (wall, bomb, enemy respawn) first appears as a ghost: a flashing outline that cannot hurt the snake. After its ghost time it turns solid.
- The ghost time comes from the Ghost Time setting (Medium: 24 steps) and depends on the apple count at the moment the obstacle is placed: the full setting up to and including apple 60, half of it (rounded to a whole step) from apple 61 to apple 120, and a quarter of it (rounded) from apple 121 on. For Medium that is 24, 12 and 6 steps (about 3 s, 1.5 s and 0.45 s at 120–200 BPM). It applies to every obstacle (walls, bombs, enemies). Each obstacle keeps the ghost time it was created with, so crossing apple 60 or 120 does not shorten obstacles already on the board. A ghost time of 0 means the obstacle is solid the moment it is placed.
- In the last 4 steps of its ghost time it stays steadily visible (no flashing) so the player always sees it just before it becomes dangerous. A ghost time of 6 or less therefore never flashes off at all; it is steadily visible for its whole life.
- A ghost does not turn solid while any part of the snake is on one of its cells; it stays a ghost until the cell is clear.
- The ghost flashes by toggling visibility every 4 steps, which is never more than about 1.7 flashes per second (under the 3 per second accessibility limit). With `prefers-reduced-motion`, it is a steady outline instead of flashing.

**Safe placement:**
- Nothing is placed within 5 cells (Manhattan) of the snake's head, or in the 10 cells straight ahead of the head in its current direction.
- Nothing is placed on the snake, the food, or another obstacle (wall, bomb or enemy).
- Placement works on whatever grid size the settings give (10 to 50); on a small grid more placements simply fail and are skipped.
- A placement is retried up to 50 times; if no valid position is found it is skipped (the board is never blocked to force one).

**Always a valid path to the food:**
- After every placement, a breadth-first search must find a route from the head to the food through cells that are not solid or ghost walls, any bomb (solid or ghost), any enemy, or snake-body cells that will still be occupied when the head would reach them. A body cell `i` steps behind the head (head is 0) is vacated after `length − i` steps, plus the cells the snake is still due to grow (they keep the tail in place).
- A placement that breaks the route is rejected and retried.
- On each apple, the new food is placed first on a free, reachable cell, then the hazards for that apple are placed and checked against it.
- Every enemy's moves are also checked: it will not step to a cell that would cut the route.

**Collisions:**
- The snake dies when its head enters a solid wall, a solid bomb, a live enemy, or a dead enemy.
- A ghost is harmless to enter. A ghost enemy neither moves nor kills.
- A wall or bomb that is fading or fully invisible is still solid.

**Enemy snakes** (each follows these rules independently):
- `Enemy Spawn Size` cells long, moves one cell every 2nd step, picking uniformly at random among safe moves. A move is safe if the cell is in bounds and free of walls (solid or ghost), any bomb, the player's snake, and its own body, and does not break the route to the food. It never reverses.
- If it has no safe move it dies. It stays on the board as a grey dead obstacle (solid, kills the player) until the next apple is eaten.
- On the next apple eaten, every dead enemy is replaced by a new ghost enemy (telegraphed like any obstacle), which then becomes live. If no safe position is found it stays as a dead obstacle (as a bomb keeps its old cell) and the respawn is retried on the following apple. New enemies up to the target count are added at the same time.
- A live enemy also dies if the player's snake (or anything solid) ends up on it; only a dead or live enemy blocking the head kills the player.

**Reset:** restarting the game clears all hazards.

**Visual language** (shape, not only color):
- Walls: dark slate squares.
- Bomb: a dark diamond with a small spark marker.
- Enemy: a purple snake of rounded squares with a head marker; dead: grey with a cross.
- Ghosts: a dashed outline with a light fill.

### Must Not Do
- Never place an obstacle that makes the food unreachable.
- Never spawn an obstacle without telegraphing it.
- Never turn a ghost solid under the snake.
- Never have more bombs, spawned wall cells or enemies than the settings' maxima.

### Nice to Have
- A short sound cue when an obstacle turns solid.

## Technical Constraints
- Pure core logic, no DOM or audio access; all randomness injected (`rng`) so tests are deterministic.
- Ghost flashing and fading are derived from step counters, not animation frames, so they are deterministic and testable and stay on the beat.
- Vanilla JavaScript with ES modules, no build step, zero runtime dependencies; yarn only; TDD.

## Resilience
No external dependencies. No resilience strategy required. If a valid placement cannot be found, the placement is skipped; the game never stalls or blocks the food.

## Observability
None beyond the parent spec. Placement failures are silent (skipped), not logged.

## Security
No new attack surface; hazards are internal game state.

## Performance & Scalability
- The route check is a breadth-first search over at most 400 cells; at most 50 attempts per placement and a handful of placements per apple, so cost per apple is negligible.
- Enemy moves run one route check per candidate move, every 2nd step.

## UX/UI
- Obstacles are drawn on the same canvas as the snake with the shapes above, sized to the current grid.
- Fading walls and bombs reduce opacity by step count over the Invisible Hazard Timing; fully invisible hazards are intentional and give no on-screen cue.
- Flashing never exceeds 3 per second and is replaced by a steady outline under `prefers-reduced-motion`.

## Data Model
- `hazards` in the game state:
  - `walls`: list of segments `{cells: Cell[], age, telegraph, fades: boolean, fadeSteps: number, origin: 'first'|'spawn'}`; `age` counts steps since placement and `telegraph` is the ghost time fixed when it was placed. A segment is a ghost while `age < telegraph` or while the snake occupies a cell of it; otherwise solid. If `fades`, opacity falls from 1 to 0 over `fadeSteps` steps after it turns solid. `origin` lets the spawned-wall cell maximum count only spawned walls.
  - `bombs`: list of `{cells: [cell], age, telegraph, fades, fadeSteps}`.
  - `enemies`: list of `{cells: Cell[] (head first), age, telegraph, status: 'ghost'|'alive'|'dead'}`.
- Derived: which hazards exist and how many from apples eaten and the settings (bomb, spawned-wall and enemy targets); the ghost time for a new obstacle from the apple count and the Ghost Time setting; ghost/solid/visible per obstacle from `age` and `telegraph`.

## Testing Strategy
- **Unit tests (Vitest, TDD, injected rng):**
  - each hazard appears exactly at its settings' apple trigger and not before, for any trigger from 1 to 100
  - segment placement: lengths, orientation, bounds, never on snake/food/obstacles, safe distance and lane exclusion, retry then skip
  - route check: finds a route, rejects a blocked one, honours tail vacating, counts ghosts as blocking
  - food placement only on reachable free cells
  - bomb target: `min(max, count × (1 + floor((apples − trigger) ÷ rate)))` for the presets (Easy 1/4/6, Medium 1/4/12, Hard 2/1/20) and custom values; every bomb relocates on each apple; a bomb that cannot move stays put; a new bomb that cannot be placed is skipped
  - spawning walls: trigger, rate, count, size, and the spawned-cell maximum (first walls not counted)
  - enemies: first at the trigger, one more every rate apples up to the max, dead ones replaced on the next apple
  - moving walls re-lay keeps count and lengths from the moving trigger on
  - ghost time by apple count: setting G up to apple 60, round(G ÷ 2) for 61-120, round(G ÷ 4) from 121; 0 means solid immediately; each obstacle keeps its own; ghost to solid after its own ghost time; stays ghost while the snake is on it
  - collisions: solid wall/bomb/live enemy/dead enemy kill, ghosts do not
  - enemy: moves every 2nd step, safe-move filter, never breaks the route, dies when trapped, stays as obstacle, respawns on next apple as a ghost
  - fade: opacity falls over the configured timing, only for walls and bombs placed on or after the invisible trigger; enemies never fade
  - flash visibility toggles every 4 steps; steady under reduced motion
  - restart clears everything
- **Manual only:** how the obstacles look and feel, difficulty balance, and reaction time at high tempo.
- **E2E:** None in v1.

## Open Questions
- The preset numbers (see `./difficulty.md`) and the enemy speed are first guesses and are tuned by playing; expect revisions.
- Once hazards fade (from the invisible trigger) they give no on-screen cue (chosen deliberately); revisit if it proves unplayable.
- The enemy may step into the cell directly ahead of the snake's head (spec-compliant, leaves one step to react); revisit after play.
