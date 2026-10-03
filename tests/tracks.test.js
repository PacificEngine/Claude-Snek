import { describe, it, expect } from 'vitest';
import { TRACKS, TRACK_IDS, DEFAULT_TRACK, trackById, layerNames, eventsAt, SLOT_KEYS, VOICES, layersForTier } from '../src/core/track.js';

describe('track registry', () => {
  it('has Classic as the default track and the first one', () => {
    expect(DEFAULT_TRACK).toBe('classic');
    expect(TRACK_IDS[0]).toBe('classic');
    expect(trackById('classic')).toMatchObject({ id: 'classic', name: 'Classic' });
  });
  it('lists the id of every registered track', () => {
    expect(TRACK_IDS).toEqual(TRACKS.map((t) => t.id));
  });
  it('falls back to Classic for an unknown id', () => {
    expect(trackById('nope').id).toBe('classic');
    expect(trackById(undefined).id).toBe('classic');
    expect(trackById('__proto__').id).toBe('classic');
  });
  it('gives every track exactly eleven layers t0..t10, each with a name and a known voice', () => {
    TRACKS.forEach((track) => {
      expect(track.layers.map((l) => l.key)).toEqual(SLOT_KEYS);
      track.layers.forEach((l) => {
        expect(l.name.length).toBeGreaterThan(0);
        expect(VOICES).toContain(l.voice);
      });
    });
  });
  it('declares the voices a track may use', () => {
    expect(VOICES).toEqual(['kick', 'snare', 'hat', 'clap', 'tom', 'shaker', 'square', 'pulse', 'triangle', 'saw', 'sine']);
  });
});

describe('Classic layers', () => {
  it('are named in the order they enter by default', () => {
    expect(layerNames('classic')).toEqual([
      'Kick', 'Bass', 'Hi-Hat', 'Melody', 'Snare', 'Fast Hi-Hat', 'Arpeggio', 'Bass Pulse', 'Harmony', 'Counter-Melody', 'Drum Fill',
    ]);
  });
  it('names an unknown track like Classic', () => {
    expect(layerNames('nope')).toEqual(layerNames('classic'));
  });
});

describe('eventsAt with a track id', () => {
  it('plays Classic when no id or an unknown id is given', () => {
    const active = layersForTier(10);
    expect(eventsAt(64, active)).toEqual(eventsAt(64, active, 'classic'));
    expect(eventsAt(64, active, 'nope')).toEqual(eventsAt(64, active, 'classic'));
  });
});

describe('hits: the generic event contract', () => {
  const hits = (step, tier) => eventsAt(step, layersForTier(tier)).hits;
  it('lists kick, hat and bass on the first downbeat with their voice, length (in steps) and level', () => {
    expect(hits(0, 1)).toEqual([
      { voice: 'kick', note: null, length: 0, level: 0.9 },
      { voice: 'hat', note: null, length: 0, level: 0.12 },
      { voice: 'triangle', note: 45, length: 3.6, level: 0.55 },
    ]);
  });
  it('lists nothing on a silent step', () => {
    expect(hits(1, 1)).toEqual([]);
  });
  it('shortens the bass note when the pulse layer is on', () => {
    expect(hits(0, 8).find((h) => h.voice === 'triangle').length).toBe(1.8);
  });
  it('maps melody and harmony to square, counter-melody to saw', () => {
    const voices = hits(64, 10).map((h) => h.voice);
    expect(voices).toEqual(expect.arrayContaining(['square', 'saw', 'triangle', 'kick', 'hat']));
  });
});
