import type { AppSupabaseClient } from '@/lib/supabase';

/* Student reactions (supabase/migrations/*_phase5_reactions_autoboard.sql). */

export type ReactionResult =
  | { status: 'sent' }
  | { status: 'rate_limited'; retryMs: number }
  | { status: 'not_now' }
  | { status: 'disabled' };

export async function sendReaction(client: AppSupabaseClient, sessionId: string, emote: string): Promise<ReactionResult> {
  const { data, error } = await client.rpc('send_reaction', { p_session_id: sessionId, p_emote: emote });
  if (error) throw error;
  const r = data as { status: ReactionResult['status']; retry_ms?: number };
  if (r.status === 'rate_limited') return { status: 'rate_limited', retryMs: r.retry_ms ?? 2000 };
  return { status: r.status } as ReactionResult;
}

/** Host only. Returns the new state version. */
export async function setReactionsEnabled(client: AppSupabaseClient, sessionId: string, enabled: boolean): Promise<number> {
  const { data, error } = await client.rpc('set_reactions_enabled', { p_session_id: sessionId, p_enabled: enabled });
  if (error) throw error;
  return data as number;
}
