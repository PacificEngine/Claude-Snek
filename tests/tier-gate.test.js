import { describe, it, expect } from 'vitest';
import { createTierGate } from '../src/core/tier-gate.js';

describe('tier gate', () => {
  it('holds tier 0 until the first bar line', () => {
    const gate = createTierGate(() => 3);
    expect(gate.tierFor(5)).toBe(0);
  });

  it('adopts the current tier on a downbeat', () => {
    const gate = createTierGate(() => 3);
    expect(gate.tierFor(0)).toBe(3);
  });

  it('holds the tier through the bar even if it rises mid-bar', () => {
    let tier = 1;
    const gate = createTierGate(() => tier);
    expect(gate.tierFor(0)).toBe(1);
    tier = 2;
    expect(gate.tierFor(5)).toBe(1);
    expect(gate.tierFor(15)).toBe(1);
    expect(gate.tierFor(16)).toBe(2);
  });

  it('drops back to 0 on the next downbeat after a restart', () => {
    let tier = 4;
    const gate = createTierGate(() => tier);
    expect(gate.tierFor(32)).toBe(4);
    tier = 0;
    expect(gate.tierFor(0)).toBe(0);
  });
});
