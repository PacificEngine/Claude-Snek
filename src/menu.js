import { DIFFICULTIES, FIELDS, MUSIC_FIELDS, DEFAULT_MUSIC, PRESETS, settingsFor, sanitize, randomMusic, applyEdit, describeRange, formatList } from './core/difficulty.js';

const LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', frantic: 'Frantic', random: 'Random', custom: 'Custom' };
export const difficultyLabel = (difficulty) => LABELS[difficulty] ?? LABELS.medium;

// Builds the dialog's fields with DOM APIs (no HTML strings) and wires its buttons.
const copySettings = (settings) => Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]));
const show = (field, value) => (field.type === 'list' ? formatList(value) : String(value));

export function createMenu({ dialog, select, fieldsEl, noteEl, openBtn, applyBtn, cancelBtn, getCurrent, canOpen, onApply, rng }) {
  let draftDifficulty = 'medium';
  let draftCustom = copySettings(PRESETS.medium);
  let draftMusic = copySettings(DEFAULT_MUSIC);
  let draftRoll = copySettings(PRESETS.medium);
  let draftMusicRandom = false;
  let draftMusicRoll = randomMusic(rng);
  let currentRoll = null;
  const inputs = new Map();
  const musicInputs = new Map();
  const rollFor = () => (currentRoll ? copySettings(currentRoll) : settingsFor('random', null, rng));

  const addGroup = (title) => {
    const el = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = title;
    el.append(legend);
    fieldsEl.append(el);
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

  // Music is a global setting, editable with every difficulty except Random (which shows its roll's music, locked).
  const musicEl = addGroup('Music');
  MUSIC_FIELDS.forEach((field) => {
    const { label, input } = buildField(field, (raw) => {
      draftMusic = applyEdit(draftMusic, field, raw);
      input.value = show(field, draftMusic[field.key]);
    });
    musicEl.append(label);
    musicInputs.set(field.key, input);
  });
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'music-reset';
  resetBtn.textContent = 'Reset to default';
  resetBtn.setAttribute('aria-label', 'Reset to default, music');
  resetBtn.addEventListener('click', () => {
    draftMusic = copySettings(DEFAULT_MUSIC);
    showMusic();
  });
  const randomizeBtn = document.createElement('button');
  randomizeBtn.type = 'button';
  randomizeBtn.className = 'music-randomize';
  randomizeBtn.textContent = 'Randomize';
  randomizeBtn.setAttribute('aria-label', 'Randomize, music');
  randomizeBtn.addEventListener('click', () => {
    draftMusic = randomMusic(rng);
    showMusic();
  });
  musicEl.append(randomizeBtn, resetBtn);

  // "Randomize every game": while ticked the Music fields preview the roll the next game uses; the player's draft waits underneath.
  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'music-toggle';
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.id = 'music-random';
  const toggleText = document.createElement('span');
  toggleText.textContent = 'Randomize every game';
  toggleLabel.append(toggle, toggleText);
  toggle.addEventListener('change', () => {
    draftMusicRandom = toggle.checked;
    if (draftMusicRandom) draftMusicRoll = randomMusic(rng);
    showMusic();
  });
  musicEl.insertBefore(toggleLabel, musicEl.children[1]); // right under the legend, above the fields

  // Random only: draws a fresh roll (music included) to preview; Apply runs exactly what is shown.
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

  // Random shows its roll's music, locked; every other difficulty shows the player's own draft, editable.
  function showMusic() {
    const rolled = draftDifficulty === 'random';
    const locked = rolled || draftMusicRandom;
    MUSIC_FIELDS.forEach((field) => {
      const input = musicInputs.get(field.key);
      const value = rolled ? draftRoll[field.key] : draftMusicRandom ? draftMusicRoll[field.key] : draftMusic[field.key];
      input.value = show(field, value);
      input.readOnly = locked;
      input.setAttribute('aria-readonly', String(locked));
      input.classList.toggle('locked', locked);
    });
    resetBtn.disabled = locked;
    randomizeBtn.disabled = locked;
    toggle.checked = draftMusicRandom;
    toggle.disabled = rolled;
  }

  function refresh() {
    const values = draftDifficulty === 'random' ? draftRoll : settingsFor(draftDifficulty, draftCustom);
    FIELDS.forEach((field) => {
      inputs.get(field.key).value = show(field, values[field.key]);
    });
    showMusic();
    rerollBtn.hidden = draftDifficulty !== 'random';
    rerollBtn.disabled = draftDifficulty !== 'random';
    resetCustomBtn.hidden = draftDifficulty !== 'custom';
    resetCustomBtn.disabled = draftDifficulty !== 'custom';
    if (draftDifficulty === 'custom') noteEl.textContent = 'Edit any value. It is adjusted to the nearest allowed value.';
    else if (draftDifficulty === 'random') noteEl.textContent = 'Random: every setting, Music included, changes each new game. Editing a value switches to Custom with these values. Your own Music comes back when you choose another difficulty.';
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
    draftMusic = copySettings(current.music);
    draftMusicRandom = current.musicRandom;
    // When already on, the game's own roll is the preview; otherwise a roll is ready if the toggle gets ticked.
    draftMusicRoll = current.musicRandom && current.difficulty !== 'random'
      ? Object.fromEntries(MUSIC_FIELDS.map((f) => [f.key, current.settings[f.key]]))
      : randomMusic(rng);
    // Random previews the roll the next run uses; picking Random from another difficulty rolls one.
    currentRoll = current.difficulty === 'random' ? current.settings : null;
    draftRoll = rollFor();
    select.value = draftDifficulty;
    refresh();
    dialog.showModal();
  });
  applyBtn.addEventListener('click', () => {
    onApply(draftDifficulty, draftCustom, draftRoll, draftMusic, draftMusicRandom, draftMusicRoll);
    dialog.close();
  });
  cancelBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => openBtn.focus());
}
