import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The app can be hosted on Cloudflare Pages (public/_headers) or Vercel (vercel.json).
 * Both must send the same security headers, and Vercel must fall back to index.html
 * for client-side routes (or refreshing /join/123456 returns 404).
 */
const root = process.cwd();

function cloudflareHeaders(): Record<string, string> {
  const text = readFileSync(join(root, 'public/_headers'), 'utf8');
  const block = text.split(/^\/\*\s*$/m)[1] ?? '';
  const headers: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const match = /^\s+([A-Za-z-]+):\s*(.+)$/.exec(line);
    if (match) headers[match[1]] = match[2].trim();
  }
  return headers;
}

type VercelConfig = {
  rewrites: { source: string; destination: string }[];
  headers: { source: string; headers: { key: string; value: string }[] }[];
};

const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as VercelConfig;

function vercelHeaders(source: string): Record<string, string> {
  const entry = vercel.headers.find((h) => h.source === source);
  return Object.fromEntries((entry?.headers ?? []).map((h) => [h.key, h.value]));
}

describe('hosting config', () => {
  it('Vercel sends the same security headers as Cloudflare', () => {
    const cf = cloudflareHeaders();
    expect(Object.keys(cf)).toContain('Content-Security-Policy');
    expect(vercelHeaders('/(.*)')).toEqual(cf);
  });

  it('Vercel caches hashed assets for a year', () => {
    expect(vercelHeaders('/assets/(.*)')['Cache-Control']).toBe('public, max-age=31536000, immutable');
  });

  it('Vercel rewrites client routes to index.html but not assets', () => {
    const rule = vercel.rewrites.find((r) => r.destination === '/index.html');
    expect(rule).toBeDefined();
    const pattern = new RegExp(`^${rule!.source}$`);
    for (const path of ['/join/482913', '/teacher/quizzes', '/presenter/abc', '/']) {
      expect(pattern.test(path), path).toBe(true);
    }
    expect(pattern.test('/assets/index-abc123.js')).toBe(false);
  });
});
