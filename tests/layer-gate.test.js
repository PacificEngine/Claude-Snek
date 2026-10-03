import { describe, it, expect } from 'vitest';
import { createLayerGate } from '../src/core/layer-gate.js';

// The gate works on the eleven slots (t0..t10) whatever track is playing; names below are the Classic ones.
const SLOT = { kick: 't0', bass: 't1', hat: 't2', melody: 't3', snare: 't4', sixteenthHat: 't5', arp: 't6', bassPulse: 't7', harmony: 't8', counter: 't9', fill: 't10' };
const NONE = Object.fromEntries(Object.values(SLOT).map((key) => [key, false]));
const with_ = (...names) => ({ ...NONE, ...Object.fromEntries(names.map((n) => [SLOT[n], true])) });

describe('layer gate', () => {
  it('holds exactly the eleven slots t0..t10 until the first bar line', () => {
    expect(Object.keys(createLayerGate(() => NONE).layersFor(3))).toEqual(['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10']);
  });

  it('holds nothing active until the first bar line', () => {
    const gate = createLayerGate(() => with_('hat', 'melody'));
    expect(gate.layersFor(5)).toEqual(NONE);
  });

  it('plays kick and bass from the very first step when their triggers are 0', () => {
    const gate = createLayerGate(() => with_('kick', 'bass'));
    expect(gate.layersFor(0)).toMatchObject({ t0: true, t1: true });
  });

  it('keeps a kick that is not yet triggered off through the first bar', () => {
    const gate = createLayerGate(() => with_('bass'));
    expect(gate.layersFor(0)).toMatchObject({ t0: false, t1: true });
  });

  it('adopts the current layers on a downbeat', () => {
    const gate = createLayerGate(() => with_('hat', 'melody'));
    expect(gate.layersFor(0)).toEqual(with_('hat', 'melody'));
  });

  it('holds the set through the bar even if it changes mid-bar', () => {
    let layers = with_('hat');
    const gate = createLayerGate(() => layers);
    expect(gate.layersFor(0)).toEqual(with_('hat'));
    layers = with_('hat', 'fill');
    expect(gate.layersFor(5)).toEqual(with_('hat'));
    expect(gate.layersFor(15)).toEqual(with_('hat'));
    expect(gate.layersFor(16)).toEqual(with_('hat', 'fill'));
  });

  it('drops back to nothing on the next downbeat after a restart', () => {
    let layers = with_('arp');
    const gate = createLayerGate(() => layers);
    expect(gate.layersFor(32)).toEqual(with_('arp'));
    layers = NONE;
    expect(gate.layersFor(0)).toEqual(NONE);
  });
});
