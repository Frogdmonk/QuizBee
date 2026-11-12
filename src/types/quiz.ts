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
  /** The answer is a short code snippet (shown in a monospaced font). */
  isCode: boolean;
};

/** Source code shown under a question (only displayed; never run). `language` is an id such as python, c, cpp, java. */
export type QuestionCode = { language: string; content: string };

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
  /** Code block shown under the question text, or null. */
  code: QuestionCode | null;
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
  /** The teacher's subject (folder) this quiz is filed in, or null. */
  subjectId: string | null;
  createdAt: string;
  updatedAt: string;
};
