import { describe, it, expect } from 'vitest';
import { bpm, musicTier, stepSeconds } from '../src/core/pacing.js';

// length = 3 + apples eaten
describe('bpm', () => {
  it('starts at 120 for the starting length', () => {
    expect(bpm(3)).toBe(120);
  });
  it('does not rise for the first three apples', () => {
    expect(bpm(4)).toBe(120);
    expect(bpm(6)).toBe(120);
  });
  it('rises 4 on every 4th apple', () => {
    expect(bpm(7)).toBe(124);
    expect(bpm(10)).toBe(124);
    expect(bpm(11)).toBe(128);
  });
  it('reaches 200 exactly at the 80th apple', () => {
    expect(bpm(82)).toBe(196);
    expect(bpm(83)).toBe(200);
  });
  it('stays at 200 afterwards', () => {
    expect(bpm(500)).toBe(200);
  });
});

describe('musicTier', () => {
  it('is 0 for the first seven apples', () => {
    expect(musicTier(3)).toBe(0);
    expect(musicTier(10)).toBe(0);
  });
  it('rises by one for every 8 apples', () => {
    expect(musicTier(11)).toBe(1);
    expect(musicTier(18)).toBe(1);
    expect(musicTier(19)).toBe(2);
  });
  it('is 9 on apple 79 and 10 on apple 80', () => {
    expect(musicTier(82)).toBe(9);
    expect(musicTier(83)).toBe(10);
  });
  it('caps at 10', () => {
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
