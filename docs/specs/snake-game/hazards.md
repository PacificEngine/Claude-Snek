# Hazards

## Overview
Obstacles that appear as the player eats apples and make the board harder: static walls, a moving bomb, per-apple walls, an enemy snake, and walls that are re-laid after every apple. Each is introduced at a music tier (tier = floor(apples ÷ 8)). Every new or moved obstacle is telegraphed so the player has time to react, and a route from the snake's head to the food always exists.

## Parent Domain
`./snake-game.md`

## Dependencies
- Apples eaten and music tier (`pacing.js`: tier = min(10, floor(apples ÷ 8))).
- The game step (one step per sixteenth note, from the beat clock).
- Food placement and the snake's body in the core game state.

## Personas
- **Developer-player (you):** wants the game to escalate in difficulty alongside the music, and to feel fair rather than random.

## Core Requirements

### Must Have

**Introduction by tier** (apples in parentheses; a feature starts on the apple that reaches its tier):
- **Tier 2 (16):** 4 wall segments, each a straight line of 3 cells (random orientation), placed once. They stay put until tier 10.
- **Tier 4 (32):** one bomb (a single cell). On every apple eaten after that, the bomb moves to a new random cell.
- **Tier 6 (48):** on every apple eaten, one new 2-cell wall segment is added. Total wall cells are capped at 80.
- **Tier 8 (64):** an enemy snake, 3 cells long, appears.
- **Tier 10 (80):** on every apple eaten, all wall segments are re-laid in new random positions (same count and lengths). The old cells clear immediately; the new ones are telegraphed.
- **100 apples and above:** walls placed by a re-lay flash while telegraphed, turn solid, then fade slowly to fully invisible over 40 steps. They stay solid while invisible. Walls placed before 100 apples never fade.

**Telegraph (time to react):**
- Every new or moved obstacle (wall, bomb, enemy respawn) first appears as a ghost: a flashing outline that cannot hurt the snake. After 24 steps it turns solid (about 3 s at 120 BPM, 1.8 s at 200 BPM).
- In the last 4 steps before a ghost turns solid it stays steadily visible (no flashing) so the player always sees it just before it becomes dangerous.
- A ghost does not turn solid while any part of the snake is on one of its cells; it stays a ghost until the cell is clear.
- The ghost flashes by toggling visibility every 4 steps, which is never more than about 1.7 flashes per second (under the 3 per second accessibility limit). With `prefers-reduced-motion`, it is a steady outline instead of flashing.

**Safe placement:**
- Nothing is placed within 5 cells (Manhattan) of the snake's head, or in the 10 cells straight ahead of the head in its current direction.
- Nothing is placed on the snake, the food, another obstacle, or the enemy.
- A placement is retried up to 50 times; if no valid position is found it is skipped (the board is never blocked to force one).

**Always a valid path to the food:**
- After every placement, a breadth-first search must find a route from the head to the food through cells that are not solid or ghost walls, the bomb (solid or ghost), the enemy, or snake-body cells that will still be occupied when the head would reach them. A body cell `i` steps behind the head (head is 0) is vacated after `length − i` steps.
- A placement that breaks the route is rejected and retried.
- On each apple, the new food is placed first on a free, reachable cell, then the hazards for that apple are placed and checked against it.
- The enemy's moves are also checked: it will not step to a cell that would cut the route.

**Collisions:**
- The snake dies when its head enters a solid wall, the solid bomb, a live enemy, or a dead enemy.
- A ghost is harmless to enter. A ghost enemy neither moves nor kills.

**Enemy snake:**
- 3 cells, moves one cell every 2nd step, picking uniformly at random among safe moves. A move is safe if the cell is in bounds and free of walls (solid or ghost), the bomb, the player's snake, and its own body, and does not break the route to the food. It never reverses.
- If it has no safe move it dies. It stays on the board as a grey dead obstacle (solid, kills the player) until the next apple is eaten.
- On the next apple eaten, the dead enemy is replaced by a new ghost enemy (telegraphed like any obstacle), which then becomes live. If no safe position is found it stays as a dead obstacle (as the bomb keeps its old cell) and the respawn is retried on the following apple.
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
- No obstacle ever exceeds the 80-cell wall cap.

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
- Obstacles are drawn on the same canvas as the snake with the shapes above.
- Fading walls reduce opacity by step count; invisible walls at 100+ apples are intentional (hard mode) and give no on-screen cue.
- Flashing never exceeds 3 per second and is replaced by a steady outline under `prefers-reduced-motion`.

## Data Model
- `hazards` in the game state:
  - `walls`: list of segments `{cells: Cell[], age: number, fades: boolean}`; `age` counts steps since placement. A segment is a ghost while `age < 24` or while the snake occupies a cell of it; otherwise solid. If `fades`, opacity falls from 1 to 0 over the 40 steps after it turns solid.
  - `bomb`: `{cells: [cell], age}` or `null`.
  - `enemy`: `{cells: Cell[] (head first), age, status: 'ghost'|'alive'|'dead'}` or `null`.
- Derived: tier from apples eaten; which hazards exist at that tier; ghost/solid/visible per obstacle from `age`.

## Testing Strategy
- **Unit tests (Vitest, TDD, injected rng):**
  - hazards appear exactly at their tier/apple thresholds and not before
  - segment placement: lengths, orientation, bounds, never on snake/food/obstacles, safe distance and lane exclusion, retry then skip
  - route check: finds a route, rejects a blocked one, honours tail vacating, counts ghosts as blocking
  - food placement only on reachable free cells
  - bomb moves on each apple; per-apple walls added and capped at 80; tier-10 re-lay keeps count and lengths
  - ghost to solid after 24 steps; stays ghost while the snake is on it
  - collisions: solid wall/bomb/live enemy/dead enemy kill, ghosts do not
  - enemy: moves every 2nd step, safe-move filter, never breaks the route, dies when trapped, stays as obstacle, respawns on next apple as a ghost
  - fade: opacity curve over 40 steps only for walls placed at 100+ apples
  - flash visibility toggles every 4 steps; steady under reduced motion
  - restart clears everything
- **Manual only:** how the obstacles look and feel, difficulty balance, and reaction time at high tempo.
- **E2E:** None in v1.

## Open Questions
- Segment sizes, counts, the 24-step telegraph, the wall cap of 80, and the enemy speed are first guesses and are tuned by playing; expect revisions.
- At 100+ apples walls give no on-screen cue once faded (chosen deliberately); revisit if it proves unplayable.
- The enemy may step into the cell directly ahead of the snake's head (spec-compliant, leaves one step to react); revisit after play.
