import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the Match Day palette (docs/DESIGN.md §2): every declared text pair must reach WCAG AA
 * (4.5:1) and every control-edge / large-fill pair 3:1. Change a colour and this tells you if it
 * broke a pairing the UI relies on.
 */
const css = readFileSync(join(process.cwd(), 'src/styles/index.css'), 'utf8');
const tokens = new Map<string, string>();
for (const match of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
  tokens.set(match[1], match[2]);
}
tokens.set('white', '#ffffff');

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function color(name: string): string {
  const value = tokens.get(name);
  if (!value) throw new Error(`Missing colour token --color-${name}`);
  return value;
}

const TEXT_PAIRS: [string, string][] = [
  ['ink-900', 'paper'],
  ['ink-500', 'paper'],
  ['ink-500', 'surface'],
  ['ink-500', 'paper-sunk'],
  ['ink-400', 'paper'],
  ['signal-600', 'surface'],
  ['signal-600', 'paper'],
  ['signal-700', 'paper-sunk'],
  ['white', 'signal-600'],
  // Primary buttons: brand emerald with Nile Blue text, and their hover.
  ['ink-900', 'emerald-500'],
  ['ink-900', 'emerald-600'],
  ['ink-900', 'volt-400'],
  ['white', 'answer-a'],
  ['white', 'answer-b'],
  ['white', 'answer-c'],
  ['ink-900', 'answer-d'],
  ['night-text', 'night-950'],
  ['night-text', 'night-900'],
  ['night-muted', 'night-950'],
  ['night-muted', 'night-900'],
  ['night-muted', 'night-800'],
  ['signal-400', 'night-950'],
  ['signal-400', 'night-900'],
  ['success-600', 'success-50'],
  ['white', 'success-600'],
  ['error-600', 'error-50'],
  ['white', 'error-600'],
  ['warning-700', 'warning-50'],
  ['info-700', 'info-50'],
  ['night-950', 'volt-400'],
  ['night-950', 'success-400'],
  ['error-300', 'night-900'],
];

const EDGE_PAIRS: [string, string][] = [
  ['line-strong', 'surface'],
  ['line-strong', 'paper'],
  ['night-line', 'night-950'],
  ['night-line', 'night-900'],
  ['answer-a', 'night-950'],
  ['answer-b', 'night-950'],
  ['answer-c', 'night-950'],
  ['answer-d', 'night-950'],
];

describe('design tokens', () => {
  it('parses the palette', () => {
    expect(tokens.size).toBeGreaterThan(40);
  });

  it.each(TEXT_PAIRS)('text %s on %s reaches 4.5:1', (fg, bg) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(EDGE_PAIRS)('edge %s against %s reaches 3:1', (fg, bg) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(3);
  });

  it('keeps legacy aliases pointing at accessible values', () => {
    expect(color('flame-500')).toBe(color('signal-600'));
    expect(color('mint-600')).toBe(color('success-600'));
    expect(color('rose-600')).toBe(color('error-600'));
  });
});
