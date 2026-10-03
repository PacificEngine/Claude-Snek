import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TRACKS, TRACK_IDS, trackById, SLOT_KEYS, VOICES, TOTAL_STEPS, STEPS_PER_BAR, layersForTier } from '../src/core/track.js';

// Sound cannot be unit tested, so these pin the structure every track must have to be playable and mixable.

const DRUMS = ['kick', 'snare', 'hat', 'clap', 'tom', 'shaker'];
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

describe('the soundtrack registry', () => {
  it('lists the twelve soundtracks in order, Classic first', () => {
    expect(TRACK_IDS).toEqual(['classic', 'sunrise', 'midnight', 'neon', 'tropic', 'haunted', 'parade', 'abyss', 'dune', 'disco', 'storm', 'lullaby']);
  });
  it('gives every track a lowercase slug id and a unique name', () => {
    TRACKS.forEach((t) => expect(t.id).toMatch(/^[a-z][a-z0-9-]*$/));
    expect(new Set(TRACK_IDS).size).toBe(TRACKS.length);
    expect(new Set(TRACKS.map((t) => t.name)).size).toBe(TRACKS.length);
    TRACKS.forEach((t) => expect(t.name.length).toBeGreaterThan(0));
  });
  it('is what the header selector and the menu edit selector list (they build their options from TRACKS)', () => {
    const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
    expect(main).toMatch(/TRACKS\.forEach\(\(entry\) => \{[^}]*option\.value = entry\.id[^}]*option\.textContent = entry\.name/s);
    expect(menu).toContain('TRACKS.forEach');
    expect(menu).toContain('option.value = track.id');
    expect(menu).toContain('option.textContent = track.name');
    expect(TRACKS).toHaveLength(12);
  });
});

// Checks Classic fails by design: its layers are not independent (the old song's layers read each other) and its
// bass and intro do not follow the layered-track shape.
const CLASSIC_EXEMPT = ['classic'];
const LAYERED = TRACKS.filter(({ id }) => !CLASSIC_EXEMPT.includes(id));

describe('every layered soundtrack', () => {
  LAYERED.forEach((track) => {
    const { id } = track;
    describe(id, () => {
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
      it('enters the melody only after the intro: the first pitched melodic layer is silent for bars 0..3', () => {
        // The melody slot is t3 in every layered track; it must be silent in the four intro bars and sound by bar 8.
        const lead = (from, to) => steps.slice(from * 16, to * 16).flatMap((s) => hitsOf(id, s, only('t3')));
        expect(lead(0, 4)).toEqual([]);
        expect(lead(4, 8).length).toBeGreaterThan(0);
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

  it('are different songs: every pair differs with all layers on', () => {
    const song = (id) => JSON.stringify(steps.map((s) => hitsOf(id, s, ALL_ON)));
    expect(new Set(TRACK_IDS.map(song)).size).toBe(TRACK_IDS.length);
  });
});
