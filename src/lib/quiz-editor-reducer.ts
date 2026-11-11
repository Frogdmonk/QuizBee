import type { OptionDraft, QuestionDraft, QuestionType, QuizDraft, QuizStatus } from '@/types/quiz';
import { LIMITS, changeQuestionType, draftFingerprint, newKey, newOption, newQuestion } from './quiz-rules';

export type EditorState = {
  draft: QuizDraft;
  /** Fingerprint of the last saved (or loaded) version, for unsaved-change detection. */
  savedFingerprint: string;
};

type DetailsPatch = Partial<Pick<QuizDraft, 'title' | 'description' | 'subject' | 'coverImagePath' | 'speedScoring'>>;
type QuestionPatch = Partial<
  Pick<QuestionDraft, 'prompt' | 'imagePath' | 'timeLimitSeconds' | 'points' | 'explanation' | 'level' | 'objective' | 'topic' | 'difficulty' | 'kind' | 'recovery' | 'code'>
>;
type OptionPatch = Partial<Pick<OptionDraft, 'label' | 'imagePath' | 'misconception' | 'isCode'>>;

export type EditorAction =
  | { type: 'load'; draft: QuizDraft; saved: boolean }
  | { type: 'details'; patch: DetailsPatch }
  | { type: 'addQuestion'; questionType: QuestionType; afterKey?: string; key: string }
  | { type: 'updateQuestion'; key: string; patch: QuestionPatch }
  | { type: 'changeType'; key: string; questionType: QuestionType }
  | { type: 'duplicateQuestion'; key: string; newKey: string }
  | { type: 'removeQuestion'; key: string }
  | { type: 'moveQuestion'; key: string; delta: -1 | 1 }
  | { type: 'updateOption'; questionKey: string; optionKey: string; patch: OptionPatch }
  | { type: 'setCorrect'; questionKey: string; optionKey: string }
  | { type: 'addOption'; questionKey: string }
  | { type: 'removeOption'; questionKey: string; optionKey: string }
  | { type: 'importQuestions'; questions: QuestionDraft[]; title?: string; description?: string }
  | { type: 'saved'; id: string; sent: QuizDraft }
  | { type: 'status'; status: QuizStatus };

export function initEditor(draft: QuizDraft, saved: boolean): EditorState {
  return { draft, savedFingerprint: saved ? draftFingerprint(draft) : '' };
}

/** The untouched starter question of a new quiz: replaced by an import instead of kept as a blank. */
export function isBlankQuestion(q: QuestionDraft): boolean {
  return !q.prompt.trim() && !q.imagePath && !q.explanation.trim() && !q.recovery && !q.code && q.options.every((o) => (q.type === 'true_false' || !o.label.trim()) && !o.imagePath && !o.isCorrect);
}

function mapQuestion(draft: QuizDraft, key: string, fn: (q: QuestionDraft) => QuestionDraft): QuizDraft {
  return { ...draft, questions: draft.questions.map((q) => (q.key === key ? fn(q) : q)) };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const { draft } = state;
  switch (action.type) {
    case 'load':
      return initEditor(action.draft, action.saved);

    case 'details':
      return { ...state, draft: { ...draft, ...action.patch } };

    case 'addQuestion': {
      if (draft.questions.length >= LIMITS.maxQuestions) return state;
      const question = { ...newQuestion(action.questionType), key: action.key };
      const index = action.afterKey ? draft.questions.findIndex((q) => q.key === action.afterKey) : -1;
      const questions = [...draft.questions];
      questions.splice(index >= 0 ? index + 1 : questions.length, 0, question);
      return { ...state, draft: { ...draft, questions } };
    }

    case 'updateQuestion':
      return { ...state, draft: mapQuestion(draft, action.key, (q) => ({ ...q, ...action.patch })) };

    case 'changeType':
      return { ...state, draft: mapQuestion(draft, action.key, (q) => changeQuestionType(q, action.questionType)) };

    case 'duplicateQuestion': {
      if (draft.questions.length >= LIMITS.maxQuestions) return state;
      const index = draft.questions.findIndex((q) => q.key === action.key);
      if (index < 0) return state;
      const source = draft.questions[index];
      const copy: QuestionDraft = {
        ...source,
        key: action.newKey,
        options: source.options.map((o) => ({ ...o, key: newKey() })),
        recovery: source.recovery && { ...source.recovery, options: source.recovery.options.map((o) => ({ ...o, key: newKey() })) },
      };
      const questions = [...draft.questions];
      questions.splice(index + 1, 0, copy);
      return { ...state, draft: { ...draft, questions } };
    }

    case 'importQuestions': {
      // Idempotent: questions whose keys are already in the quiz (a repeated click) are not added twice.
      const present = new Set(draft.questions.map((q) => q.key));
      const incoming = action.questions.filter((q) => !present.has(q.key));
      if (incoming.length === 0) return state;
      const kept = draft.questions.length === 1 && isBlankQuestion(draft.questions[0]) ? [] : draft.questions;
      if (kept.length + incoming.length > LIMITS.maxQuestions) return state;
      return {
        ...state,
        draft: {
          ...draft,
          // Fill the quiz details only where the teacher has not written their own.
          title: draft.title.trim() ? draft.title : (action.title?.trim().slice(0, LIMITS.titleMax) ?? draft.title),
          description: draft.description.trim() ? draft.description : (action.description?.trim().slice(0, LIMITS.descriptionMax) ?? draft.description),
          questions: [...kept, ...incoming],
        },
      };
    }

    case 'removeQuestion':
      return { ...state, draft: { ...draft, questions: draft.questions.filter((q) => q.key !== action.key) } };

    case 'moveQuestion': {
      const index = draft.questions.findIndex((q) => q.key === action.key);
      const target = index + action.delta;
      if (index < 0 || target < 0 || target >= draft.questions.length) return state;
      const questions = [...draft.questions];
      [questions[index], questions[target]] = [questions[target], questions[index]];
      return { ...state, draft: { ...draft, questions } };
    }

    case 'updateOption':
      return {
        ...state,
        draft: mapQuestion(draft, action.questionKey, (q) => ({
          ...q,
          options: q.options.map((o) => (o.key === action.optionKey ? { ...o, ...action.patch } : o)),
        })),
      };

    case 'setCorrect':
      return {
        ...state,
        draft: mapQuestion(draft, action.questionKey, (q) => ({
          ...q,
          options: q.options.map((o) => ({ ...o, isCorrect: o.key === action.optionKey })),
        })),
      };

    case 'addOption':
      return {
        ...state,
        draft: mapQuestion(draft, action.questionKey, (q) =>
          q.type === 'true_false' || q.options.length >= LIMITS.maxOptions ? q : { ...q, options: [...q.options, newOption()] },
        ),
      };

    case 'removeOption':
      return {
        ...state,
        draft: mapQuestion(draft, action.questionKey, (q) =>
          q.type === 'true_false' || q.options.length <= LIMITS.minOptions
            ? q
            : { ...q, options: q.options.filter((o) => o.key !== action.optionKey) },
        ),
      };

    case 'saved': {
      // Fingerprint the version that was actually sent, so edits made while the
      // request was in flight still count as unsaved.
      // The server bumps the revision by one on every update (a new quiz starts at 0).
      return {
        draft: { ...draft, id: action.id, revision: action.sent.id ? action.sent.revision + 1 : 0 },
        savedFingerprint: draftFingerprint({ ...action.sent, id: action.id }),
      };
    }

    case 'status':
      return { ...state, draft: { ...draft, status: action.status } };
  }
}
