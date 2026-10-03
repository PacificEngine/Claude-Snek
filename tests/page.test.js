import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FIELDS, MUSIC_FIELDS } from '../src/core/difficulty.js';
import { difficultyLabel, labelsFor } from '../src/menu.js';

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
  it('leaves every difficulty field editable and turns an edit of a preset or roll into Custom', () => {
    const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
    const refreshBody = menu.slice(menu.indexOf('function refresh()'), menu.indexOf("select.addEventListener('change'"));
    expect(refreshBody).not.toContain('readOnly');
    expect(menu).toContain("sanitize(draftDifficulty === 'random' ? draftRoll : settingsFor(draftDifficulty))");
    expect(menu).toMatch(/draftCustom = next;\s*draftDifficulty = 'custom';\s*select\.value = 'custom';\s*refresh\(\);/);
  });
  it('does not switch to Custom when the edit leaves the value unchanged (junk text)', () => {
    const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
    expect(menu).toContain("JSON.stringify(next[field.key]) === JSON.stringify(base[field.key])) return refresh()");
  });
  it('explains the switch to Custom in the notes for presets and for Random', () => {
    const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
    expect(menu).toContain("Editing any value here switches to Custom with this difficulty\\'s values loaded.");
    expect(menu).toContain('Editing a value switches to Custom with these values.');
  });
  it('shows the current roll for Random and hands the previewed roll to onApply', () => {
    const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
    expect(menu).toContain('current.settings');
    expect(menu).toContain('onApply(draftDifficulty, draftCustom, draftRoll, draftAllMusic, draftMusicRandom, draftMusicRoll, draftTrackRandom)');
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
    expect(main).toContain('getCurrent: () => ({ difficulty, custom, music, musicRandom, track, trackRandom, gameTrack, settings })');
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
  it('builds a Music group from MUSIC_FIELDS, editable under every difficulty including Random', () => {
    expect(menu).toContain('MUSIC_FIELDS.forEach');
    expect(menu).toContain("addGroup('Music')");
    expect(menu).toContain('musicInputs.set(field.key, input)');
    const show = menu.slice(menu.indexOf('function showMusic('), menu.indexOf('\n  }\n', menu.indexOf('function showMusic(')));
    expect(show).not.toContain('draftDifficulty');
    expect(show).not.toContain('draftRoll');
    expect(show).toContain('draftAllMusic[editTrack][field.key]');
    expect(show).toContain('draftMusicRoll[field.key]');
    expect(show).toContain('const locked = draftMusicRandom');
    expect(show).toContain('input.readOnly = locked');
    expect(show).toContain("input.classList.toggle('locked', locked)");
    expect(show).toContain('resetBtn.disabled = locked');
  });
  it('never writes the roll into the player\'s draft music, and edits only the track being edited', () => {
    const assigns = [...menu.matchAll(/draftAllMusic\[editTrack\] = ([^;]*);/g)].map((m) => m[1]);
    expect(assigns).toEqual(['applyEdit(draftAllMusic[editTrack], field, raw)', 'copySettings(DEFAULT_MUSIC)', 'randomMusic(rng)']);
    expect(menu).toContain('draftAllMusic = copyAllMusic(current.music)');
    expect([...menu.matchAll(/draftAllMusic = ([^;]*);/g)].map((m) => m[1])).toEqual(['copyAllMusic(DEFAULT_ALL_MUSIC)', 'copyAllMusic(current.music)']);
  });
  it('has a Reset to default button inside the Music group', () => {
    expect(menu).toContain("'Reset to default'");
    expect(menu).toContain("'Reset to default, music'");
    expect(menu).not.toContain("'Reset music to default'");
    expect(menu).toContain("resetBtn.type = 'button'");
    expect(menu).toContain('DEFAULT_MUSIC');
  });
  it('edits a copy of the music, corrected on change, and applies it with the choice', () => {
    expect(menu).toContain('draftAllMusic = copyAllMusic(current.music)');
    expect(menu).toContain('draftAllMusic[editTrack] = applyEdit(draftAllMusic[editTrack], field, raw)');
    expect(menu).toContain('onApply(draftDifficulty, draftCustom, draftRoll, draftAllMusic, draftMusicRandom, draftMusicRoll, draftTrackRandom)');
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
    expect(main).toContain('getCurrent: () => ({ difficulty, custom, music, musicRandom, track, trackRandom, gameTrack, settings })');
    expect(main).toContain('getCurrent: () => ({ difficulty, custom, music, musicRandom, track, trackRandom, gameTrack, settings })');
    expect(main).not.toMatch(/settings = settingsFor\(/);
    expect(main).toContain('withMusic(base, gameMusic)');
    expect(main).not.toContain('settingsWithMusic');
    expect(main).toContain('musicForGame(musicOf(music, gameTrack), musicRandom, Math.random)');
  });
  it('main builds the initial, game-over and applied settings through the merge', () => {
    const body = (name) => main.slice(main.indexOf(`function ${name}(`), main.indexOf('\n}\n', main.indexOf(`function ${name}(`)));
    expect(main).toMatch(/let settings = nextSettings\(\)/);
    expect(body('advance')).toContain('settings = nextSettings()');
    expect(body('applyDifficulty')).not.toContain('settingsWithMusic');
    expect(body('applyDifficulty')).toContain("nextSettings(musicRandom ? musicRoll : undefined, difficulty === 'random' ? roll : undefined)");
    expect(body('applyDifficulty')).toContain('nextSettings(');
  });
});

describe('Reset Custom to default button', () => {
  const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  it('has a button whose accessible name contains its visible text', () => {
    expect(menu).toContain("resetCustomBtn.textContent = 'Reset to default'");
    expect(menu).toContain("'Reset to default, custom settings'");
    expect(menu).toContain('noteEl.after(resetCustomBtn)');
  });
  it('restores the Medium values into the Custom draft only, then refreshes', () => {
    expect(menu).toMatch(/resetCustomBtn\.addEventListener\('click', \(\) => \{\s*draftCustom = copySettings\(PRESETS\.medium\);\s*refresh\(\);/);
  });
  it('shows and enables it only while Custom is selected', () => {
    expect(menu).toContain("resetCustomBtn.hidden = draftDifficulty !== 'custom'");
    expect(menu).toContain("resetCustomBtn.disabled = draftDifficulty !== 'custom'");
    expect(css).toMatch(/\.reset-custom\[hidden\][^{]*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.reset-custom[^{]*\{[^}]*min-height:\s*44px/);
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
  it('rerolls a fresh roll from the injected rng and refreshes, never touching the music draft', () => {
    expect(menu).toMatch(/rerollBtn\.addEventListener\('click', \(\) => \{\s*draftRoll = settingsFor\('random', null, rng\);\s*refresh\(\);/);
    const reroll = menu.slice(menu.indexOf("rerollBtn.addEventListener('click'"), menu.indexOf('noteEl.after(rerollBtn)'));
    expect(reroll).not.toMatch(/draftMusic/);
  });
  it('shows and enables Reroll only while Random is selected', () => {
    expect(fn('refresh')).toContain("rerollBtn.hidden = draftDifficulty !== 'random'");
    expect(fn('refresh')).toContain("rerollBtn.disabled = draftDifficulty !== 'random'");
    expect(css).toMatch(/\.reroll\[hidden\][^{]*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.reroll[^{]*\{[^}]*min-height:\s*44px/);
  });
  it('puts the Randomize button above Reset inside the Music group', () => {
    expect(menu).toContain("randomizeBtn.textContent = 'Randomize'");
    expect(menu).toContain("'Randomize, music'");
    expect(menu).toContain('musicEl.append(randomizeBtn, resetBtn)');
    expect(css).toMatch(/\.music-randomize[^{]*\{[^}]*min-height:\s*44px/);
  });
  it('randomizes only the draft music with randomMusic(rng), disabled only while the triggers toggle is on', () => {
    expect(menu).toMatch(/randomizeBtn\.addEventListener\('click', \(\) => \{\s*draftAllMusic\[editTrack\] = randomMusic\(rng\);\s*showMusic\(\);/);
    expect(fn('showMusic')).toContain('randomizeBtn.disabled = locked');
  });
});

describe('Randomize Triggers Every Game toggle', () => {
  const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const fn = (name) => menu.slice(menu.indexOf(`function ${name}(`), menu.indexOf('\n  }\n', menu.indexOf(`function ${name}(`)));
  it('sits in the Music group right under the track dropdown and the track toggle', () => {
    expect(menu).toContain('summary.after(trackLabel, trackToggleLabel, toggleLabel)');
  });
  it('is a real labelled checkbox built with DOM APIs', () => {
    expect(menu).toContain("toggle.type = 'checkbox'");
    expect(menu).toContain("toggle.id = 'music-random'");
    expect(menu).toContain("toggleText.textContent = 'Randomize Triggers Every Game'");
    expect(menu).toMatch(/toggleLabel = document\.createElement\('label'\)/);
    expect(menu).toContain('toggleLabel.append(toggle, toggleText)');
    expect(css).toMatch(/\.music-toggle[^{]*\{[^}]*min-height:\s*44px/);
  });
  it('keeps the draft in the dialog and rolls a fresh preview when ticked', () => {
    expect(menu).toMatch(/toggle\.addEventListener\('change', \(\) => \{\s*draftMusicRandom = toggle\.checked;\s*if \(draftMusicRandom\) draftMusicRoll = randomMusic\(rng\);\s*showMusic\(\);/);
  });
  it('is enabled under Random and checked from the draft', () => {
    expect(fn('showMusic')).not.toContain('toggle.disabled');
    expect(fn('showMusic')).toContain('toggle.checked = draftMusicRandom');
  });
  it('previews the current game\'s roll on open and hands the toggle and roll to onApply', () => {
    expect(menu).toContain('draftMusicRandom = current.musicRandom');
    expect(menu).toContain('onApply(draftDifficulty, draftCustom, draftRoll, draftAllMusic, draftMusicRandom, draftMusicRoll, draftTrackRandom)');
  });
  it('main saves only the toggle and the player\'s own music on apply, and rolls the game music at every re-roll point', () => {
    const apply = main.slice(main.indexOf('function applyDifficulty('), main.indexOf('\n}\n', main.indexOf('function applyDifficulty(')));
    expect(apply).toContain('musicRandom = nextMusicRandom');
    expect(apply).toContain('saveMusicRandom(musicRandom)');
    expect(apply).toContain('saveMusic(music)');
    expect(apply).toContain('nextSettings(musicRandom ? musicRoll : undefined');
    expect(main).toContain('const nextSettings = (gameMusic = musicForGame(');
  });
});

describe('main.js placement budget wiring', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  it('gives tick the real clock and a share of the current step as the placement budget', () => {
    expect(main).toMatch(/tick\(state, Math\.random, \{ now: \(\) => performance\.now\(\), budgetMs: placementBudgetMs\(bpm\(state\.score, state\.settings\)\) \}\)/);
  });
});

describe('main.js track wiring', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  it('loads the saved track and its randomize toggle', () => {
    expect(main).toContain('let track = loadTrack()');
    expect(main).toContain('let trackRandom = loadTrackRandom()');
  });
  it('picks the game track with trackForGame at the start, on Apply and after game over', () => {
    expect(main).toContain('let gameTrack = trackForGame(track, trackRandom, Math.random)');
    expect(main.match(/gameTrack = trackForGame\(track, trackRandom, Math\.random\)/g)).toHaveLength(3);
  });
  it('plays the game track and saves the choices on Apply', () => {
    expect(main).toContain('synth.playStep(step, time, dt, layerGate.layersFor(step), gameTrack)');
    expect(main).toContain('saveTrackRandom(trackRandom)');
  });
  it('Apply keeps the saved track (only the header selector sets it) and re-rolls the game track from it', () => {
    const apply = main.slice(main.indexOf('function applyDifficulty('), main.indexOf('\n}\n', main.indexOf('function applyDifficulty(')));
    expect(apply).not.toContain('saveTrack(');
    expect(apply).not.toMatch(/\btrack = /);
    expect(apply).toContain('trackRandom = nextTrackRandom');
    expect(apply).toContain('gameTrack = trackForGame(track, trackRandom, Math.random)');
    expect(apply).toContain('saveMusic(music)');
  });
  it('tells the menu the saved track, the toggle and the track the next game uses', () => {
    expect(main).toContain('getCurrent: () => ({ difficulty, custom, music, musicRandom, track, trackRandom, gameTrack, settings })');
  });
});

describe('labelsFor', () => {
  it('names each of the eleven triggers after the layer of the track', () => {
    const classic = labelsFor('classic');
    expect(classic).toHaveLength(11);
    expect(classic[4]).toBe('Snare Trigger');
    expect(labelsFor('sunrise')).not.toEqual(classic);
    expect(labelsFor('nope')).toEqual(classic);
  });
});

describe('Edit selector and Randomize Track Every Game', () => {
  const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const fn = (name) => menu.slice(menu.indexOf(`function ${name}(`), menu.indexOf('\n  }\n', menu.indexOf(`function ${name}(`)));
  it('is a labelled select of the registered tracks, built with DOM APIs', () => {
    expect(menu).toContain("trackSelect.id = 'music-track'");
    expect(menu).toContain("trackName.textContent = 'Soundtrack to edit'");
    expect(menu).toContain('TRACKS.forEach');
    expect(menu).toContain('option.value = track.id');
    expect(menu).toContain('option.textContent = track.name');
    expect(menu).toContain('trackLabel.append(trackName, trackSelect)');
  });
  it('has a Randomize Track Every Game checkbox with a real label and a 44px target', () => {
    expect(menu).toContain("trackToggle.id = 'track-random'");
    expect(menu).toContain("trackToggleText.textContent = 'Randomize Track Every Game'");
    expect(menu).toContain('trackToggleLabel.append(trackToggle, trackToggleText)');
    expect(css).toMatch(/\.music-toggle[^{]*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.track-picker select[^{]*\{[^}]*min-height:\s*44px/);
  });
  it('choosing a track to edit only switches which triggers are shown, never what plays', () => {
    expect(menu).toMatch(/trackSelect\.addEventListener\('change', \(\) => \{\s*editTrack = trackSelect\.value;\s*showMusic\(\);\s*showTrack\(\);\s*\}\);/);
    expect([...menu.matchAll(/editTrack = ([^;]*);/g)].map((m) => m[1])).toEqual(["'classic'", 'trackSelect.value', 'current.gameTrack']);
    expect(menu).not.toMatch(/draftTrack\b/);
    expect(menu).not.toContain('trackForGame');
  });
  it('relabels the triggers from the edited track, or the playing track while the triggers roll', () => {
    const show = fn('showTrack');
    expect(show).toContain('labelsFor(labelTrack())');
    expect(menu).toContain('const labelTrack = () => (draftMusicRandom ? playingTrack : editTrack)');
    expect(show).toContain('trackSelect.value = labelTrack()');
    expect(show).toContain('trackSelect.disabled = draftMusicRandom');
    expect(show).toContain('trackToggle.checked = draftTrackRandom');
    expect(show).not.toContain('draftAllMusic');
  });
  it('starts on the playing track and shows the roll locked for it while the triggers toggle is on', () => {
    expect(menu).toContain('editTrack = current.gameTrack');
    expect(menu).toContain('playingTrack = current.gameTrack');
    expect(fn('showMusic')).toContain('draftMusicRoll[field.key]');
  });
  it('re-shows the fields and labels when the triggers toggle changes', () => {
    expect(menu).toMatch(/toggle\.addEventListener\('change', \(\) => \{[^}]*showMusic\(\);\s*showTrack\(\);/);
  });
  it('saves the checkbox only; the track itself is no longer a menu setting', () => {
    expect(menu).toMatch(/trackToggle\.addEventListener\('change', \(\) => \{\s*draftTrackRandom = trackToggle\.checked;\s*\}\);/);
  });
});

describe('collapsible groups', () => {
  const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  it('builds every group as a native details with a summary titled with the group name', () => {
    const add = menu.slice(menu.indexOf('const addGroup'), menu.indexOf('// One labelled input'));
    expect(add).toContain("document.createElement('details')");
    expect(add).toContain("document.createElement('summary')");
    expect(add).toContain('summary.textContent = title');
    expect(menu).not.toMatch(/createElement\('(fieldset|legend)'\)/);
  });
  it('collapses every group each time the dialog opens, before it is shown, and never closes one when another opens', () => {
    const open = menu.slice(menu.indexOf("openBtn.addEventListener('click'"), menu.indexOf("applyBtn.addEventListener('click'"));
    expect(open).toContain('groups.forEach((group) => { group.open = false; })');
    expect(open.indexOf('group.open = false')).toBeLessThan(open.indexOf('dialog.showModal()'));
    expect(menu).not.toContain("addEventListener('toggle'");
  });
  it('keeps all ten groups', () => {
    expect(menu).toContain("addGroup(field.group)");
    expect(menu).toContain("addGroup('Music')");
  });
  it('gives the summary a 44px tap target and a visible marker', () => {
    expect(css).toMatch(/summary[^{]*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/summary::before[^{]*\{[^}]*content:/);
    expect(css).toMatch(/details\[open\] > summary::before[^{]*\{[^}]*content:/);
  });
});
