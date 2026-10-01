import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);

describe('index.html touch controls', () => {
  it.each(['up', 'down', 'left', 'right'])('has a %s direction button', (direction) => {
    expect(buttons.some((b) => b.includes('data-action="direction"') && b.includes(`data-direction="${direction}"`))).toBe(true);
  });
  it.each(['pause', 'restart', 'mute'])('has a %s button', (action) => {
    expect(buttons.some((b) => b.includes(`data-action="${action}"`))).toBe(true);
  });
  it('gives every button an accessible name and type=button', () => {
    buttons.forEach((b) => {
      expect(b).toContain('aria-label=');
      expect(b).toContain('type="button"');
    });
  });
  it('keeps the page free of inline scripts and styles (CSP)', () => {
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)/);
    expect(html).not.toMatch(/\sstyle=/);
  });
});

describe('style.css touch targets', () => {
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({
    selectors: m[1].split(',').map((s) => s.trim()),
    body: m[2],
  }));
  const muteRules = rules.filter((r) => r.selectors.includes('#mute'));

  it('sizes the Mute button as a touch target of at least 48px', () => {
    const heights = muteRules.map((r) => r.body.match(/min-height:\s*(\d+)px/)).filter(Boolean).map((m) => Number(m[1]));
    expect(Math.max(0, ...heights)).toBeGreaterThanOrEqual(48);
  });
  it('shows pressed and muted states on the Mute button', () => {
    expect(rules.some((r) => r.selectors.some((s) => s.includes('#mute[aria-pressed="true"]')))).toBe(true);
    expect(rules.some((r) => r.selectors.some((s) => s.includes('#mute:active')))).toBe(true);
  });
  it('disables double-tap zoom delay on the Mute button', () => {
    expect(muteRules.some((r) => /touch-action:\s*manipulation/.test(r.body))).toBe(true);
  });
});

describe('start message', () => {
  it('tells touch players that tapping a direction starts the game', () => {
    const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    expect(main).toContain('tap a direction');
  });
});

describe('status messages', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  it('mentions the touch controls when paused', () => {
    expect(main).toContain('Paused — press P or tap Pause to resume');
  });
  it('mentions the touch controls on game over', () => {
    expect(main).toContain('Game over — press Enter or tap Restart');
  });
});
