import type { AppSupabaseClient } from '@/lib/supabase';
import type { Json } from '@/types/database';
import type { PerMode, VoteStatus } from '@/types/game';
import type { DifficultySetting, MonsterSpec } from '@/lib/monsters/types';

/* Boss battle (supabase/migrations/*_battle_phase1_arena.sql). HP and damage are the server's job. */

export type BattleSettingsInput = {
  enabled?: boolean;
  /** null = automatic (fits the class size and quiz length). */
  hp?: number | null;
  baseDamage?: number;
  /** A preset that sets the class targets and the monster's healing. */
  intensity?: 'gentle' | 'standard' | 'fierce';
  modeTimers?: boolean;
  rageAt?: number;
  enragedAt?: number;
  targets?: Partial<PerMode<number>>;
  heal?: Partial<PerMode<number>>;
  timers?: Partial<PerMode<number | null>>;
};

/** Host only, lobby only. Returns the new state version. */
export async function setBattleSettings(client: AppSupabaseClient, sessionId: string, input: BattleSettingsInput): Promise<number> {
  const settings: { [key: string]: Json | undefined } = {};
  if (input.enabled !== undefined) settings.enabled = input.enabled;
  if (input.hp !== undefined) settings.hp = input.hp;
  if (input.baseDamage !== undefined) settings.base_damage = input.baseDamage;
  if (input.intensity !== undefined) settings.intensity = input.intensity;
  if (input.modeTimers !== undefined) settings.mode_timers = input.modeTimers;
  if (input.rageAt !== undefined) settings.rage_at = input.rageAt;
  if (input.enragedAt !== undefined) settings.enraged_at = input.enragedAt;
  if (input.targets !== undefined) settings.targets = input.targets;
  if (input.heal !== undefined) settings.heal = input.heal;
  if (input.timers !== undefined) settings.timers = input.timers;
  const { data, error } = await client.rpc('set_battle_settings', { p_session_id: sessionId, p_settings: settings });
  if (error) throw error;
  return data as number;
}

/**
 * The session's monster (generated in the lobby; locked once the game starts). Host only.
 * Null goes back to the default monster.
 */
export async function setBattleMonster(client: AppSupabaseClient, sessionId: string, spec: MonsterSpec | null): Promise<number> {
  const { data, error } = await client.rpc('set_battle_monster', { p_session_id: sessionId, p_spec: spec as unknown as Json });
  if (error) throw error;
  return data as number;
}

/** The session's difficulty: automatic, or a fixed one (which applies its preset at once). Host only, lobby only. */
export async function setBattleDifficulty(client: AppSupabaseClient, sessionId: string, difficulty: DifficultySetting): Promise<number> {
  const { data, error } = await client.rpc('set_battle_difficulty', { p_session_id: sessionId, p_difficulty: difficulty });
  if (error) throw error;
  return data as number;
}

/** A student's vote for a weapon. One per round; it cannot be changed. */
export async function castWeaponVote(client: AppSupabaseClient, voteId: string, weapon: string): Promise<VoteStatus> {
  const { data, error } = await client.rpc('cast_weapon_vote', { p_vote_id: voteId, p_weapon: weapon });
  if (error) throw error;
  return (data as { status: VoteStatus }).status;
}

/** Host: choose the weapon for the class, or cancel the vote (null). Returns the new state version. */
export async function decideWeaponVote(client: AppSupabaseClient, sessionId: string, weapon: string | null): Promise<number> {
  const { data, error } = await client.rpc('decide_weapon_vote', { p_session_id: sessionId, p_weapon: weapon });
  if (error) throw error;
  return data as number;
}

/** Host: use the equipped weapon's special now (open question) or for the next question. */
export async function activateWeaponSpecial(client: AppSupabaseClient, sessionId: string): Promise<number> {
  const { data, error } = await client.rpc('use_weapon_special', { p_session_id: sessionId });
  if (error) throw error;
  return data as number;
}

export type WeaponSettingsInput = { weaponsEnabled?: boolean; unlockPct?: number; unlockCooldown?: number; voteSeconds?: number; runoffSeconds?: number };

/** Host, lobby only. Returns the new state version. */
export async function setWeaponSettings(client: AppSupabaseClient, sessionId: string, input: WeaponSettingsInput): Promise<number> {
  const settings: { [key: string]: Json | undefined } = {};
  if (input.weaponsEnabled !== undefined) settings.weapons_enabled = input.weaponsEnabled;
  if (input.unlockPct !== undefined) settings.unlock_pct = input.unlockPct;
  if (input.unlockCooldown !== undefined) settings.unlock_cooldown = input.unlockCooldown;
  if (input.voteSeconds !== undefined) settings.vote_seconds = input.voteSeconds;
  if (input.runoffSeconds !== undefined) settings.runoff_seconds = input.runoffSeconds;
  const { data, error } = await client.rpc('set_weapon_settings', { p_session_id: sessionId, p_settings: settings });
  if (error) throw error;
  return data as number;
}

export type ChooseResult = { status: 'chosen' | 'already' | 'closed'; chosen?: string };

/** A student picks one of the three power-ups offered in the draft. */
export async function choosePowerup(client: AppSupabaseClient, sessionId: string, key: string): Promise<ChooseResult> {
  const { data, error } = await client.rpc('choose_powerup', { p_session_id: sessionId, p_key: key });
  if (error) throw error;
  return data as ChooseResult;
}

/** A student uses their power-up on the running question. The server refuses (with a reason) when it would be wasted. */
export async function activatePowerup(client: AppSupabaseClient, sessionId: string): Promise<{ status: 'used' | 'armed'; hint?: string }> {
  const { data, error } = await client.rpc('use_powerup', { p_session_id: sessionId });
  if (error) throw error;
  return data as { status: 'used' | 'armed'; hint?: string };
}

export type TeamAbility = 'team_shield' | 'group_lightning' | 'knowledge_reveal' | 'final_rally';

/** Host: spend team energy on a team ability. Returns the new state version. */
export async function activateTeamAbility(client: AppSupabaseClient, sessionId: string, ability: TeamAbility): Promise<number> {
  const { data, error } = await client.rpc('use_team_ability', { p_session_id: sessionId, p_ability: ability });
  if (error) throw error;
  return data as number;
}

/** Host, lobby only. Returns the new state version. */
export async function setPowerupSettings(client: AppSupabaseClient, sessionId: string, input: { powerupsEnabled?: boolean; draftSeconds?: number }): Promise<number> {
  const settings: { [key: string]: Json | undefined } = {};
  if (input.powerupsEnabled !== undefined) settings.powerups_enabled = input.powerupsEnabled;
  if (input.draftSeconds !== undefined) settings.draft_seconds = input.draftSeconds;
  const { data, error } = await client.rpc('set_powerup_settings', { p_session_id: sessionId, p_settings: settings });
  if (error) throw error;
  return data as number;
}
