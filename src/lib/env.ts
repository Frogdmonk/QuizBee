/*
 * Validated by hand (not Zod) on purpose: this runs on the critical path of
 * every page load, and keeping Zod out of the entry chunk saves ~15 KB gzip
 * for students on slow phones. Zod is still used for all form validation.
 */

export type AppEnv = {
  supabaseUrl: string;
  supabaseKey: string;
  /** Origin used for share links and QR codes. */
  siteUrl: string;
};

export type EnvResult = { ok: true; env: AppEnv } | { ok: false; issues: string[] };

/**
 * Detects keys that must never reach a browser: new-style secret keys and
 * legacy JWT keys whose `role` claim is `service_role`.
 */
export function isPrivilegedKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { role?: unknown };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function readString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function parseEnv(raw: Record<string, unknown>, fallbackOrigin: string): EnvResult {
  const data = {
    VITE_SUPABASE_URL: readString(raw, 'VITE_SUPABASE_URL'),
    VITE_SUPABASE_PUBLISHABLE_KEY: readString(raw, 'VITE_SUPABASE_PUBLISHABLE_KEY'),
    VITE_PUBLIC_SITE_URL: readString(raw, 'VITE_PUBLIC_SITE_URL'),
  };
  const issues: string[] = [];
  if (!isHttpUrl(data.VITE_SUPABASE_URL)) {
    issues.push('VITE_SUPABASE_URL must be a full URL such as https://abcd.supabase.co');
  }
  if (data.VITE_SUPABASE_PUBLISHABLE_KEY.length < 20) {
    issues.push('VITE_SUPABASE_PUBLISHABLE_KEY is missing or too short');
  }
  if (data.VITE_PUBLIC_SITE_URL && !isHttpUrl(data.VITE_PUBLIC_SITE_URL)) {
    issues.push('VITE_PUBLIC_SITE_URL must be empty or a full URL such as https://rally.pages.dev');
  }
  if (issues.length > 0) return { ok: false, issues };

  if (isPrivilegedKey(data.VITE_SUPABASE_PUBLISHABLE_KEY)) {
    return {
      ok: false,
      issues: [
        'VITE_SUPABASE_PUBLISHABLE_KEY contains a SECRET / service_role key. Replace it with the publishable (or legacy anon) key and rotate the secret key in the Supabase dashboard immediately.',
      ],
    };
  }
  const siteUrl = (data.VITE_PUBLIC_SITE_URL || fallbackOrigin).replace(/\/+$/, '');
  return {
    ok: true,
    env: {
      supabaseUrl: data.VITE_SUPABASE_URL.replace(/\/+$/, ''),
      supabaseKey: data.VITE_SUPABASE_PUBLISHABLE_KEY,
      siteUrl,
    },
  };
}

export const envResult: EnvResult = parseEnv(
  import.meta.env as unknown as Record<string, unknown>,
  typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
);

/** Use only after the app has confirmed `envResult.ok` (see main.tsx). */
export function getEnv(): AppEnv {
  if (!envResult.ok) {
    throw new Error(`Invalid environment configuration: ${envResult.issues.join('; ')}`);
  }
  return envResult.env;
}
