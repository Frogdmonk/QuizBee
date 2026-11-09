/**
 * The automatic monster HP, mirroring private.auto_monster_hp in
 * supabase/migrations/20261113090000_battle_phase1_arena.sql. Shown to the teacher as an estimate
 * in the lobby; the server fixes the real figure at the start with the actual class size.
 */
export function autoMonsterHp(players: number, questions: number, baseDamage: number): number {
  const raw = Math.round((Math.max(players, 1) * Math.max(questions, 1) * baseDamage * 0.7) / 10) * 10;
  return Math.min(100000, Math.max(50, raw));
}
