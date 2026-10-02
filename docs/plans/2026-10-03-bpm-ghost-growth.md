# BPM, ghost lists, max size — plan

Spec: docs/specs/snake-game/difficulty.md (28 settings), hazards.md. Yarn, TDD (red then green, one commit per task, messages explain why, no Claude signature), no innerHTML.

1. **Settings model** (`src/core/difficulty.js`, `src/storage.js`, tests): replace `speed` with `initialBpm`/`finalBpm`/`bpmScale`; add `maxLength`, `ghostHalves`, `invisibleHalves` (list fields, default [60,120,180,240] / [200,400,600,800]); triggers 1-1000; headings Board/BPM/Growth/Ghost/...; presets per spec table; `clampField`/`sanitize`/`applyEdit` handle list fields (parse comma text, trim, round, clamp 1-1000, drop non-numbers, max 10 entries, keep previous if nothing valid); `settingsFor` returns frozen presets with frozen arrays; custom storage round-trips arrays and ignores the old `speed`.
2. **Core rules** (`pacing.js`, `hazards.js`, `game.js`, `main.js`, tests): `bpm(apples, s)` per apple toward final; ghost time and invisible timing halved (ceil, min 1 for timing, 0 stays 0) once per list entry below the apple count; Max Snake Size stops growth (drop pending and carry); update all callers/tests.
3. **Menu** (`src/menu.js`, `index.html`, `style.css`, page tests): grouped under the new headings; list fields as a text input with comma list, read-only for presets, corrected on change; Reset not needed.
4. **Controller**: full test run, settings-aware bot sim, browser check, final review, squash.
