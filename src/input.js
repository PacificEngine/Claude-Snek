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
