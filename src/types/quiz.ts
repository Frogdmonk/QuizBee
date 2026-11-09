export type QuizStatus = 'draft' | 'published' | 'archived';
export type QuestionType = 'multiple_choice' | 'true_false' | 'image_choice';

/** Client-side editable answer option. `key` is a local, stable React key. */
export type OptionDraft = {
  key: string;
  label: string;
  imagePath: string | null;
  isCorrect: boolean;
  /** For a wrong answer: why a student might pick it (shown to the class when it is the most common mistake). */
  misconception: string;
};

/** 1–3 = learning levels, 4 = the final mixed-concept challenge. */
export type QuestionLevel = 1 | 2 | 3 | 4;
export type QuestionKind = 'recall' | 'concept' | 'application' | 'predict' | 'bug' | 'multistep';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

/** A parallel question for the same objective, played when the class misses the mastery bar. Text answers only. */
export type RecoveryDraft = {
  prompt: string;
  explanation: string;
  timeLimitSeconds: number;
  options: { key: string; label: string; isCorrect: boolean; misconception: string }[];
};

export type QuestionDraft = {
  key: string;
  type: QuestionType;
  prompt: string;
  imagePath: string | null;
  timeLimitSeconds: number;
  points: number;
  explanation: string;
  options: OptionDraft[];
  level: QuestionLevel | null;
  objective: string;
  topic: string;
  difficulty: QuestionDifficulty | null;
  kind: QuestionKind | null;
  recovery: RecoveryDraft | null;
};

export type QuizDraft = {
  id: string | null;
  title: string;
  description: string;
  subject: string;
  coverImagePath: string | null;
  speedScoring: boolean;
  status: QuizStatus;
  /** Server revision this draft was loaded from (optimistic locking between editors). */
  revision: number;
  questions: QuestionDraft[];
};

export type QuizSummary = {
  id: string;
  title: string;
  description: string;
  subject: string;
  coverImagePath: string | null;
  status: QuizStatus;
  questionCount: number;
  sourceQuizId: string | null;
  createdAt: string;
  updatedAt: string;
};
