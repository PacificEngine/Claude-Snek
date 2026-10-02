import { describe, it, expect } from 'vitest';
import { createLayerGate } from '../src/core/layer-gate.js';

const NONE = {
  kick: false, bass: false, hat: false, melody: false, snare: false, sixteenthHat: false, arp: false,
  bassPulse: false, harmony: false, counter: false, fill: false,
};
const with_ = (...names) => ({ ...NONE, ...Object.fromEntries(names.map((n) => [n, true])) });

describe('layer gate', () => {
  it('holds nothing active until the first bar line', () => {
    const gate = createLayerGate(() => with_('hat', 'melody'));
    expect(gate.layersFor(5)).toEqual(NONE);
  });

  it('plays kick and bass from the very first step when their triggers are 0', () => {
    const gate = createLayerGate(() => with_('kick', 'bass'));
    expect(gate.layersFor(0)).toMatchObject({ kick: true, bass: true });
  });

  it('keeps a kick that is not yet triggered off through the first bar', () => {
    const gate = createLayerGate(() => with_('bass'));
    expect(gate.layersFor(0)).toMatchObject({ kick: false, bass: true });
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
