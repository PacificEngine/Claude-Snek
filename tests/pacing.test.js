import { describe, it, expect } from 'vitest';
import { ticksPerSecond, bpm } from '../src/core/pacing.js';

describe('ticksPerSecond', () => {
  it('starts at 8 for the starting length', () => {
    expect(ticksPerSecond(3)).toBe(8);
  });
  it('adds 0.5 per food eaten', () => {
    expect(ticksPerSecond(4)).toBe(8.5);
    expect(ticksPerSecond(5)).toBe(9);
  });
  it('caps at 20', () => {
    expect(ticksPerSecond(100)).toBe(20);
  });
});

describe('bpm', () => {
  it('starts at 100 for the starting length', () => {
    expect(bpm(3)).toBe(100);
  });
  it('adds 4 per food eaten', () => {
    expect(bpm(4)).toBe(104);
  });
  it('caps at 200', () => {
    expect(bpm(100)).toBe(200);
  });
});
