import { LEARNING_LIMITS, recoveryIssues } from '@/lib/learning';
import { CODE_LIMITS } from '@/lib/code';
import type { OptionDraft, QuestionDraft, QuestionType, QuizDraft } from '@/types/quiz';

/* Limits shared with supabase/migrations/*_phase2_quizzes.sql — keep in sync. */
export const LIMITS = {
  titleMax: 120,
  descriptionMax: 1000,
  subjectMax: 60,
  promptMax: 300,
  explanationMax: 500,
  optionLabelMax: 120,
  maxQuestions: 100,
  minOptions: 2,
  maxOptions: 4,
  timeMin: 5,
  timeMax: 120,
} as const;

export const DEFAULT_TIME_LIMIT = 20;
export const DEFAULT_POINTS = 1000;

export const TIME_LIMIT_CHOICES = [5, 10, 15, 20, 30, 45, 60, 90, 120] as const;

export const POINTS_CHOICES = [
  { value: 0, label: 'No points' },
  { value: 500, label: 'Half (500)' },
  { value: 1000, label: 'Standard (1000)' },
  { value: 2000, label: 'Double (2000)' },
] as const;

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple choice',
  true_false: 'True or false',
  image_choice: 'Picture answers',
};

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `k${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function newOption(label = ''): OptionDraft {
  return { key: newKey(), label, imagePath: null, isCorrect: false, misconception: '', isCode: false };
}

function trueFalseOptions(previous?: OptionDraft[]): OptionDraft[] {
  // Preserve which answer was marked correct if the labels already match.
  const wasTrue = previous?.find((o) => o.label === 'True')?.isCorrect ?? false;
  const wasFalse = previous?.find((o) => o.label === 'False')?.isCorrect ?? false;
  return [
    { ...newOption('True'), isCorrect: wasTrue },
    { ...newOption('False'), isCorrect: wasFalse },
  ];
}

export function newQuestion(type: QuestionType = 'multiple_choice'): QuestionDraft {
  return {
    key: newKey(),
    type,
    prompt: '',
    imagePath: null,
    timeLimitSeconds: DEFAULT_TIME_LIMIT,
    points: DEFAULT_POINTS,
    explanation: '',
    options: type === 'true_false' ? trueFalseOptions() : [newOption(), newOption(), newOption(), newOption()],
    level: null,
    objective: '',
    topic: '',
    difficulty: null,
    kind: null,
    recovery: null,
    code: null,
  };
}

/** Switches a question's type, keeping as much of the teacher's work as possible. */
export function changeQuestionType(question: QuestionDraft, type: QuestionType): QuestionDraft {
  if (question.type === type) return question;
  if (type === 'true_false') return { ...question, type, options: trueFalseOptions(question.options) };
  let options = question.options;
  if (question.type === 'true_false') {
    options = [newOption(), newOption(), newOption(), newOption()];
  }
  return { ...question, type, options };
}

export function emptyQuiz(): QuizDraft {
  return {
    id: null,
    title: '',
    description: '',
    subject: '',
    coverImagePath: null,
    speedScoring: true,
    status: 'draft',
    revision: 0,
    questions: [newQuestion()],
  };
}

/** Problems that block publishing a question (mirrors private.quiz_issues). */
export function questionIssues(q: QuestionDraft): string[] {
  const issues: string[] = [];
  if (q.prompt.trim() === '') issues.push('Write the question text.');
  const count = q.options.length;
  if (q.type === 'true_false' && count !== 2) issues.push('True/false questions need exactly 2 answers.');
  if (q.type !== 'true_false' && (count < LIMITS.minOptions || count > LIMITS.maxOptions)) {
    issues.push('Add between 2 and 4 answers.');
  }
  if (q.type !== 'image_choice' && q.options.some((o) => o.label.trim() === '')) issues.push('Fill in every answer.');
  if (q.type === 'image_choice' && q.options.some((o) => !o.imagePath)) issues.push('Add an image to every answer.');
  if (q.options.filter((o) => o.isCorrect).length !== 1) issues.push('Mark the correct answer.');
  if (q.code && q.code.content.trim() === '') issues.push('Add the code, or remove the code block.');
  issues.push(...recoveryIssues(q.recovery));
  return issues;
}

export type QuizIssues = {
  quiz: string[];
  byQuestion: Record<string, string[]>;
  count: number;
};

export function quizIssues(draft: QuizDraft): QuizIssues {
  const quiz: string[] = [];
  if (draft.title.trim() === '') quiz.push('Give your quiz a title.');
  if (draft.questions.length === 0) quiz.push('Add at least one question.');
  const byQuestion: Record<string, string[]> = {};
  let count = quiz.length;
  for (const q of draft.questions) {
    const issues = questionIssues(q);
    if (issues.length) {
      byQuestion[q.key] = issues;
      count += issues.length;
    }
  }
  return { quiz, byQuestion, count };
}

/** Structural problems that block saving at all (length limits, title). */
export function saveBlockers(draft: QuizDraft): string[] {
  const out: string[] = [];
  const title = draft.title.trim();
  if (!title) out.push('Give your quiz a title before saving.');
  if (title.length > LIMITS.titleMax) out.push(`The title can be at most ${LIMITS.titleMax} characters.`);
  if (draft.description.trim().length > LIMITS.descriptionMax) out.push('The description is too long.');
  if (draft.subject.trim().length > LIMITS.subjectMax) out.push('The subject is too long.');
  if (draft.questions.length > LIMITS.maxQuestions) out.push(`A quiz can have at most ${LIMITS.maxQuestions} questions.`);
  draft.questions.forEach((q, i) => {
    if (q.prompt.trim().length > LIMITS.promptMax) out.push(`Question ${i + 1}: the question text is too long.`);
    if (q.explanation.trim().length > LIMITS.explanationMax) out.push(`Question ${i + 1}: the explanation is too long.`);
    if (q.options.some((o) => o.label.trim().length > LIMITS.optionLabelMax)) out.push(`Question ${i + 1}: an answer is too long.`);
    if (q.code && q.code.content.length > CODE_LIMITS.contentMax) out.push(`Question ${i + 1}: the code can be at most ${CODE_LIMITS.contentMax} characters.`);
    if (q.objective.trim().length > LEARNING_LIMITS.objectiveMax) out.push(`Question ${i + 1}: the learning objective is too long.`);
    if (q.topic.trim().length > LEARNING_LIMITS.topicMax) out.push(`Question ${i + 1}: the topic is too long.`);
    if (q.options.some((o) => o.misconception.trim().length > LEARNING_LIMITS.misconceptionMax)) out.push(`Question ${i + 1}: a misconception note is too long.`);
    if (q.recovery) {
      const r = q.recovery;
      if (r.prompt.trim().length > LIMITS.promptMax) out.push(`Question ${i + 1}: the recovery question is too long.`);
      if (r.explanation.trim().length > LIMITS.explanationMax) out.push(`Question ${i + 1}: the recovery explanation is too long.`);
      if (r.options.some((o) => o.label.trim().length > LIMITS.optionLabelMax)) out.push(`Question ${i + 1}: a recovery answer is too long.`);
      if (r.options.some((o) => o.misconception.trim().length > LEARNING_LIMITS.misconceptionMax)) out.push(`Question ${i + 1}: a recovery misconception note is too long.`);
    }
  });
  return out;
}

/**
 * Canonical serialisation used both for saving and for "unsaved changes" detection.
 * `revision` is deliberately excluded: it changes on every save without the content changing.
 */
export function toSavePayload(draft: QuizDraft) {
  return {
    id: draft.id,
    title: draft.title.trim(),
    description: draft.description.trim(),
    subject: draft.subject.trim(),
    cover_image_path: draft.coverImagePath,
    speed_scoring: draft.speedScoring,
    questions: draft.questions.map((q) => ({
      type: q.type,
      prompt: q.prompt.trim(),
      image_path: q.imagePath,
      time_limit_seconds: q.timeLimitSeconds,
      points: q.points,
      explanation: q.explanation.trim(),
      // Code is kept exactly as written (no trimming: indentation matters).
      code: q.code && { language: q.code.language, content: q.code.content },
      options: q.options.map((o) => ({ label: o.label.trim(), image_path: o.imagePath, is_correct: o.isCorrect, misconception: o.misconception.trim(), is_code: o.isCode })),
      level: q.level,
      objective: q.objective.trim(),
      topic: q.topic.trim(),
      difficulty: q.difficulty,
      kind: q.kind,
      recovery: q.recovery && {
        prompt: q.recovery.prompt.trim(),
        explanation: q.recovery.explanation.trim(),
        time_limit_seconds: q.recovery.timeLimitSeconds,
        options: q.recovery.options.map((o) => ({ label: o.label.trim(), is_correct: o.isCorrect, misconception: o.misconception.trim() })),
      },
    })),
  };
}

export function draftFingerprint(draft: QuizDraft): string {
  return JSON.stringify(toSavePayload(draft));
}
