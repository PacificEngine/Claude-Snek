import { TRACKS, TRACK_IDS, layerNames } from './core/track.js';
import { THEME_FIELDS, SHAPES, DEFAULT_THEMES, DEFAULT_THEME_ID, randomStyle, shapeLabel, normalizeHex, previewState, PREVIEW_COLUMNS, PREVIEW_ROWS } from './core/theme.js';
import { render } from './renderer.js';
import { DIFFICULTIES, FIELDS, MUSIC_FIELDS, DEFAULT_ALL_MUSIC, DEFAULT_MUSIC, PRESETS, settingsFor, sanitize, randomMusic, applyEdit, describeRange, formatList } from './core/difficulty.js';

const LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', frantic: 'Frantic', random: 'Random', custom: 'Custom' };
export const difficultyLabel = (difficulty) => LABELS[difficulty] ?? LABELS.medium;

// The label of each of the eleven trigger fields: the instrument that plays that slot in the track.
export const labelsFor = (trackId) => layerNames(trackId).map((name) => `${name} Trigger`);

// Builds the dialog's fields with DOM APIs (no HTML strings) and wires its buttons.
const copySettings = (settings) => Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]));
const copyAllMusic = (all) => Object.fromEntries(Object.entries(all).map(([id, music]) => [id, copySettings(music)]));
const copyTheme = (t) => ({ name: t.name, colors: { ...t.colors }, shapes: { ...t.shapes } });
const copyThemes = (themes) => Object.fromEntries(Object.entries(themes).map(([id, t]) => [id, copyTheme(t)]));
const PREVIEW_CELL = 30;
const show = (field, value) => (field.type === 'list' ? formatList(value) : String(value));

export function createMenu({ dialog, select, fieldsEl, noteEl, openBtn, applyBtn, cancelBtn, getCurrent, canOpen, onApply, rng }) {
  let draftDifficulty = 'medium';
  let draftCustom = copySettings(PRESETS.medium);
  // Every track's own triggers, edited as a draft; `editTrack` is the one the Music fields show. It never changes what plays.
  let draftAllMusic = copyAllMusic(DEFAULT_ALL_MUSIC);
  let editTrack = 'classic';
  let playingTrack = 'classic'; // the track the game uses: its names label the fields while the triggers roll
  let draftRoll = copySettings(PRESETS.medium);
  let draftMusicRandom = false;
  let draftMusicRoll = randomMusic(rng);
  let draftTrackRandom = false;
  let draftThemes = copyThemes(DEFAULT_THEMES);
  let draftThemeEdit = DEFAULT_THEME_ID; // the theme the Theme fields show
  let draftThemeChoice = DEFAULT_THEME_ID; // what is saved as the chosen theme
  let draftThemeMatch = true;
  let draftThemeRandom = false;
  let draftStyleRandom = false;
  let currentRoll = null;
  const inputs = new Map();
  const musicInputs = new Map();
  const musicNames = new Map();
  // The fields are named after the edited track, or after the playing track while the triggers roll (locked).
  const labelTrack = () => (draftMusicRandom ? playingTrack : editTrack);
  const rollFor = () => (currentRoll ? copySettings(currentRoll) : settingsFor('random', null, rng));

  const groups = [];
  const addGroup = (title) => {
    const el = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = title;
    el.append(summary);
    fieldsEl.append(el);
    groups.push(el);
    return el;
  };

  // One labelled input; `onEdit(value)` receives the raw text when the player leaves the field.
  const buildField = (field, onEdit) => {
    const label = document.createElement('label');
    label.className = 'field';
    const name = document.createElement('span');
    name.textContent = `${field.label} (${describeRange(field)})`;
    const input = document.createElement('input');
    input.id = `field-${field.key}`;
    input.setAttribute('aria-describedby', 'difficulty-note');
    if (field.type === 'list') {
      input.type = 'text';
      input.inputMode = 'numeric';
    } else {
      input.type = 'number';
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
    }
    input.addEventListener('change', () => onEdit(input.value));
    label.append(name, input);
    return { label, input };
  };

  let groupEl = null;
  FIELDS.forEach((field, i) => {
    if (i === 0 || field.group !== FIELDS[i - 1].group) groupEl = addGroup(field.group);
    const { label, input } = buildField(field, (raw) => {
      // Editing a preset (or a Random roll) turns it into Custom, loaded with the values on screen.
      const base = draftDifficulty === 'custom' ? draftCustom : sanitize(draftDifficulty === 'random' ? draftRoll : settingsFor(draftDifficulty));
      const next = applyEdit(base, field, raw);
      if (draftDifficulty !== 'custom' && JSON.stringify(next[field.key]) === JSON.stringify(base[field.key])) return refresh();
      draftCustom = next;
      draftDifficulty = 'custom';
      select.value = 'custom';
      refresh();
    });
    groupEl.append(label);
    inputs.set(field.key, input);
  });

  // Music is a global setting, editable with every difficulty (Random included); it is locked only while the triggers toggle previews a roll.
  const musicEl = addGroup('Music');
  MUSIC_FIELDS.forEach((field, i) => {
    // The slot's label is the name of the instrument playing it in the shown track (showTrack keeps it current).
    const { label, input } = buildField({ ...field, label: labelsFor(labelTrack())[i] }, (raw) => {
      draftAllMusic[editTrack] = applyEdit(draftAllMusic[editTrack], field, raw);
      input.value = show(field, draftAllMusic[editTrack][field.key]);
    });
    musicEl.append(label);
    musicInputs.set(field.key, input);
    musicNames.set(field.key, label.firstChild);
  });
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'music-reset';
  resetBtn.textContent = 'Reset to default';
  resetBtn.setAttribute('aria-label', 'Reset to default, music');
  resetBtn.addEventListener('click', () => {
    draftAllMusic[editTrack] = copySettings(DEFAULT_MUSIC);
    showMusic();
  });
  const randomizeBtn = document.createElement('button');
  randomizeBtn.type = 'button';
  randomizeBtn.className = 'music-randomize';
  randomizeBtn.textContent = 'Randomize';
  randomizeBtn.setAttribute('aria-label', 'Randomize, music');
  randomizeBtn.addEventListener('click', () => {
    draftAllMusic[editTrack] = randomMusic(rng);
    showMusic();
  });
  musicEl.append(randomizeBtn, resetBtn);

  // "Randomize Triggers Every Game": while ticked the Music fields preview the roll the next game uses; the player's draft waits underneath.
  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'music-toggle';
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.id = 'music-random';
  const toggleText = document.createElement('span');
  toggleText.textContent = 'Randomize Triggers Every Game';
  toggleLabel.append(toggle, toggleText);
  toggle.addEventListener('change', () => {
    draftMusicRandom = toggle.checked;
    if (draftMusicRandom) draftMusicRoll = randomMusic(rng);
    showMusic();
    showTrack();
  });

  // The edit selector (settings only: which track's triggers the Music fields show) and "Randomize Track Every Game".
  const trackLabel = document.createElement('label');
  trackLabel.className = 'field track-picker';
  const trackName = document.createElement('span');
  trackName.textContent = 'Soundtrack to edit';
  const trackSelect = document.createElement('select');
  trackSelect.id = 'music-track';
  TRACKS.forEach((track) => {
    const option = document.createElement('option');
    option.value = track.id;
    option.textContent = track.name;
    trackSelect.append(option);
  });
  trackLabel.append(trackName, trackSelect);
  trackSelect.addEventListener('change', () => {
    editTrack = trackSelect.value;
    showMusic();
    showTrack();
  });
  const trackToggleLabel = document.createElement('label');
  trackToggleLabel.className = 'music-toggle';
  const trackToggle = document.createElement('input');
  trackToggle.type = 'checkbox';
  trackToggle.id = 'track-random';
  const trackToggleText = document.createElement('span');
  trackToggleText.textContent = 'Randomize Track Every Game';
  trackToggleLabel.append(trackToggle, trackToggleText);
  trackToggle.addEventListener('change', () => {
    draftTrackRandom = trackToggle.checked;
  });
  const summary = musicEl.firstChild;
  summary.after(trackLabel, trackToggleLabel, toggleLabel); // right under the legend, above the fields

  // ---- Theme group: edits a draft of the themes; a random style only ever lands in the draft, by the Randomize button ----
  const themeEl = addGroup('Theme');
  const themeToggle = (id, text, onChange) => {
    const label = document.createElement('label');
    label.className = 'music-toggle';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = id;
    const span = document.createElement('span');
    span.textContent = text;
    label.append(box, span);
    box.addEventListener('change', () => {
      onChange(box.checked);
      showTheme();
    });
    return { label, box };
  };
  const themePicker = document.createElement('label');
  themePicker.className = 'field track-picker';
  const themePickerName = document.createElement('span');
  themePickerName.textContent = 'Theme to Edit';
  const themeSelect = document.createElement('select');
  themeSelect.id = 'theme-edit';
  TRACKS.forEach((track) => {
    const option = document.createElement('option');
    option.value = track.id;
    option.textContent = track.name;
    themeSelect.append(option);
  });
  themePicker.append(themePickerName, themeSelect);
  themeSelect.addEventListener('change', () => {
    draftThemeEdit = themeSelect.value;
    draftThemeChoice = themeSelect.value;
    showTheme();
  });
  const match = themeToggle('theme-match', 'Match Theme with Soundtrack', (on) => { draftThemeMatch = on; });
  const themeRand = themeToggle('theme-random', 'Randomize Theme on Every Game', (on) => { draftThemeRandom = on; });
  const styleRand = themeToggle('style-random', 'Randomize Style on Every Game', (on) => { draftStyleRandom = on; });
  const themeNote = document.createElement('p');
  themeNote.className = 'theme-note';
  themeNote.id = 'theme-note';
  themeNote.setAttribute('role', 'status');

  const themeInputs = [];
  const themeFields = document.createElement('div');
  THEME_FIELDS.forEach((field) => {
    const row = document.createElement('div');
    row.className = 'field';
    const id = `theme-${field.kind}-${field.key}`;
    const name = document.createElement('label');
    name.textContent = field.label;
    name.htmlFor = id;
    row.append(name);
    if (field.kind === 'color') {
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.setAttribute('aria-label', `${field.label} picker`);
      const text = document.createElement('input');
      text.type = 'text';
      text.id = id;
      text.maxLength = 7;
      text.spellcheck = false;
      const set = (value) => {
        draftThemes[draftThemeEdit].colors[field.key] = value;
        showTheme();
      };
      picker.addEventListener('input', () => set(picker.value));
      // A typed value must be a real #rrggbb; anything else goes back to the previous colour.
      text.addEventListener('change', () => {
        const hex = normalizeHex(text.value);
        if (hex) set(hex);
        else text.value = draftThemes[draftThemeEdit].colors[field.key];
      });
      const pair = document.createElement('div');
      pair.className = 'color-row';
      pair.append(picker, text);
      row.append(pair);
      themeInputs.push({ field, inputs: [picker, text], read: () => draftThemes[draftThemeEdit].colors[field.key] });
    } else {
      const shapeSelect = document.createElement('select');
      shapeSelect.id = id;
      SHAPES.forEach((shape) => {
        const option = document.createElement('option');
        option.value = shape;
        option.textContent = shapeLabel(shape);
        shapeSelect.append(option);
      });
      shapeSelect.addEventListener('change', () => {
        draftThemes[draftThemeEdit].shapes[field.key] = shapeSelect.value;
        showTheme();
      });
      row.append(shapeSelect);
      themeInputs.push({ field, inputs: [shapeSelect], read: () => draftThemes[draftThemeEdit].shapes[field.key] });
    }
    themeFields.append(row);
  });

  const previewCanvas = document.createElement('canvas');
  previewCanvas.className = 'theme-preview';
  previewCanvas.width = PREVIEW_COLUMNS * PREVIEW_CELL;
  previewCanvas.height = PREVIEW_ROWS * PREVIEW_CELL;
  previewCanvas.setAttribute('role', 'img');
  previewCanvas.setAttribute('aria-label', 'Theme preview');
  const previewCtx = previewCanvas.getContext('2d');

  const themeRandomizeBtn = document.createElement('button');
  themeRandomizeBtn.type = 'button';
  themeRandomizeBtn.className = 'theme-randomize';
  themeRandomizeBtn.textContent = 'Randomize';
  themeRandomizeBtn.setAttribute('aria-label', 'Randomize, theme');
  themeRandomizeBtn.addEventListener('click', () => {
    draftThemes[draftThemeEdit] = { ...randomStyle(rng), name: draftThemes[draftThemeEdit].name };
    showTheme();
  });
  const themeResetBtn = document.createElement('button');
  themeResetBtn.type = 'button';
  themeResetBtn.className = 'theme-reset';
  themeResetBtn.textContent = 'Reset to default';
  themeResetBtn.setAttribute('aria-label', 'Reset to default, theme');
  themeResetBtn.addEventListener('click', () => {
    draftThemes[draftThemeEdit] = copyTheme(DEFAULT_THEMES[draftThemeEdit]);
    showTheme();
  });
  themeEl.append(themePicker, match.label, themeRand.label, styleRand.label, themeNote, themeFields, previewCanvas, themeRandomizeBtn, themeResetBtn);

  // Shows the draft of the edited theme. While Randomize Style is on everything is locked but the draft stays as it was.
  function showTheme() {
    const locked = draftStyleRandom;
    themeSelect.value = draftThemeEdit;
    themeSelect.disabled = locked;
    match.box.checked = draftThemeMatch;
    themeRand.box.checked = draftThemeRandom;
    styleRand.box.checked = draftStyleRandom;
    themeInputs.forEach(({ inputs, read }) => {
      inputs.forEach((input) => {
        input.value = read();
        input.disabled = locked;
      });
    });
    themeRandomizeBtn.disabled = locked;
    themeResetBtn.disabled = locked;
    if (draftStyleRandom) themeNote.textContent = 'Style is randomized every game.';
    else if (draftThemeRandom) themeNote.textContent = 'The theme changes each game. Theme to Edit edits the saved themes.';
    else themeNote.textContent = '';
    render(previewCtx, previewState(), { theme: draftThemes[draftThemeEdit] });
  }

  // Random only: draws a fresh roll of the non-music settings to preview; Apply runs exactly what is shown.
  const rerollBtn = document.createElement('button');
  rerollBtn.type = 'button';
  rerollBtn.className = 'reroll';
  rerollBtn.textContent = 'Reroll';
  rerollBtn.setAttribute('aria-label', 'Reroll, random settings');
  rerollBtn.addEventListener('click', () => {
    draftRoll = settingsFor('random', null, rng);
    refresh();
  });
  noteEl.after(rerollBtn);

  // Custom only: puts every Custom value back to the Medium preset in the draft (Apply keeps it, Cancel discards it).
  const resetCustomBtn = document.createElement('button');
  resetCustomBtn.type = 'button';
  resetCustomBtn.className = 'reset-custom';
  resetCustomBtn.textContent = 'Reset to default';
  resetCustomBtn.setAttribute('aria-label', 'Reset to default, custom settings');
  resetCustomBtn.addEventListener('click', () => {
    draftCustom = copySettings(PRESETS.medium);
    refresh();
  });
  noteEl.after(resetCustomBtn);

  // Only labels change with the track; the values are shown by showMusic.
  function showTrack() {
    const names = labelsFor(labelTrack());
    MUSIC_FIELDS.forEach((field, i) => {
      musicNames.get(field.key).textContent = `${names[i]} (${describeRange(field)})`;
    });
    trackSelect.value = labelTrack();
    trackSelect.disabled = draftMusicRandom;
    trackToggle.checked = draftTrackRandom;
  }

  // Every difficulty shows the player's own draft, editable; the triggers toggle swaps in its preview roll, locked.
  function showMusic() {
    const locked = draftMusicRandom;
    MUSIC_FIELDS.forEach((field) => {
      const input = musicInputs.get(field.key);
      const value = draftMusicRandom ? draftMusicRoll[field.key] : draftAllMusic[editTrack][field.key];
      input.value = show(field, value);
      input.readOnly = locked;
      input.setAttribute('aria-readonly', String(locked));
      input.classList.toggle('locked', locked);
    });
    resetBtn.disabled = locked;
    randomizeBtn.disabled = locked;
    toggle.checked = draftMusicRandom;
  }

  function refresh() {
    const values = draftDifficulty === 'random' ? draftRoll : settingsFor(draftDifficulty, draftCustom);
    FIELDS.forEach((field) => {
      inputs.get(field.key).value = show(field, values[field.key]);
    });
    showMusic();
    showTrack();
    showTheme();
    rerollBtn.hidden = draftDifficulty !== 'random';
    rerollBtn.disabled = draftDifficulty !== 'random';
    resetCustomBtn.hidden = draftDifficulty !== 'custom';
    resetCustomBtn.disabled = draftDifficulty !== 'custom';
    if (draftDifficulty === 'custom') noteEl.textContent = 'Edit any value. It is adjusted to the nearest allowed value.';
    else if (draftDifficulty === 'random') noteEl.textContent = 'Random: every setting except Music changes each new game. Editing a value switches to Custom with these values.';
    else noteEl.textContent = 'Editing any value here switches to Custom with this difficulty\'s values loaded.';
  }

  select.addEventListener('change', () => {
    draftDifficulty = DIFFICULTIES.includes(select.value) ? select.value : 'medium';
    if (draftDifficulty === 'random') draftRoll = rollFor();
    refresh();
  });
  openBtn.addEventListener('click', () => {
    if (!canOpen()) return;
    const current = getCurrent();
    draftDifficulty = current.difficulty;
    draftCustom = copySettings(current.custom);
    draftAllMusic = copyAllMusic(current.music);
    editTrack = current.gameTrack;
    playingTrack = current.gameTrack;
    draftMusicRandom = current.musicRandom;
    draftTrackRandom = current.trackRandom;
    // When already on, the game's own roll is the preview; otherwise a roll is ready if the toggle gets ticked.
    draftMusicRoll = current.musicRandom
      ? Object.fromEntries(MUSIC_FIELDS.map((f) => [f.key, current.settings[f.key]]))
      : randomMusic(rng);
    // Random previews the roll the next run uses; picking Random from another difficulty rolls one.
    currentRoll = current.difficulty === 'random' ? current.settings : null;
    draftRoll = rollFor();
    draftThemes = copyThemes(current.themes);
    draftThemeChoice = current.themeChoice;
    draftThemeMatch = current.themeMatch;
    draftThemeRandom = current.themeRandom;
    draftStyleRandom = current.styleRandom;
    // The theme in play when it is one of the twelve, else the saved choice (or the playing soundtrack while Match is on).
    const playing = TRACKS.find((track) => track.name === current.gameTheme?.name)?.id;
    const fallback = current.themeMatch ? current.gameTrack : current.themeChoice;
    draftThemeEdit = playing ?? (TRACK_IDS.includes(fallback) ? fallback : DEFAULT_THEME_ID);
    select.value = draftDifficulty;
    groups.forEach((group) => { group.open = false; });
    refresh();
    dialog.showModal();
  });
  applyBtn.addEventListener('click', () => {
    onApply(draftDifficulty, draftCustom, draftRoll, draftAllMusic, draftMusicRandom, draftMusicRoll, draftTrackRandom, draftThemes, draftThemeChoice, draftThemeMatch, draftThemeRandom, draftStyleRandom);
    dialog.close();
  });
  cancelBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => openBtn.focus());
}
