const DIRECTIONS = {
  arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};

export function actionForKey(key) {
  const k = key.toLowerCase();
  if (k in DIRECTIONS) return { type: 'direction', direction: DIRECTIONS[k] };
  if (k === 'p') return { type: 'pause' };
  if (k === 'enter') return { type: 'restart' };
  if (k === 'm') return { type: 'mute' };
  return null;
}

const BUTTON_DIRECTIONS = ['up', 'down', 'left', 'right'];
const BUTTON_ACTIONS = ['pause', 'restart', 'mute'];

// Maps a touch button's data attributes to the same actions the keyboard produces.
export function actionForButton({ action, direction } = {}) {
  if (action === 'direction') {
    return BUTTON_DIRECTIONS.includes(direction) ? { type: 'direction', direction } : null;
  }
  return BUTTON_ACTIONS.includes(action) ? { type: action } : null;
}
