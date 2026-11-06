import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { as, createAuthUser, createTestDb, errorCode } from './harness';

let db: PGlite;
let teacher: string;
let otherTeacher: string;
let student: string;

const T = () => ({ kind: 'user' as const, id: teacher });
const OTHER = () => ({ kind: 'user' as const, id: otherTeacher });
const STUDENT = () => ({ kind: 'user' as const, id: student, anonymous: true });

type Json = Record<string, unknown>;

const mcQuestion = (overrides: Json = {}): Json => ({
  type: 'multiple_choice',
  prompt: 'What is 2 + 2?',
  time_limit_seconds: 20,
  points: 1000,
  explanation: 'Basic arithmetic.',
  options: [
    { label: '3', is_correct: false },
    { label: '4', is_correct: true },
    { label: '5', is_correct: false },
  ],
  ...overrides,
});

const completeQuiz = (overrides: Json = {}): Json => ({
  title: 'Arithmetic',
  description: 'Warm-up',
  subject: 'Maths',
  speed_scoring: true,
  questions: [
    mcQuestion(),
    {
      type: 'true_false',
      prompt: 'The sky is green.',
      options: [
        { label: 'True', is_correct: false },
        { label: 'False', is_correct: true },
      ],
    },
  ],
  ...overrides,
});

async function saveQuiz(tx: Transaction, quiz: Json): Promise<string> {
  const { rows } = await tx.query<{ id: string }>('select public.save_quiz($1::jsonb) as id', [JSON.stringify(quiz)]);
  return rows[0].id;
}

async function save(actor: ReturnType<typeof T>, quiz: Json) {
  return as(db, actor, (tx) => saveQuiz(tx, quiz));
}

async function setStatus(actor: ReturnType<typeof T>, id: string, status: string) {
  return as(db, actor, (tx) => tx.query('select public.set_quiz_status($1, $2::public.quiz_status)', [id, status]));
}

async function errorMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return '';
  } catch (error) {
    return (error as Error).message;
  }
}

beforeAll(async () => {
  db = await createTestDb();
  teacher = await createAuthUser(db, { meta: { display_name: 'Teacher One' } });
  otherTeacher = await createAuthUser(db, { meta: { display_name: 'Teacher Two' } });
  student = await createAuthUser(db, { anonymous: true });
});

describe('save_quiz', () => {
  it('creates a quiz with ordered questions and options', async () => {
    const id = await save(T(), completeQuiz({ title: '  Arithmetic  ' }));
    const quiz = (await db.query<Json>('select * from public.quizzes where id = $1', [id])).rows[0];
    expect(quiz).toMatchObject({ owner_id: teacher, title: 'Arithmetic', status: 'draft', question_count: 2 });

    const questions = (
      await db.query<Json>('select position, type, prompt from public.quiz_questions where quiz_id = $1 order by position', [id])
    ).rows;
    expect(questions).toEqual([
      { position: 0, type: 'multiple_choice', prompt: 'What is 2 + 2?' },
      { position: 1, type: 'true_false', prompt: 'The sky is green.' },
    ]);
    const options = (
      await db.query<Json>(
        `select o.position, o.label, o.is_correct from public.question_options o
           join public.quiz_questions q on q.id = o.question_id
          where q.quiz_id = $1 and q.position = 0 order by o.position`,
        [id],
      )
    ).rows;
    expect(options).toEqual([
      { position: 0, label: '3', is_correct: false },
      { position: 1, label: '4', is_correct: true },
      { position: 2, label: '5', is_correct: false },
    ]);
  });

  it('replaces questions on update and re-indexes positions', async () => {
    const id = await save(T(), completeQuiz());
    await save(T(), { id, title: 'Renamed', questions: [mcQuestion({ prompt: 'Only question' })] });
    const quiz = (await db.query<Json>('select title, question_count from public.quizzes where id = $1', [id])).rows[0];
    expect(quiz).toEqual({ title: 'Renamed', question_count: 1 });
    const questions = (await db.query<Json>('select position, prompt from public.quiz_questions where quiz_id = $1', [id])).rows;
    expect(questions).toEqual([{ position: 0, prompt: 'Only question' }]);
  });

  it('allows incomplete drafts', async () => {
    const id = await save(T(), {
      title: 'Work in progress',
      questions: [{ type: 'multiple_choice', prompt: '', options: [{ label: '' }, { label: '' }] }],
    });
    expect(id).toBeTruthy();
  });

  it.each([
    [{ title: '   ' }, /title/],
    [{ questions: [mcQuestion({ type: 'essay' })] }, /unknown question type/],
    [{ questions: [mcQuestion({ time_limit_seconds: 4 })] }, /between 5 and 120/],
    [{ questions: [mcQuestion({ time_limit_seconds: 121 })] }, /between 5 and 120/],
    [{ questions: [mcQuestion({ points: 5000 })] }, /points/],
    [{ questions: [mcQuestion({ prompt: 'x'.repeat(301) })] }, /300 characters/],
    [{ questions: [mcQuestion({ options: Array.from({ length: 5 }, () => ({ label: 'a' })) })] }, /at most 4 answers/],
    [
      { questions: [mcQuestion({ options: [{ label: 'a', is_correct: true }, { label: 'b', is_correct: true }] })] },
      /only one correct/,
    ],
    [{ questions: [mcQuestion({ image_path: '../../etc/passwd' })] }, /Invalid image reference/],
    [{ cover_image_path: 'https://evil.example/x.png' }, /Invalid image reference/],
  ])('rejects invalid input %#', async (override, pattern) => {
    const message = await errorMessage(save(T(), completeQuiz(override)));
    expect(message).toMatch(pattern);
  });

  it('accepts image paths inside the media bucket naming scheme', async () => {
    const path = `${teacher}/2b1f0c3e-1111-4a6b-9c1d-123456789abc.webp`;
    const id = await save(T(), completeQuiz({ cover_image_path: path, questions: [mcQuestion({ image_path: path })] }));
    const row = (await db.query<Json>('select cover_image_path from public.quizzes where id = $1', [id])).rows[0];
    expect(row.cover_image_path).toBe(path);
  });

  it('is atomic: a failing question leaves the previous version untouched', async () => {
    const id = await save(T(), completeQuiz());
    await errorMessage(save(T(), { id, title: 'Broken', questions: [mcQuestion(), mcQuestion({ points: -1 })] }));
    const quiz = (await db.query<Json>('select title, question_count from public.quizzes where id = $1', [id])).rows[0];
    expect(quiz).toEqual({ title: 'Arithmetic', question_count: 2 });
  });
});

describe('publishing', () => {
  it('refuses to publish an incomplete quiz with a helpful message', async () => {
    const id = await save(T(), { title: 'Draft', questions: [mcQuestion({ options: [{ label: 'a' }, { label: 'b' }] })] });
    const message = await errorMessage(setStatus(T(), id, 'published'));
    expect(message).toMatch(/Question 1: mark the correct answer/);
  });

  it('refuses to publish an empty quiz', async () => {
    const id = await save(T(), { title: 'Empty', questions: [] });
    expect(await errorMessage(setStatus(T(), id, 'published'))).toMatch(/at least one question/);
  });

  it('checks type-specific rules', async () => {
    const tf = await save(T(), {
      title: 'TF',
      questions: [{ type: 'true_false', prompt: 'Q', options: [{ label: 'True', is_correct: true }] }],
    });
    expect(await errorMessage(setStatus(T(), tf, 'published'))).toMatch(/exactly 2 answers/);

    const img = await save(T(), {
      title: 'Images',
      questions: [{ type: 'image_choice', prompt: 'Pick the cat', options: [{ label: 'Cat', is_correct: true }, { label: 'Dog' }] }],
    });
    expect(await errorMessage(setStatus(T(), img, 'published'))).toMatch(/image to every answer/);
  });

  it('publishes a complete quiz and stamps published_at', async () => {
    const id = await save(T(), completeQuiz());
    await setStatus(T(), id, 'published');
    const row = (await db.query<Json>('select status, published_at from public.quizzes where id = $1', [id])).rows[0];
    expect(row.status).toBe('published');
    expect(row.published_at).not.toBeNull();
  });

  it('keeps published quizzes complete when they are edited', async () => {
    const id = await save(T(), completeQuiz());
    await setStatus(T(), id, 'published');
    const message = await errorMessage(save(T(), { id, title: 'Arithmetic', questions: [mcQuestion({ prompt: '' })] }));
    expect(message).toMatch(/published, so every question must be complete/);
    const count = (await db.query<Json>('select question_count from public.quizzes where id = $1', [id])).rows[0];
    expect(count.question_count).toBe(2);
  });

  it('archives and restores quizzes', async () => {
    const id = await save(T(), completeQuiz());
    await setStatus(T(), id, 'archived');
    await setStatus(T(), id, 'draft');
    const row = (await db.query<Json>('select status, published_at from public.quizzes where id = $1', [id])).rows[0];
    expect(row).toEqual({ status: 'draft', published_at: null });
  });
});

describe('duplicate_quiz', () => {
  it('creates an independent draft copy with all questions and options', async () => {
    const original = await save(T(), completeQuiz());
    await setStatus(T(), original, 'published');
    const copy = await as(db, T(), async (tx) => {
      return (await tx.query<{ id: string }>('select public.duplicate_quiz($1) as id', [original])).rows[0].id;
    });

    const row = (await db.query<Json>('select title, status, source_quiz_id, question_count, owner_id from public.quizzes where id = $1', [copy])).rows[0];
    expect(row).toEqual({ title: 'Copy of Arithmetic', status: 'draft', source_quiz_id: original, question_count: 2, owner_id: teacher });

    const count = async (quizId: string) =>
      (
        await db.query<{ n: number }>(
          `select count(*)::int as n from public.question_options o join public.quiz_questions q on q.id = o.question_id where q.quiz_id = $1`,
          [quizId],
        )
      ).rows[0].n;
    expect(await count(copy)).toBe(await count(original));

    // Editing the copy must not change the original.
    await save(T(), { id: copy, title: 'Edited copy', questions: [] });
    expect(await count(original)).toBe(5);
  });
});

describe('ownership and access control', () => {
  let quizId: string;

  beforeAll(async () => {
    quizId = await save(T(), completeQuiz({ title: 'Private quiz' }));
  });

  it("hides a teacher's quizzes, questions and answer keys from other teachers", async () => {
    const counts = await as(db, OTHER(), async (tx) => {
      const q = await tx.query('select 1 from public.quizzes where id = $1', [quizId]);
      const qq = await tx.query('select 1 from public.quiz_questions where quiz_id = $1', [quizId]);
      const o = await tx.query('select 1 from public.question_options');
      return [q.rows.length, qq.rows.length, o.rows.length];
    });
    expect(counts).toEqual([0, 0, 0]);
  });

  it("refuses to save, publish, duplicate or delete another teacher's quiz", async () => {
    expect(await errorMessage(save(OTHER(), completeQuiz({ id: quizId, title: 'Hijacked' })))).toMatch(/not found/);
    expect(await errorMessage(setStatus(OTHER(), quizId, 'archived'))).toMatch(/not found/);
    expect(
      await errorMessage(as(db, OTHER(), (tx) => tx.query('select public.duplicate_quiz($1)', [quizId]))),
    ).toMatch(/not found/);
    const deleted = await as(db, OTHER(), async (tx) => (await tx.query('delete from public.quizzes where id = $1', [quizId])).affectedRows);
    expect(deleted).toBe(0);
    const title = (await db.query<Json>('select title from public.quizzes where id = $1', [quizId])).rows[0].title;
    expect(title).toBe('Private quiz');
  });

  it('blocks direct table writes even by the owner (RPCs only)', async () => {
    const insert = await errorCode(
      as(db, T(), (tx) => tx.query(`insert into public.quizzes (owner_id, title) values ($1, 'Direct')`, [teacher])),
    );
    const update = await errorCode(as(db, T(), (tx) => tx.query(`update public.quizzes set question_count = 99 where id = $1`, [quizId])));
    const optionUpdate = await errorCode(as(db, T(), (tx) => tx.query(`update public.question_options set is_correct = true`)));
    expect([insert, update, optionUpdate]).toEqual(['42501', '42501', '42501']);
  });

  it('gives anonymous students no access at all', async () => {
    const visible = await as(db, STUDENT(), async (tx) => {
      const quizzes = await tx.query('select 1 from public.quizzes');
      const options = await tx.query('select 1 from public.question_options');
      return quizzes.rows.length + options.rows.length;
    });
    expect(visible).toBe(0);
    expect(await errorCode(as(db, STUDENT(), (tx) => saveQuiz(tx, completeQuiz())))).toBe('42501');
  });

  it('denies the anon role entirely', async () => {
    expect(await errorCode(as(db, { kind: 'anon' }, (tx) => tx.query('select * from public.quizzes')))).toBe('42501');
    expect(await errorCode(as(db, { kind: 'anon' }, (tx) => saveQuiz(tx, completeQuiz())))).toBe('42501');
  });

  it('lets the owner delete a quiz and cascades to questions and options', async () => {
    const id = await save(T(), completeQuiz());
    const deleted = await as(db, T(), async (tx) => (await tx.query('delete from public.quizzes where id = $1', [id])).affectedRows);
    expect(deleted).toBe(1);
    const left = (await db.query<{ n: number }>('select count(*)::int as n from public.quiz_questions where quiz_id = $1', [id])).rows[0].n;
    expect(left).toBe(0);
  });
});

describe('quiz-media storage policies', () => {
  const insertObject = (actor: Parameters<typeof as>[1], name: string) =>
    as(db, actor, (tx) => tx.query(`insert into storage.objects (bucket_id, name) values ('quiz-media', $1)`, [name]));

  it('creates a public bucket limited to small images', async () => {
    const bucket = (await db.query<Json>(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'quiz-media'`)).rows[0];
    expect(bucket.public).toBe(true);
    expect(Number(bucket.file_size_limit)).toBe(2 * 1024 * 1024);
    expect(bucket.allowed_mime_types).toContain('image/webp');
  });

  it('lets teachers upload only into their own folder', async () => {
    await insertObject(T(), `${teacher}/own.webp`);
    expect(await errorCode(insertObject(T(), `${otherTeacher}/not-mine.webp`))).toBe('42501');
    expect(await errorCode(insertObject(T(), `loose-file.webp`))).toBe('42501');
  });

  it('does not let students upload', async () => {
    expect(await errorCode(insertObject(STUDENT(), `${student}/x.webp`))).toBe('42501');
  });

  it("does not let a teacher delete another teacher's media", async () => {
    await insertObject(OTHER(), `${otherTeacher}/theirs.webp`);
    const deleted = await as(db, T(), async (tx) => (await tx.query(`delete from storage.objects where name = $1`, [`${otherTeacher}/theirs.webp`])).affectedRows);
    expect(deleted).toBe(0);
  });
});
