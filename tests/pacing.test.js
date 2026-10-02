import { describe, it, expect } from 'vitest';
import { bpm, musicTier, stepSeconds } from '../src/core/pacing.js';
import { PRESETS } from '../src/core/difficulty.js';


const curve = (initialBpm, finalBpm, bpmScale) => ({ initialBpm, finalBpm, bpmScale });

// the first argument is APPLES EATEN (the score)
describe('bpm', () => {
  it('Medium starts at 120, gains 1 per apple and stops at 200', () => {
    const s = PRESETS.medium;
    expect(bpm(0, s)).toBe(120);
    expect(bpm(1, s)).toBe(121);
    expect(bpm(79, s)).toBe(199);
    expect(bpm(80, s)).toBe(200);
    expect(bpm(500, s)).toBe(200);
  });
  it('Easy goes 72 to 120 and Hard 144 to 240', () => {
    expect(bpm(0, PRESETS.easy)).toBe(72);
    expect(bpm(80, PRESETS.easy)).toBe(120);
    expect(bpm(500, PRESETS.easy)).toBe(120);
    expect(bpm(0, PRESETS.hard)).toBe(144);
    expect(bpm(80, PRESETS.hard)).toBe(240);
    expect(bpm(500, PRESETS.hard)).toBe(240);
  });
  it('descends and stops when the final BPM is below the initial BPM', () => {
    const s = curve(200, 120, 2);
    expect(bpm(0, s)).toBe(200);
    expect(bpm(10, s)).toBe(180);
    expect(bpm(40, s)).toBe(120);
    expect(bpm(500, s)).toBe(120);
  });
  it('is constant when initial and final are equal', () => {
    expect(bpm(0, curve(100, 100, 5))).toBe(100);
    expect(bpm(50, curve(100, 100, 5))).toBe(100);
  });
  it('allows fractional scales without float noise', () => {
    const s = curve(100, 200, 0.1);
    expect(bpm(3, s)).toBe(100.3);
    expect(bpm(7, s)).toBe(100.7);
  });
  it('handles the extremes 20 and 400', () => {
    expect(bpm(0, curve(20, 400, 20))).toBe(20);
    expect(bpm(1, curve(20, 400, 20))).toBe(40);
    expect(bpm(100, curve(20, 400, 20))).toBe(400);
    expect(bpm(100, curve(400, 20, 20))).toBe(20);
  });
  it('treats negative apples as zero', () => {
    expect(bpm(-5, PRESETS.medium)).toBe(120);
  });
  it('defaults to the Medium settings', () => {
    expect(bpm(10)).toBe(130);
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
