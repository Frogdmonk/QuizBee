import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getEnv } from '@/lib/env';

export type AppSupabaseClient = SupabaseClient<Database>;

/*
 * Two isolated auth contexts share one browser:
 *
 *  - teacher client: email/password accounts. Owns URL-based auth flows
 *    (email confirmation, password recovery) via detectSessionInUrl.
 *  - player client:  anonymous, session-scoped student identities.
 *
 * Separate storage keys mean a teacher can test-join their own game as a
 * student in another tab without being signed out, and a student sign-in can
 * never overwrite a teacher session on a shared classroom computer.
 * Both clients are created lazily so student pages never load teacher auth.
 */

let teacherClient: AppSupabaseClient | null = null;
let playerClient: AppSupabaseClient | null = null;

export const TEACHER_STORAGE_KEY = 'rally.teacher.auth';
export const PLAYER_STORAGE_KEY = 'rally.player.auth';

let initialAuthHash = '';

/**
 * The URL hash as it was before the teacher client processed it. Auth links
 * that fail (e.g. expired) carry `error_code` / `error_description` here.
 */
export function getInitialAuthHash(): string {
  return initialAuthHash;
}

export function getTeacherClient(): AppSupabaseClient {
  if (!teacherClient) {
    const env = getEnv();
    initialAuthHash = typeof window !== 'undefined' ? window.location.hash : '';
    teacherClient = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
      auth: {
        storageKey: TEACHER_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Implicit flow lets confirmation / reset links work even when opened
        // on a different device or browser than the one that requested them.
        flowType: 'implicit',
      },
    });
  }
  return teacherClient;
}

export function getPlayerClient(): AppSupabaseClient {
  if (!playerClient) {
    const env = getEnv();
    playerClient = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
      auth: {
        storageKey: PLAYER_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    });
  }
  return playerClient;
}
