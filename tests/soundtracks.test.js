import { describe, it, expect } from 'vitest';
import { TRACKS, TRACK_IDS, trackById, SLOT_KEYS, VOICES, TOTAL_STEPS, STEPS_PER_BAR, layersForTier } from '../src/core/track.js';

// Sound cannot be unit tested, so these pin the structure every track must have to be playable and mixable.

const DRUMS = ['kick', 'snare', 'hat', 'clap', 'tom', 'shaker'];
const NEW_TRACKS = ['sunrise', 'midnight'];
const ALL_ON = layersForTier(10);
const NONE = Object.fromEntries(SLOT_KEYS.map((k) => [k, false]));
const only = (key) => ({ ...NONE, [key]: true });
const steps = Array.from({ length: TOTAL_STEPS }, (_, i) => i);
const hitsOf = (id, step, active) => trackById(id).eventsAt(step, active).hits;
const key = (h) => `${h.voice}:${h.note}:${h.length}:${h.level}`;
const barHits = (id, bar) => steps.slice(bar * STEPS_PER_BAR, (bar + 1) * STEPS_PER_BAR).map((s) => hitsOf(id, s, ALL_ON).map(key));

// Classic's loudest all-on step sums to 2.55; no track may stack louder than that plus a little headroom.
const MAX_SIMULTANEOUS_HITS = 8;
const MAX_SUMMED_LEVEL = 2.6;

describe('the two new soundtracks', () => {
  it('are registered after Classic with their names', () => {
    expect(TRACK_IDS).toEqual(['classic', 'sunrise', 'midnight']);
    expect(trackById('sunrise').name).toBe('Sunrise');
    expect(trackById('midnight').name).toBe('Midnight');
  });

  NEW_TRACKS.forEach((id) => {
    describe(id, () => {
      const track = trackById(id);
      it('has eleven layers t0..t10 with unique instrument names and known voices', () => {
        expect(track.layers.map((l) => l.key)).toEqual(SLOT_KEYS);
        const names = track.layers.map((l) => l.name);
        expect(new Set(names).size).toBe(11);
        names.forEach((n) => expect(n).not.toMatch(/^(t|tier|layer)\s*\d+$/i));
        track.layers.forEach((l) => expect(VOICES).toContain(l.voice));
      });
      it('loops every 512 steps', () => {
        [0, 37, 200, 511].forEach((s) => {
          expect(track.eventsAt(s + TOTAL_STEPS, ALL_ON)).toEqual(track.eventsAt(s, ALL_ON));
          expect(track.eventsAt(s - TOTAL_STEPS, ALL_ON)).toEqual(track.eventsAt(s, ALL_ON));
        });
      });
      it('plays nothing with every layer off', () => {
        steps.forEach((s) => expect(hitsOf(id, s, NONE)).toEqual([]));
      });
      it('sounds every layer on its own somewhere in the loop, in that layer\'s voice', () => {
        track.layers.forEach((layer) => {
          const alone = steps.flatMap((s) => hitsOf(id, s, only(layer.key)));
          expect(alone.length, layer.name).toBeGreaterThan(0);
          alone.forEach((h) => expect(h.voice, layer.name).toBe(layer.voice));
        });
      });
      it('only adds hits as layers are added: every layer plays the same alone as in the full stack', () => {
        steps.forEach((s) => {
          const full = hitsOf(id, s, ALL_ON).map(key).sort();
          const sumOfParts = SLOT_KEYS.flatMap((k) => hitsOf(id, s, only(k))).map(key).sort();
          expect(full).toEqual(sumOfParts);
        });
      });
      it('keeps every hit of the earlier tiers when the next tier comes in', () => {
        for (let tier = 0; tier < 10; tier++) {
          steps.forEach((s) => {
            const more = hitsOf(id, s, layersForTier(tier + 1)).map(key);
            hitsOf(id, s, layersForTier(tier)).map(key).forEach((h) => expect(more).toContain(h));
          });
        }
      });
      it('changes the bass note across the loop: more than six roots on the downbeats', () => {
        const roots = new Set();
        for (let bar = 0; bar < 32; bar++) roots.add(hitsOf(id, bar * STEPS_PER_BAR, only('t1')).map((h) => h.note).sort()[0]);
        expect(roots.size).toBeGreaterThan(6);
      });
      it('enters the melody only after the intro', () => {
        const lead = (bar) => steps.slice(bar * 16, bar * 16 + 16).flatMap((s) => hitsOf(id, s, only('t3')));
        [0, 1, 2, 3].forEach((bar) => expect(lead(bar)).toEqual([]));
        expect(lead(4).length).toBeGreaterThan(0);
      });
    });
  });
});

describe('every soundtrack', () => {
  TRACKS.forEach(({ id }) => {
    describe(id, () => {
      it('only emits playable hits: known voice, level 0.05..1, finite length, pitched notes in 36..110', () => {
        steps.forEach((s) => {
          hitsOf(id, s, ALL_ON).forEach((h) => {
            expect(VOICES).toContain(h.voice);
            expect(h.level).toBeGreaterThanOrEqual(0.05);
            expect(h.level).toBeLessThanOrEqual(1);
            expect(Number.isFinite(h.length)).toBe(true);
            if (DRUMS.includes(h.voice)) {
              expect(h.length).toBeGreaterThanOrEqual(0);
            } else {
              expect(h.length).toBeGreaterThan(0);
              expect(Number.isInteger(h.note)).toBe(true);
              expect(h.note).toBeGreaterThanOrEqual(36);
              expect(h.note).toBeLessThanOrEqual(110);
            }
          });
        });
      });
      it(`stacks at most ${MAX_SIMULTANEOUS_HITS} hits and a summed level under ${MAX_SUMMED_LEVEL} on any step`, () => {
        steps.forEach((s) => {
          const hits = hitsOf(id, s, ALL_ON);
          expect(hits.length).toBeLessThanOrEqual(MAX_SIMULTANEOUS_HITS);
          expect(hits.reduce((sum, h) => sum + h.level, 0)).toBeLessThanOrEqual(MAX_SUMMED_LEVEL);
        });
      });
      it('does not repeat one bar: more than six different bars in the full loop', () => {
        const bars = new Set(Array.from({ length: 32 }, (_, bar) => JSON.stringify(barHits(id, bar))));
        expect(bars.size).toBeGreaterThan(6);
      });
      it('has sections: an intro bar differs from a chorus bar', () => {
        expect(barHits(id, 0)).not.toEqual(barHits(id, 12));
      });
    });
  });

  it('are three different songs', () => {
    const song = (id) => JSON.stringify(steps.map((s) => hitsOf(id, s, ALL_ON)));
    expect(new Set(TRACK_IDS.map(song)).size).toBe(TRACK_IDS.length);
  });
});
