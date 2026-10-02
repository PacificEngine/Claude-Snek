import { describe, it, expect } from 'vitest';
import { bpm, musicTier, stepSeconds } from '../src/core/pacing.js';

// the argument is now APPLES EATEN (the score)
describe('bpm', () => {
  it('starts at 120', () => {
    expect(bpm(0)).toBe(120);
  });
  it('does not rise for the first three apples', () => {
    expect(bpm(1)).toBe(120);
    expect(bpm(3)).toBe(120);
  });
  it('rises 4 on every 4th apple', () => {
    expect(bpm(4)).toBe(124);
    expect(bpm(7)).toBe(124);
    expect(bpm(8)).toBe(128);
  });
  it('reaches 200 exactly at the 80th apple and stays there', () => {
    expect(bpm(79)).toBe(196);
    expect(bpm(80)).toBe(200);
    expect(bpm(500)).toBe(200);
  });
  it('multiplies by the speed modifier after the 200 cap', () => {
    expect(bpm(0, 0.6)).toBeCloseTo(72);
    expect(bpm(0, 1.2)).toBeCloseTo(144);
    expect(bpm(80, 1.2)).toBeCloseTo(240);
    expect(bpm(500, 2)).toBeCloseTo(400);
    expect(bpm(0, 0.1)).toBeCloseTo(12);
  });
});

describe('musicTier', () => {
  it('is 0 for the first seven apples', () => {
    expect(musicTier(0)).toBe(0);
    expect(musicTier(7)).toBe(0);
  });
  it('rises by one for every 8 apples', () => {
    expect(musicTier(8)).toBe(1);
    expect(musicTier(15)).toBe(1);
    expect(musicTier(16)).toBe(2);
  });
  it('is 9 on apple 79 and 10 on apple 80, capped at 10', () => {
    expect(musicTier(79)).toBe(9);
    expect(musicTier(80)).toBe(10);
    expect(musicTier(500)).toBe(10);
  });
});

describe('stepSeconds', () => {
  it('is one sixteenth note: 0.125s at 120 BPM', () => {
    expect(stepSeconds(120)).toBeCloseTo(0.125);
  });
  it('shrinks as the tempo rises: 0.075s at 200 BPM', () => {
    expect(stepSeconds(200)).toBeCloseTo(0.075);
  });
});
