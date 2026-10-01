import { describe, it, expect } from 'vitest';
import { actionForKey, actionForButton } from '../src/input.js';

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

describe('actionForButton', () => {
  it.each(['up', 'down', 'left', 'right'])('maps the %s button to a direction', (direction) => {
    expect(actionForButton({ action: 'direction', direction })).toEqual({ type: 'direction', direction });
  });
  it('maps pause, restart and mute buttons to the same actions as their keys', () => {
    expect(actionForButton({ action: 'pause' })).toEqual(actionForKey('p'));
    expect(actionForButton({ action: 'restart' })).toEqual(actionForKey('Enter'));
    expect(actionForButton({ action: 'mute' })).toEqual(actionForKey('m'));
  });
  it('ignores unknown or incomplete buttons', () => {
    expect(actionForButton({ action: 'direction' })).toBeNull();
    expect(actionForButton({ action: 'direction', direction: 'sideways' })).toBeNull();
    expect(actionForButton({ action: 'explode' })).toBeNull();
    expect(actionForButton({})).toBeNull();
    expect(actionForButton()).toBeNull();
  });
});
