import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FIELDS } from '../src/core/difficulty.js';

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

describe('difficulty menu markup', () => {
  it('has an open button, a dialog, a selector with the four difficulties, and Apply and Cancel', () => {
    expect(html).toContain('id="difficulty-open"');
    expect(html).toContain('<dialog id="difficulty-dialog"');
    for (const d of ['easy', 'medium', 'hard', 'custom']) {
      expect(html).toMatch(new RegExp(`<option value="${d}"`));
    }
    expect(html).toContain('id="difficulty-fields"');
    expect(html).toContain('id="difficulty-apply"');
    expect(html).toContain('id="difficulty-cancel"');
    expect(html).toContain('id="best-wrap"');
  });
  it('keeps every button an accessible type=button (the dialog buttons too)', () => {
    const all = [...html.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
    expect(all.length).toBeGreaterThanOrEqual(10);
    all.forEach((b) => { expect(b).toContain('type="button"'); expect(b).toContain('aria-label='); });
  });
  it('builds the fields with DOM APIs, not innerHTML', () => {
    const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
    expect(menu).not.toMatch(/innerHTML|insertAdjacentHTML|eval\(/);
    expect(menu).toContain('createElement');
  });
  it('renders list fields as numeric-keyboard text inputs showing the formatted list', () => {
    const menu = readFileSync(new URL('../src/menu.js', import.meta.url), 'utf8');
    expect(menu).toContain('formatList');
    expect(menu).toContain("'numeric'");
    expect(menu).toMatch(/inputMode|inputmode/);
    expect(menu).not.toContain('.pattern');
  });
  it('groups the fields under the ten headings, each group contiguous in FIELDS order', () => {
    const groups = FIELDS.map((f) => f.group);
    const headings = groups.filter((g, i) => g !== groups[i - 1]);
    expect(headings).toEqual(['Board', 'BPM', 'Growth', 'Ghost', 'Walls', 'Bombs', 'Spawning walls', 'Enemies', 'Effects', 'Music']);
  });
  it('makes text inputs full width in the single-column layout', () => {
    const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.field input[^{]*\{[^}]*(width:\s*100%|box-sizing)/);
  });
  it('does not let the game keys fire while the dialog is open', () => {
    const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    expect(main).toContain("dialog[open]");
  });
  it('styles locked fields and lets the dialog scroll inside itself', () => {
    const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    expect(css).toMatch(/dialog[^{]*\{[^}]*overflow/);
    expect(css).toMatch(/\.locked|\[readonly\]/);
  });
});

describe('main.js keyboard handling', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  it("lets Enter reach a focused button, select or input instead of restarting", () => {
    expect(main).toContain("event.key === 'Enter' && event.target.closest?.('button, select, input')");
    expect(main.indexOf("event.key === 'Enter'")).toBeLessThan(main.indexOf('actionForKey(event.key)'));
  });
});
