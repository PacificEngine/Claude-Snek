import { describe, it, expect } from 'vitest';
import { bpm, activeLayers, stepSeconds, placementBudgetMs } from '../src/core/pacing.js';
import { PRESETS, DEFAULT_MUSIC, withMusic } from '../src/core/difficulty.js';


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

const medium = withMusic(PRESETS.medium, DEFAULT_MUSIC);

describe('activeLayers', () => {
  const ORDER = ['kick', 'bass', 'hat', 'melody', 'snare', 'sixteenthHat', 'arp', 'bassPulse', 'harmony', 'counter', 'fill'];
  // Kick and bass play from the start (trigger 0); n counts the later layers that have entered.
  const upTo = (n) => Object.fromEntries(ORDER.map((name, i) => [name, i < n + 2]));
  it('with the defaults, switches on one layer per 8 apples in the old tier order', () => {
    const s = medium;
    expect(activeLayers(0, s)).toEqual(upTo(0));
    expect(activeLayers(7, s)).toEqual(upTo(0));
    expect(activeLayers(8, s)).toEqual(upTo(1));
    expect(activeLayers(16, s)).toEqual(upTo(2));
    expect(activeLayers(24, s)).toEqual(upTo(3));
    expect(activeLayers(32, s)).toEqual(upTo(4));
    expect(activeLayers(40, s)).toEqual(upTo(5));
    expect(activeLayers(48, s)).toEqual(upTo(6));
    expect(activeLayers(56, s)).toEqual(upTo(7));
    expect(activeLayers(64, s)).toEqual(upTo(8));
    expect(activeLayers(71, s)).toEqual(upTo(8));
    expect(activeLayers(72, s)).toEqual(upTo(9));
    expect(activeLayers(80, s)).toEqual(upTo(9));
  });
  it('reads each layer from its own trigger, in any order', () => {
    const s = { ...medium, fillTrigger: 0, hatTrigger: 100 };
    expect(activeLayers(0, s).fill).toBe(true);
    expect(activeLayers(0, s).hat).toBe(false);
    expect(activeLayers(99, s).hat).toBe(false);
    expect(activeLayers(100, s).hat).toBe(true);
  });
  it('reads kick and bass from their own triggers and holds them off until then', () => {
    const s = { ...medium, kickTrigger: 4, bassTrigger: 6 };
    expect(activeLayers(3, s)).toMatchObject({ kick: false, bass: false });
    expect(activeLayers(4, s)).toMatchObject({ kick: true, bass: false });
    expect(activeLayers(6, s)).toMatchObject({ kick: true, bass: true });
  });
  it('maps the fast hi-hat to fastHatTrigger', () => {
    const s = { ...medium, fastHatTrigger: 3 };
    expect(activeLayers(2, s).sixteenthHat).toBe(false);
    expect(activeLayers(3, s).sixteenthHat).toBe(true);
  });
  it('treats 0 as active from the first apple and equal triggers as one moment', () => {
    const zero = Object.fromEntries(Object.keys(DEFAULT_MUSIC).map((k) => [k, 0]));
    expect(activeLayers(0, { ...medium, ...zero })).toEqual(upTo(9));
    const same = { ...medium, hatTrigger: 5, melodyTrigger: 5 };
    expect(activeLayers(4, same).hat).toBe(false);
    expect(activeLayers(5, same)).toMatchObject({ hat: true, melody: true });
  });
  it('keeps a trigger of 1000 off until apple 1000', () => {
    const s = { ...medium, counterTrigger: 1000 };
    expect(activeLayers(999, s).counter).toBe(false);
    expect(activeLayers(1000, s).counter).toBe(true);
  });
  it('defaults to the Medium settings', () => {
    expect(activeLayers(8)).toEqual(upTo(1));
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

describe('placementBudgetMs', () => {
  it('is half a step: 62.5 ms at 120 BPM', () => {
    expect(placementBudgetMs(120)).toBeCloseTo(62.5);
  });
  it('never drops below 2 ms, however fast the tempo', () => {
    expect(placementBudgetMs(100000)).toBe(2);
  });
});
