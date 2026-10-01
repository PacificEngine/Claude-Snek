import { describe, it, expect } from 'vitest';
import { actionForKey } from '../src/input.js';

describe('actionForKey', () => {
  it.each([
    ['ArrowUp', 'up'], ['ArrowDown', 'down'], ['ArrowLeft', 'left'], ['ArrowRight', 'right'],
    ['w', 'up'], ['a', 'left'], ['s', 'down'], ['d', 'right'], ['W', 'up'],
  ])('maps %s to direction %s', (key, direction) => {
    expect(actionForKey(key)).toEqual({ type: 'direction', direction });
  });
  it('maps P to pause, Enter to restart, M to mute', () => {
    expect(actionForKey('p')).toEqual({ type: 'pause' });
    expect(actionForKey('Enter')).toEqual({ type: 'restart' });
    expect(actionForKey('M')).toEqual({ type: 'mute' });
  });
  it('returns null for unmapped keys', () => {
    expect(actionForKey('x')).toBeNull();
  });
});
