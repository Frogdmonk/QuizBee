import { autoMonsterHp } from '@/lib/battle/hp';
import type { Difficulty, DifficultySetting } from './types';

/*
 * Session difficulty, mirroring supabase/migrations/20261119090000_monster_engine.sql
 * (private.auto_difficulty, private.apply_difficulty_preset, the HP scaling in start_session_battle).
 * The lobby uses these to preview what the server will do when the game starts.
 */

export const DIFFICULTY_SETTINGS: readonly DifficultySetting[] = ['auto', 'easy', 'medium', 'hard', 'epic'];

export const DIFFICULTY_LABEL: Record<DifficultySetting, string> = {
  auto: 'Automatic',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  epic: 'Epic',
};

export const DIFFICULTY_HELP: Record<Difficulty, string> = {
  easy: 'Lower class targets, little healing, less HP. Good for first battles and hard quizzes.',
  medium: 'The standard battle.',
  hard: 'Higher class targets, more healing, more HP.',
  epic: 'Like hard, with even more HP, and the monster rages sooner.',
};

/** Automatic HP is multiplied by this (the teacher's own HP is never changed). */
export const HP_FACTOR: Record<Difficulty, number> = { easy: 0.85, medium: 1, hard: 1.15, epic: 1.3 };

/** What "automatic" becomes for a quiz with these question difficulties (null = not tagged). */
export function autoDifficulty(difficulties: readonly (string | null)[]): Difficulty {
  const total = difficulties.length;
  const tagged = difficulties.filter((d) => d !== null).length;
  const hard = difficulties.filter((d) => d === 'hard').length;
  const easy = difficulties.filter((d) => d === 'easy').length;
  if (tagged >= 4 && hard * 2 >= tagged) return 'easy';
  if (tagged >= 4 && total >= 10 && easy * 10 >= tagged * 6) return 'hard';
  return 'medium';
}

/** The difficulty the battle will have: the teacher's choice, or automatic resolved for this quiz. */
export function effectiveDifficulty(setting: DifficultySetting, difficulties: readonly (string | null)[]): Difficulty {
  return setting === 'auto' ? autoDifficulty(difficulties) : setting;
}

/** The automatic HP estimate at a difficulty (same rounding as the server). */
export function autoHpAt(players: number, questions: number, baseDamage: number, difficulty: Difficulty): number {
  const base = autoMonsterHp(players, questions, baseDamage);
  return Math.min(100000, Math.max(50, Math.round((base * HP_FACTOR[difficulty]) / 10) * 10));
}
