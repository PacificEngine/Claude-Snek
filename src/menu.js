import { DIFFICULTIES, FIELDS, PRESETS, settingsFor, applyEdit, describeRange } from './core/difficulty.js';

const LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', custom: 'Custom' };
export const difficultyLabel = (difficulty) => LABELS[difficulty] ?? LABELS.medium;

// Builds the dialog's fields with DOM APIs (no HTML strings) and wires its buttons.
export function createMenu({ dialog, select, fieldsEl, noteEl, openBtn, applyBtn, cancelBtn, getCurrent, canOpen, onApply }) {
  let draftDifficulty = 'medium';
  let draftCustom = { ...PRESETS.medium };
  const inputs = new Map();

  let group = null;
  let groupEl = null;
  FIELDS.forEach((field) => {
    if (field.group !== group) {
      group = field.group;
      groupEl = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = group;
      groupEl.append(legend);
      fieldsEl.append(groupEl);
    }
    const label = document.createElement('label');
    label.className = 'field';
    const name = document.createElement('span');
    name.textContent = `${field.label} (${describeRange(field)})`;
    const input = document.createElement('input');
    input.type = 'number';
    input.id = `field-${field.key}`;
    input.setAttribute('aria-describedby', 'difficulty-note');
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
    input.addEventListener('change', () => {
      draftCustom = applyEdit(draftCustom, field, input.value);
      input.value = String(draftCustom[field.key]);
    });
    label.append(name, input);
    groupEl.append(label);
    inputs.set(field.key, input);
  });

  function refresh() {
    const values = settingsFor(draftDifficulty, draftCustom);
    const locked = draftDifficulty !== 'custom';
    FIELDS.forEach((field) => {
      const input = inputs.get(field.key);
      input.value = String(values[field.key]);
      input.readOnly = locked;
      input.setAttribute('aria-readonly', String(locked));
      input.classList.toggle('locked', locked);
    });
    noteEl.textContent = locked
      ? 'These values are locked. Choose Custom to edit them.'
      : 'Edit any value. It is adjusted to the nearest allowed value.';
  }

  select.addEventListener('change', () => {
    draftDifficulty = DIFFICULTIES.includes(select.value) ? select.value : 'medium';
    refresh();
  });
  openBtn.addEventListener('click', () => {
    if (!canOpen()) return;
    const current = getCurrent();
    draftDifficulty = current.difficulty;
    draftCustom = { ...current.custom };
    select.value = draftDifficulty;
    refresh();
    dialog.showModal();
  });
  applyBtn.addEventListener('click', () => {
    onApply(draftDifficulty, draftCustom);
    dialog.close();
  });
  cancelBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => openBtn.focus());
}
