import { getTeacherClient } from '@/lib/supabase';
import { newKey, toSavePayload } from '@/lib/quiz-rules';
import type { QuestionOptionRow, QuizQuestionRow, QuizRow } from '@/types/database';
import type { QuizDraft, QuizStatus, QuizSummary } from '@/types/quiz';

const SUMMARY_COLUMNS =
  'id, title, description, subject, cover_image_path, status, question_count, source_quiz_id, created_at, updated_at';

type SummaryRow = Pick<
  QuizRow,
  | 'id'
  | 'title'
  | 'description'
  | 'subject'
  | 'cover_image_path'
  | 'status'
  | 'question_count'
  | 'source_quiz_id'
  | 'created_at'
  | 'updated_at'
>;

function toSummary(row: SummaryRow): QuizSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    subject: row.subject,
    coverImagePath: row.cover_image_path,
    status: row.status,
    questionCount: row.question_count,
    sourceQuizId: row.source_quiz_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** All quizzes owned by the signed-in teacher (RLS restricts to own rows). */
export async function listMyQuizzes(): Promise<QuizSummary[]> {
  const { data, error } = await getTeacherClient()
    .from('quizzes')
    .select(SUMMARY_COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map(toSummary);
}

type QuestionWithOptions = QuizQuestionRow & { question_options: QuestionOptionRow[] };
type QuizWithQuestions = QuizRow & { quiz_questions: QuestionWithOptions[] };

export class QuizNotFoundError extends Error {
  constructor() {
    super('Quiz not found');
    this.name = 'QuizNotFoundError';
  }
}

/** Loads a full quiz (including answer keys — teacher only) as an editable draft. */
export async function getQuizDraft(id: string): Promise<QuizDraft> {
  const { data, error } = await getTeacherClient()
    .from('quizzes')
    .select('*, quiz_questions(*, question_options(*))')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new QuizNotFoundError();
  const quiz = data as unknown as QuizWithQuestions;

  const questions = [...quiz.quiz_questions].sort((a, b) => a.position - b.position);
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    subject: quiz.subject,
    coverImagePath: quiz.cover_image_path,
    speedScoring: quiz.speed_scoring,
    status: quiz.status,
    questions: questions.map((q) => ({
      key: newKey(),
      type: q.type,
      prompt: q.prompt,
      imagePath: q.image_path,
      timeLimitSeconds: q.time_limit_seconds,
      points: q.points,
      explanation: q.explanation,
      options: [...q.question_options]
        .sort((a, b) => a.position - b.position)
        .map((o) => ({ key: newKey(), label: o.label, imagePath: o.image_path, isCorrect: o.is_correct })),
    })),
  };
}

/** Creates or fully replaces a quiz in one server transaction. Returns its id. */
export async function saveQuiz(draft: QuizDraft): Promise<string> {
  const { data, error } = await getTeacherClient().rpc('save_quiz', { p_quiz: toSavePayload(draft) });
  if (error) throw error;
  return data;
}

export async function setQuizStatus(id: string, status: QuizStatus): Promise<QuizStatus> {
  const { data, error } = await getTeacherClient().rpc('set_quiz_status', { p_quiz_id: id, p_status: status });
  if (error) throw error;
  return data;
}

export async function duplicateQuiz(id: string): Promise<string> {
  const { data, error } = await getTeacherClient().rpc('duplicate_quiz', { p_quiz_id: id });
  if (error) throw error;
  return data;
}

export async function deleteQuiz(id: string): Promise<void> {
  const { error, count } = await getTeacherClient().from('quizzes').delete({ count: 'exact' }).eq('id', id);
  if (error) throw error;
  if (count === 0) throw new QuizNotFoundError();
}
