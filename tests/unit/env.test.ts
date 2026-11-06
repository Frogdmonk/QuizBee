import { describe, expect, it } from 'vitest';
import { isPrivilegedKey, parseEnv } from '@/lib/env';

const b64url = (obj: object) => btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const fakeJwt = (role: string) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ role, iss: 'supabase' })}.signature`;

describe('isPrivilegedKey', () => {
  it('flags new-style secret keys', () => {
    expect(isPrivilegedKey('sb_secret_abc123')).toBe(true);
  });
  it('flags legacy service_role JWTs', () => {
    expect(isPrivilegedKey(fakeJwt('service_role'))).toBe(true);
  });
  it('accepts publishable and legacy anon keys', () => {
    expect(isPrivilegedKey('sb_publishable_abc123')).toBe(false);
    expect(isPrivilegedKey(fakeJwt('anon'))).toBe(false);
  });
  it('does not throw on malformed input', () => {
    expect(isPrivilegedKey('a.b.c')).toBe(false);
  });
});

describe('parseEnv', () => {
  const valid = {
    VITE_SUPABASE_URL: 'https://abcd.supabase.co/',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_0123456789abcdef',
  };

  it('parses valid configuration and normalises URLs', () => {
    const result = parseEnv(valid, 'http://localhost:5173');
    expect(result).toEqual({
      ok: true,
      env: {
        supabaseUrl: 'https://abcd.supabase.co',
        supabaseKey: valid.VITE_SUPABASE_PUBLISHABLE_KEY,
        siteUrl: 'http://localhost:5173',
      },
    });
  });

  it('prefers VITE_PUBLIC_SITE_URL for share links', () => {
    const result = parseEnv({ ...valid, VITE_PUBLIC_SITE_URL: 'https://rally.pages.dev/' }, 'http://x');
    expect(result.ok && result.env.siteUrl).toBe('https://rally.pages.dev');
  });

  it('reports missing values', () => {
    const result = parseEnv({}, 'http://localhost');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('refuses a service-role key in the browser bundle', () => {
    const result = parseEnv({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_0123456789abcdefgh' }, 'http://x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]).toMatch(/SECRET/);
  });
});
