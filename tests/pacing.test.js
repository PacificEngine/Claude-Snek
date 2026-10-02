import { describe, it, expect } from 'vitest';
import { bpm, activeLayers, stepSeconds } from '../src/core/pacing.js';
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

describe('activeLayers', () => {
  const NONE = {
    hat: false, melody: false, snare: false, sixteenthHat: false, arp: false,
    bassPulse: false, harmony: false, counter: false, fill: false,
  };
  const ORDER = ['hat', 'melody', 'snare', 'sixteenthHat', 'arp', 'bassPulse', 'harmony', 'counter', 'fill'];
  const upTo = (n) => Object.fromEntries(ORDER.map((name, i) => [name, i < n]));
  it('with the defaults, switches on one layer per 8 apples in the old tier order', () => {
    const s = PRESETS.medium;
    expect(activeLayers(0, s)).toEqual(NONE);
    expect(activeLayers(7, s)).toEqual(NONE);
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
    const s = { ...PRESETS.medium, fillTrigger: 0, hatTrigger: 100 };
    expect(activeLayers(0, s).fill).toBe(true);
    expect(activeLayers(0, s).hat).toBe(false);
    expect(activeLayers(99, s).hat).toBe(false);
    expect(activeLayers(100, s).hat).toBe(true);
  });
  it('maps the fast hi-hat to fastHatTrigger', () => {
    const s = { ...PRESETS.medium, fastHatTrigger: 3 };
    expect(activeLayers(2, s).sixteenthHat).toBe(false);
    expect(activeLayers(3, s).sixteenthHat).toBe(true);
  });
  it('treats 0 as active from the first apple and equal triggers as one moment', () => {
    const zero = Object.fromEntries(Object.keys(PRESETS.medium).filter((k) => k.endsWith('Trigger') && /^(hat|melody|snare|fastHat|arp|bassPulse|harmony|counter|fill)Trigger$/.test(k)).map((k) => [k, 0]));
    expect(activeLayers(0, { ...PRESETS.medium, ...zero })).toEqual(upTo(9));
    const same = { ...PRESETS.medium, hatTrigger: 5, melodyTrigger: 5 };
    expect(activeLayers(4, same).hat).toBe(false);
    expect(activeLayers(5, same)).toMatchObject({ hat: true, melody: true });
  });
  it('keeps a trigger of 1000 off until apple 1000', () => {
    const s = { ...PRESETS.medium, counterTrigger: 1000 };
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
