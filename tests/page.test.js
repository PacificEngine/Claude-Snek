import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FIELDS, MUSIC_FIELDS } from '../src/core/difficulty.js';
import { difficultyLabel } from '../src/menu.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);

describe('index.html touch controls', () => {
  it.each(['up', 'down', 'left', 'right'])('has a %s direction button', (direction) => {
    expect(buttons.some((b) => b.includes('data-action="direction"') && b.includes(`data-direction="${direction}"`))).toBe(true);
  });
  it.each(['pause', 'restart', 'mute'])('has a %s button', (action) => {
    expect(buttons.some((b) => b.includes(`data-action="${action}"`))).toBe(true);
  });
  it('gives every button an accessible name and type=button', () => {
    buttons.forEach((b) => {
      expect(b).toContain('aria-label=');
      expect(b).toContain('type="button"');
    });
  });
  it('keeps the page free of inline scripts and styles (CSP)', () => {
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)/);
    expect(html).not.toMatch(/\sstyle=/);
  });
});

describe('style.css touch targets', () => {
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({
    selectors: m[1].split(',').map((s) => s.trim()),
    body: m[2],
  }));
  const muteRules = rules.filter((r) => r.selectors.includes('#mute'));

  it('sizes the Mute button as a touch target of at least 48px', () => {
    const heights = muteRules.map((r) => r.body.match(/min-height:\s*(\d+)px/)).filter(Boolean).map((m) => Number(m[1]));
    expect(Math.max(0, ...heights)).toBeGreaterThanOrEqual(48);
  });
  it('shows pressed and muted states on the Mute button', () => {
    expect(rules.some((r) => r.selectors.some((s) => s.includes('#mute[aria-pressed="true"]')))).toBe(true);
    expect(rules.some((r) => r.selectors.some((s) => s.includes('#mute:active')))).toBe(true);
  });
  it('disables double-tap zoom delay on the Mute button', () => {
    expect(muteRules.some((r) => /touch-action:\s*manipulation/.test(r.body))).toBe(true);
  });
});

describe('start message', () => {
  it('tells touch players that tapping a direction starts the game', () => {
    const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    expect(main).toContain('tap a direction');
  });
});

describe('status messages', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  it('mentions the touch controls when paused', () => {
    expect(main).toContain('Paused — press P or tap Pause to resume');
  });
  it('mentions the touch controls on game over', () => {
    expect(main).toContain('Game over — press Enter or tap Restart');
  });
});

describe('difficulty menu markup', () => {
  it('has an open button, a dialog, a selector with the five difficulties, and Apply and Cancel', () => {
    expect(html).toContain('id="difficulty-open"');
    expect(html).toContain('<dialog id="difficulty-dialog"');
    for (const d of ['easy', 'medium', 'hard', 'frantic', 'random', 'custom']) {
      expect(html).toMatch(new RegExp(`<option value="${d}"`));
    }
    expect(html).toContain('id="difficulty-fields"');
    expect(html).toContain('id="difficulty-apply"');
    expect(html).toContain('id="difficulty-cancel"');
    expect(html).toContain('id="best-wrap"');
  });
  it('lists Frantic between Hard and Random, labelled Frantic', () => {
    expect(html).toMatch(/<option value="hard">Hard<\/option>\s*<option value="frantic">Frantic<\/option>\s*<option value="random">/);
  });
  it('lists Random between Frantic and Custom, labelled Random', () => {
    expect(html).toMatch(/<option value="frantic">Frantic<\/option>\s*<option value="random">Random<\/option>\s*<option value="custom">/);
    expect(difficultyLabel('random')).toBe('Random');
  });
  it('locks every field except for Custom, with notes for presets and for Random', () => {
    const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
    expect(menu).toContain("draftDifficulty !== 'custom'");
    expect(menu).toContain('Random: every setting, Music included, changes each new game. Your own Music comes back when you choose another difficulty.');
    expect(menu).toContain('These values are locked. Choose Custom to edit them.');
  });
  it('shows the current roll for Random and hands the previewed roll to onApply', () => {
    const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
    expect(menu).toContain('current.settings');
    expect(menu).toContain('onApply(draftDifficulty, draftCustom, draftRoll, draftMusic, draftMusicRandom, draftMusicRoll)');
  });
  it('labels every difficulty in the menu', () => {
    expect(difficultyLabel('frantic')).toBe('Frantic');
    expect(difficultyLabel('hard')).toBe('Hard');
  });
  it('keeps every button an accessible type=button (the dialog buttons too)', () => {
    const all = [...html.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
    expect(all.length).toBeGreaterThanOrEqual(10);
    all.forEach((b) => { expect(b).toContain('type="button"'); expect(b).toContain('aria-label='); });
  });
  it('builds the fields with DOM APIs, not innerHTML', () => {
    const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
    expect(menu).not.toMatch(/innerHTML|insertAdjacentHTML|eval\(/);
    expect(menu).toContain('createElement');
  });
  it('renders list fields as numeric-keyboard text inputs showing the formatted list', () => {
    const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
    expect(menu).toContain('formatList');
    expect(menu).toContain("'numeric'");
    expect(menu).toMatch(/inputMode|inputmode/);
    expect(menu).not.toContain('.pattern');
  });
  it('groups the difficulty fields under nine headings, each group contiguous in FIELDS order; Music is its own set', () => {
    const groups = FIELDS.map((f) => f.group);
    const headings = groups.filter((g, i) => g !== groups[i - 1]);
    expect(headings).toEqual(['Board', 'BPM', 'Growth', 'Ghost', 'Walls', 'Bombs', 'Spawning walls', 'Enemies', 'Effects']);
    expect(new Set(MUSIC_FIELDS.map((f) => f.group))).toEqual(new Set(['Music']));
  });
  it('makes text inputs full width in the single-column layout', () => {
    const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.field input[^{]*\{[^}]*(width:\s*100%|box-sizing)/);
  });
  it('does not let the game keys fire while the dialog is open', () => {
    const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    expect(main).toContain("dialog[open]");
  });
  it('styles locked fields and lets the dialog scroll inside itself', () => {
    const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    expect(css).toMatch(/dialog[^{]*\{[^}]*overflow/);
    expect(css).toMatch(/\.locked|\[readonly\]/);
  });
});

describe('main.js Random wiring', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const body = (name) => main.slice(main.indexOf(`function ${name}(`), main.indexOf('\n}\n', main.indexOf(`function ${name}(`)));
  it('passes Math.random only at the call sites into settingsFor', () => {
    expect(main).toContain('settingsFor(difficulty, custom, Math.random)');
  });
  it('rolls the next settings when a run ends so the dialog shows what the next run uses', () => {
    expect(body('advance')).toMatch(/gameOver[\s\S]*settings = nextSettings\(\)/);
  });
  it('rebuilds state from the pre-rolled settings on restart', () => {
    expect(body('restart')).toContain('createState(Math.random, settings)');
  });
  it('rolls at apply, unless the dialog handed over the roll it previewed', () => {
    const apply = body('applyDifficulty');
    expect(apply).toContain('roll');
    expect(apply).toContain('nextSettings(');
  });
  it('hands the menu the current settings and an rng', () => {
    expect(main).toContain('getCurrent: () => ({ difficulty, custom, music, musicRandom, settings })');
    expect(main).toContain('rng: Math.random');
  });
});

describe('main.js keyboard handling', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  it("lets Enter reach a focused button, select or input instead of restarting", () => {
    expect(main).toContain("event.key === 'Enter' && event.target.closest?.('button, select, input')");
    expect(main.indexOf("event.key === 'Enter'")).toBeLessThan(main.indexOf('actionForKey(event.key)'));
  });
});

describe('music settings in the menu', () => {
  const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  it('builds a Music fieldset from MUSIC_FIELDS, editable except while Random is selected', () => {
    expect(menu).toContain('MUSIC_FIELDS.forEach');
    expect(menu).toContain("addGroup('Music')");
    expect(menu).toContain('musicInputs.set(field.key, input)');
    const show = menu.slice(menu.indexOf('function showMusic('), menu.indexOf('\n  }\n', menu.indexOf('function showMusic(')));
    expect(show).toContain("draftDifficulty === 'random'");
    expect(show).toContain('draftRoll[field.key]');
    expect(show).toContain('draftMusic[field.key]');
    expect(show).toContain('draftMusicRoll[field.key]');
    expect(show).toContain('const locked = rolled || draftMusicRandom');
    expect(show).toContain('input.readOnly = locked');
    expect(show).toContain("input.classList.toggle('locked', locked)");
    expect(show).toContain('resetBtn.disabled = locked');
  });
  it('never writes the roll into the player\'s draft music', () => {
    const assigns = [...menu.matchAll(/draftMusic = ([^;]*);/g)].map((m) => m[1]);
    expect(assigns).toEqual(['copySettings(DEFAULT_MUSIC)', 'applyEdit(draftMusic, field, raw)', 'copySettings(DEFAULT_MUSIC)', 'randomMusic(rng)', 'copySettings(current.music)']);
    expect(menu).toContain('draftMusic = copySettings(current.music)');
  });
  it('has a Reset to default button inside the Music fieldset', () => {
    expect(menu).toContain("'Reset to default'");
    expect(menu).toContain("'Reset to default, music'");
    expect(menu).not.toContain("'Reset music to default'");
    expect(menu).toContain("resetBtn.type = 'button'");
    expect(menu).toContain('DEFAULT_MUSIC');
  });
  it('edits a copy of the music, corrected on change, and applies it with the choice', () => {
    expect(menu).toContain('draftMusic = copySettings(current.music)');
    expect(menu).toContain('draftMusic = applyEdit(draftMusic, field, raw)');
    expect(menu).toContain('onApply(draftDifficulty, draftCustom, draftRoll, draftMusic, draftMusicRandom, draftMusicRoll)');
  });
  it('tells preset users that Music stays editable', () => {
    expect(menu).toContain('Music is always editable.');
  });
  it('lays the reset button out inside the narrow dialog', () => {
    expect(css).toMatch(/\.music-reset[^{]*\{[^}]*min-height:\s*44px/);
  });
  it('main keeps music state, merges it into every settings build and saves it on apply', () => {
    expect(main).toContain('let music = loadMusic()');
    expect(main).toContain('saveMusic(music)');
    expect(main).not.toMatch(/saveMusic\((?!music\))/);
    expect(main).not.toMatch(/music = (?!loadMusic\(\)|nextMusic)/);
    expect(main).toContain('let musicRandom = loadMusicRandom()');
    expect(main).toContain('saveMusicRandom(musicRandom)');
    expect(main).toContain('getCurrent: () => ({ difficulty, custom, music, musicRandom, settings })');
    expect(main).toContain('getCurrent: () => ({ difficulty, custom, music, musicRandom, settings })');
    expect(main).not.toMatch(/settings = settingsFor\(/);
    expect(main).toContain('settingsWithMusic(difficulty, settingsFor(difficulty, custom, Math.random), gameMusic)');
    expect(main).toContain('musicForGame(difficulty, music, musicRandom, Math.random)');
  });
  it('main builds the initial, game-over and applied settings through the merge', () => {
    const body = (name) => main.slice(main.indexOf(`function ${name}(`), main.indexOf('\n}\n', main.indexOf(`function ${name}(`)));
    expect(main).toMatch(/let settings = nextSettings\(\)/);
    expect(body('advance')).toContain('settings = nextSettings()');
    expect(body('applyDifficulty')).toContain("settingsWithMusic('random', roll, music)");
    expect(body('applyDifficulty')).toContain('nextSettings(');
  });
});

describe('Reroll and Randomize buttons', () => {
  const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const fn = (name) => menu.slice(menu.indexOf(`function ${name}(`), menu.indexOf('\n  }\n', menu.indexOf(`function ${name}(`)));
  it('has a Reroll button with its visible text in its accessible name', () => {
    expect(menu).toContain("rerollBtn.type = 'button'");
    expect(menu).toContain("rerollBtn.textContent = 'Reroll'");
    expect(menu).toContain("'Reroll, random settings'");
  });
  it('rerolls a fresh roll from the injected rng, music included, and refreshes', () => {
    expect(menu).toMatch(/rerollBtn\.addEventListener\('click', \(\) => \{\s*draftRoll = settingsFor\('random', null, rng\);\s*refresh\(\);/);
  });
  it('shows and enables Reroll only while Random is selected', () => {
    expect(fn('refresh')).toContain("rerollBtn.hidden = draftDifficulty !== 'random'");
    expect(fn('refresh')).toContain("rerollBtn.disabled = draftDifficulty !== 'random'");
    expect(css).toMatch(/\.reroll\[hidden\][^{]*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.reroll[^{]*\{[^}]*min-height:\s*44px/);
  });
  it('has a Randomize button next to Reset inside the Music fieldset', () => {
    expect(menu).toContain("randomizeBtn.textContent = 'Randomize'");
    expect(menu).toContain("'Randomize, music'");
    expect(menu).toContain('musicEl.append(resetBtn, randomizeBtn)');
    expect(css).toMatch(/\.music-randomize[^{]*\{[^}]*min-height:\s*44px/);
  });
  it('randomizes only the draft music with randomMusic(rng), disabled while Random is selected', () => {
    expect(menu).toMatch(/randomizeBtn\.addEventListener\('click', \(\) => \{\s*draftMusic = randomMusic\(rng\);\s*showMusic\(\);/);
    expect(fn('showMusic')).toContain('randomizeBtn.disabled = locked');
  });
});

describe('Randomize every game toggle', () => {
  const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const fn = (name) => menu.slice(menu.indexOf(`function ${name}(`), menu.indexOf('\n  }\n', menu.indexOf(`function ${name}(`)));
  it('is a real labelled checkbox built with DOM APIs', () => {
    expect(menu).toContain("toggle.type = 'checkbox'");
    expect(menu).toContain("toggle.id = 'music-random'");
    expect(menu).toContain("toggleText.textContent = 'Randomize every game'");
    expect(menu).toMatch(/toggleLabel = document\.createElement\('label'\)/);
    expect(menu).toContain('toggleLabel.append(toggle, toggleText)');
    expect(css).toMatch(/\.music-toggle[^{]*\{[^}]*min-height:\s*44px/);
  });
  it('keeps the draft in the dialog and rolls a fresh preview when ticked', () => {
    expect(menu).toMatch(/toggle\.addEventListener\('change', \(\) => \{\s*draftMusicRandom = toggle\.checked;\s*if \(draftMusicRandom\) draftMusicRoll = randomMusic\(rng\);\s*showMusic\(\);/);
  });
  it('is disabled under Random and checked from the draft', () => {
    expect(fn('showMusic')).toContain('toggle.disabled = rolled');
    expect(fn('showMusic')).toContain('toggle.checked = draftMusicRandom');
  });
  it('previews the current game\'s roll on open and hands the toggle and roll to onApply', () => {
    expect(menu).toContain('draftMusicRandom = current.musicRandom');
    expect(menu).toContain('onApply(draftDifficulty, draftCustom, draftRoll, draftMusic, draftMusicRandom, draftMusicRoll)');
  });
  it('main saves only the toggle and the player\'s own music on apply, and rolls the game music at every re-roll point', () => {
    const apply = main.slice(main.indexOf('function applyDifficulty('), main.indexOf('\n}\n', main.indexOf('function applyDifficulty(')));
    expect(apply).toContain('musicRandom = nextMusicRandom');
    expect(apply).toContain('saveMusicRandom(musicRandom)');
    expect(apply).toContain('saveMusic(music)');
    expect(apply).toContain('nextSettings(musicRandom ? musicRoll : undefined)');
    expect(main).toContain('const nextSettings = (gameMusic = musicForGame(');
  });
});
