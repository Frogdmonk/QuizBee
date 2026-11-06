export type QuizStatus = 'draft' | 'published' | 'archived';
export type QuestionType = 'multiple_choice' | 'true_false' | 'image_choice';

/** Client-side editable answer option. `key` is a local, stable React key. */
export type OptionDraft = {
  key: string;
  label: string;
  imagePath: string | null;
  isCorrect: boolean;
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
};

export type QuizDraft = {
  id: string | null;
  title: string;
  description: string;
  subject: string;
  coverImagePath: string | null;
  speedScoring: boolean;
  status: QuizStatus;
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
