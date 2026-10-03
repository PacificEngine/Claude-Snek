import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { eventsAt, SLOT_KEYS, TOTAL_STEPS } from '../src/core/track.js';

// Pins how the Classic song sounds: every one of its 512 steps under several layer sets must stay byte-identical.
// Layer sets are slot numbers 0..10 (kick, bass, hat, melody, snare, fastHat, arp, bassPulse, harmony, counter, fill).
const NAMES = ['kick', 'bass', 'hat', 'melody', 'snare', 'sixteenthHat', 'arp', 'bassPulse', 'harmony', 'counter', 'fill'];
const activeFor = (slots) => Object.fromEntries(SLOT_KEYS.map((key, i) => [key, slots.includes(i)]));

// Only the long-standing event fields are pinned (any extra field a refactor adds is not part of the sound).
const FIELDS = ['melody', 'harmony', 'counter', 'arp', 'bass', 'kick', 'snare', 'hat'];
const digest = (slots) => {
  const active = activeFor(slots);
  const lines = Array.from({ length: TOTAL_STEPS }, (_, step) => {
    const e = eventsAt(step, active);
    return FIELDS.map((f) => `${f}=${e[f]}`).join(',');
  });
  return createHash('sha256').update(lines.join('\n')).digest('hex');
};

const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SETS = {
  none: [],
  all: ALL,
  ...Object.fromEntries(ALL.map((i) => [`only ${NAMES[i]}`, [i]])),
  mixed: [1, 3, 5, 7, 9],
};

const PINNED = {
  'none': '9d050ad6a13200104707c49f264930e11284a7b89956ca2367f2ef2e0ca5a84c',
  'all': '6dea85d0525cf1cb8abda7785e36c3dfa906f90dec4a48601020a256989fdb82',
  'only kick': '8967ecfb0b90810732946e052d221cab6e95e71412b2294d4cbbba7e5a6d2e2a',
  'only bass': '591ab7983ab625356342ea4e30719f4d6eb480075285a42080139a8d7cb13cca',
  'only hat': '0a7d235c0986d6e8a74df8fd3e42d8f217f98b74ae6ec23f3de8eb7e07191c28',
  'only melody': '31716708ed4a18ebf8a945aacd52a9594ee904a33988aec3dde11932f9a7074e',
  'only snare': '2d703d0c433d0a883d5cd6a215b59e7d83407ad7fb990c6d0202041ccf27d1b1',
  'only sixteenthHat': '166bb2cb677ceb5f3c8d36112a73a4705f02b36d92ced31fca9846ff258cbc60',
  'only arp': '1b12677c45871ff45e3b7da38f35d62241050b658fc7e3eb69811f6aab1726f6',
  'only bassPulse': '9d050ad6a13200104707c49f264930e11284a7b89956ca2367f2ef2e0ca5a84c',
  'only harmony': '76b3f30cec5240055ecd284278aa4dc84a468fa014eb0f9dc8c01ba89c7b1deb',
  'only counter': '5eb0e6f2b4d42032afed2c261ed7e7c1edd78a86600d961a56ec041bab7fca4c',
  'only fill': 'b677cc129f5cba8bbeaeb076e97fef5395846b0d7c0ef605f01e19f815c25c3b',
  'mixed': '818891779a5b7d7ae5608ef51aedb1c65746377e165aacdb5942f4c564a26837',
};

describe('Classic song is pinned', () => {
  for (const [name, slots] of Object.entries(SETS)) {
    it(`is byte-identical across all 512 steps: ${name}`, () => {
      expect(digest(slots)).toBe(PINNED[name]);
    });
  }
});
