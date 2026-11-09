import type { QuestionDifficulty, QuestionKind, QuestionLevel, RecoveryDraft } from '@/types/quiz';
import { newKey } from '@/lib/quiz-rules';

/*
 * Learning metadata for questions: levels, kinds with suggested timers, difficulty. Suggested timers
 * are starting points only: the teacher's time limit always wins, and difficulty and time are
 * separate settings on purpose (a hard question is not automatically a short one).
 */

export const LEVELS: readonly QuestionLevel[] = [1, 2, 3, 4];
export const LEVEL_LABEL: Record<QuestionLevel, string> = {
  1: 'Level 1 · Foundations',
  2: 'Level 2 · Application',
  3: 'Level 3 · Deeper reasoning',
  4: 'Final challenge',
};
export const LEVEL_SHORT: Record<QuestionLevel, string> = { 1: 'Level 1', 2: 'Level 2', 3: 'Level 3', 4: 'Final' };

export const KINDS: readonly QuestionKind[] = ['recall', 'concept', 'application', 'predict', 'bug', 'multistep'];
export const KIND_LABEL: Record<QuestionKind, string> = {
  recall: 'Basic recall',
  concept: 'Concept identification',
  application: 'Simple application',
  predict: 'Predict the output',
  bug: 'Find the bug',
  multistep: 'Multi-step reasoning',
};
/** Suggested time limits (seconds); starting values, not rules. */
export const SUGGESTED_SECONDS: Record<QuestionKind, number> = {
  recall: 15,
  concept: 15,
  application: 20,
  predict: 30,
  bug: 35,
  multistep: 45,
};

export const DIFFICULTIES: readonly QuestionDifficulty[] = ['easy', 'medium', 'hard'];
export const DIFFICULTY_LABEL: Record<QuestionDifficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export const LEARNING_LIMITS = { objectiveMax: 120, topicMax: 60, misconceptionMax: 200 } as const;

export function newRecovery(timeLimitSeconds = 20): RecoveryDraft {
  return {
    prompt: '',
    explanation: '',
    timeLimitSeconds,
    options: [0, 1, 2, 3].map(() => ({ key: newKey(), label: '', isCorrect: false, misconception: '' })),
  };
}

/** Problems that block publishing a recovery question (mirrors private.quiz_issues). */
export function recoveryIssues(r: RecoveryDraft | null): string[] {
  if (!r) return [];
  const issues: string[] = [];
  if (r.prompt.trim() === '') issues.push('Write the recovery question text.');
  if (r.options.length < 2 || r.options.length > 4) issues.push('Give the recovery question 2 to 4 answers.');
  if (r.options.some((o) => o.label.trim() === '')) issues.push('Fill in every recovery answer.');
  if (r.options.filter((o) => o.isCorrect).length !== 1) issues.push('Mark the recovery question’s correct answer.');
  return issues;
}
