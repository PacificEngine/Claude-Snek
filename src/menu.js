import { TRACKS, layerNames } from './core/track.js';
import { DIFFICULTIES, FIELDS, MUSIC_FIELDS, DEFAULT_MUSIC, PRESETS, settingsFor, sanitize, randomMusic, trackForGame, applyEdit, describeRange, formatList } from './core/difficulty.js';

const LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', frantic: 'Frantic', random: 'Random', custom: 'Custom' };
export const difficultyLabel = (difficulty) => LABELS[difficulty] ?? LABELS.medium;

// The label of each of the eleven trigger fields: the instrument that plays that slot in the track.
export const labelsFor = (trackId) => layerNames(trackId).map((name) => `${name} Trigger`);

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
  let draftTrack = 'classic';
  let draftTrackRandom = false;
  let draftTrackRoll = 'classic';
  let currentRoll = null;
  const inputs = new Map();
  const musicInputs = new Map();
  const musicNames = new Map();
  // The track the next game plays: the preview roll while randomizing, else the player's own pick (kept underneath).
  const shownTrack = () => (draftTrackRandom ? draftTrackRoll : draftTrack);
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

  // Music is a global setting, editable with every difficulty (Random included); it is locked only while the triggers toggle previews a roll.
  const musicEl = addGroup('Music');
  MUSIC_FIELDS.forEach((field, i) => {
    // The slot's label is the name of the instrument playing it in the shown track (showTrack keeps it current).
    const { label, input } = buildField({ ...field, label: labelsFor(shownTrack())[i] }, (raw) => {
      draftMusic = applyEdit(draftMusic, field, raw);
      input.value = show(field, draftMusic[field.key]);
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
  });

  // The track dropdown and "Randomize Track Every Game": while ticked the dropdown is locked on the track the next game uses.
  const trackLabel = document.createElement('label');
  trackLabel.className = 'field track-picker';
  const trackName = document.createElement('span');
  trackName.textContent = 'Track';
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
    draftTrack = trackSelect.value;
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
    if (draftTrackRandom) draftTrackRoll = trackForGame(draftTrack, true, rng);
    showTrack();
  });
  const legend = musicEl.firstChild;
  legend.after(trackLabel, trackToggleLabel, toggleLabel); // right under the legend, above the fields

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

  // Only labels change with the track; the trigger values belong to the slot and are never touched here.
  function showTrack() {
    const names = labelsFor(shownTrack());
    MUSIC_FIELDS.forEach((field, i) => {
      musicNames.get(field.key).textContent = `${names[i]} (${describeRange(field)})`;
    });
    trackSelect.value = shownTrack();
    trackSelect.disabled = draftTrackRandom;
    trackToggle.checked = draftTrackRandom;
  }

  // Every difficulty shows the player's own draft, editable; the triggers toggle swaps in its preview roll, locked.
  function showMusic() {
    const locked = draftMusicRandom;
    MUSIC_FIELDS.forEach((field) => {
      const input = musicInputs.get(field.key);
      const value = draftMusicRandom ? draftMusicRoll[field.key] : draftMusic[field.key];
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
    draftMusic = copySettings(current.music);
    draftMusicRandom = current.musicRandom;
    draftTrack = current.track;
    draftTrackRandom = current.trackRandom;
    draftTrackRoll = current.trackRandom ? current.gameTrack : trackForGame(current.track, true, rng);
    // When already on, the game's own roll is the preview; otherwise a roll is ready if the toggle gets ticked.
    draftMusicRoll = current.musicRandom
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
    onApply(draftDifficulty, draftCustom, draftRoll, draftMusic, draftMusicRandom, draftMusicRoll, draftTrack, draftTrackRandom, shownTrack());
    dialog.close();
  });
  cancelBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => openBtn.focus());
}
