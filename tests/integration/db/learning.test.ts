import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { as, createAuthUser, createTestDb, type Actor } from './harness';

/*
 * Learning progression: question metadata, misconception notes, recovery (parallel) questions,
 * the mastery gate, levels and the learning report.
 */

type Json = Record<string, unknown>;
type Q = {
  id: string;
  position: number;
  role: string;
  core_position: number;
  level: number | null;
  level_start: boolean;
  objective: string | null;
  kind: string | null;
  prompt: string;
  starts_at: string;
  options: { id: string; position: number; label: string }[];
  misconception: { label: string; count: number; answered: number; note: string | null } | null;
  mastery: { accuracy: number; passed: boolean; has_recovery: boolean; skipped: boolean } | null;
  review: { core_prompt: string; accuracy: number; misconception: { label: string; note: string | null }; explanation: string; correct_label: string } | null;
};
type State = {
  session: { phase: string; status: string; current_position: number; question_count: number; mastery_pct: number };
  question: Q | null;
  learning: { weak_objectives: string[]; report: { objective: string; questions: number; accuracy: number; recovery_accuracy: number | null }[] | null } | null;
  battle: { last: { unlocked: boolean; position: number } | null } | null;
};

const AVATAR = '000000000';
let db: PGlite;
let host: string;
const teacher = (id: string): Actor => ({ kind: 'user', id });

async function rpc<T = unknown>(actor: Actor, sql: string, params: unknown[] = []): Promise<T> {
  return as(db, actor, async (tx: Transaction) => {
    const { rows } = await tx.query<{ r: T }>(`select ${sql} as r`, params);
    return rows[0]?.r as T;
  });
}

async function errorMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return '';
  } catch (error) {
    return (error as Error).message;
  }
}

const recovery = (n: number) => ({
  prompt: `Parallel question ${n}`,
  explanation: `Parallel explanation ${n}`,
  time_limit_seconds: 15,
  options: [
    { label: 'Also right', is_correct: true },
    { label: 'Also wrong', is_correct: false, misconception: 'Same mix-up' },
  ],
});

/** Three questions: Q1 (level 1, with recovery), Q2 (level 1, no recovery), Q3 (final challenge, with recovery). */
const QUIZ: Json = {
  title: 'Fractions',
  speed_scoring: true,
  questions: [
    { level: 1, objective: 'Compare fractions', topic: 'Fractions', kind: 'concept', difficulty: 'easy', recovery: recovery(1) },
    { level: 1, objective: 'Add fractions', topic: 'Fractions', kind: 'application', difficulty: 'medium' },
    { level: 4, objective: 'Mixed problems', topic: 'Fractions', kind: 'multistep', difficulty: 'hard', recovery: recovery(3) },
  ].map((meta, i) => ({
    type: 'multiple_choice',
    prompt: `Question ${i + 1}`,
    points: 1000,
    time_limit_seconds: 20,
    explanation: `Because ${i + 1}`,
    options: [
      { label: 'Right', is_correct: true },
      { label: 'Wrong A', is_correct: false, misconception: 'Thinks bigger denominators mean bigger fractions' },
      { label: 'Wrong B', is_correct: false },
    ],
    ...meta,
  })),
};

async function quizId(quiz: Json = QUIZ): Promise<string> {
  const id = await rpc<string>(teacher(host), 'public.save_quiz($1::jsonb)', [JSON.stringify(quiz)]);
  await rpc(teacher(host), `public.set_quiz_status($1, 'published')`, [id]);
  return id;
}

async function start(players: number, quiz: Json = QUIZ) {
  const sessionId = await rpc<string>(teacher(host), `public.create_session($1, '{}'::jsonb)`, [await quizId(quiz)]);
  await db.query('update public.session_battles set enabled = false where session_id = $1', [sessionId]);
  const students: Actor[] = [];
  for (let i = 0; i < players; i++) {
    const s: Actor = { kind: 'user', id: await createAuthUser(db, { anonymous: true }), anonymous: true };
    await rpc(s, 'public.join_session($1, $2, $3)', [sessionId, `Player ${i + 1}`, AVATAR]);
    students.push(s);
  }
  await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
  return { sessionId, students };
}

const state = (actor: Actor, sessionId: string) => rpc<State>(actor, 'public.get_game_state($1)', [sessionId]);
const next = (sessionId: string) => rpc(teacher(host), 'public.next_question($1, null)', [sessionId]);

async function openNow(sessionId: string) {
  await db.query(
    `update public.session_questions set starts_at = clock_timestamp(), opened_at = clock_timestamp(),
            deadline_at = clock_timestamp() + make_interval(secs => time_limit_seconds)
      where session_id = $1 and status = 'open'`,
    [sessionId],
  );
}

/** answers: 'r' right, 'a' / 'b' wrong options, '-' silent. */
async function play(sessionId: string, students: Actor[], answers: string) {
  await openNow(sessionId);
  const q = (await state(students[0], sessionId)).question!;
  for (let i = 0; i < students.length; i++) {
    const c = answers[i];
    if (!c || c === '-') continue;
    const position = c === 'r' ? 0 : c === 'a' ? 1 : 2;
    const option = q.options.find((o) => o.position === position) ?? q.options[1];
    await rpc(students[i], 'public.submit_answer($1, $2)', [q.id, option.id]);
  }
  await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);
}

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(async () => {
  host = await createAuthUser(db, { meta: { display_name: 'Ms Host' } });
});

describe('authoring', () => {
  it('saves levels, objectives, kinds, misconception notes and recovery questions; duplicates keep them', async () => {
    const id = await quizId();
    const { rows } = await db.query<Json>(
      `select level, objective, topic, kind, difficulty, recovery from public.quiz_questions where quiz_id = $1 order by position`,
      [id],
    );
    expect(rows[0]).toMatchObject({ level: 1, objective: 'Compare fractions', topic: 'Fractions', kind: 'concept', difficulty: 'easy' });
    expect(rows[0].recovery).toMatchObject({ prompt: 'Parallel question 1', time_limit_seconds: 15, options: [{ label: 'Also right', is_correct: true, misconception: '' }, { misconception: 'Same mix-up' }] });
    expect(rows[1].recovery).toBeNull();
    const notes = await db.query<{ misconception: string }>(
      `select o.misconception from public.question_options o join public.quiz_questions q on q.id = o.question_id
        where q.quiz_id = $1 and q.position = 0 order by o.position`,
      [id],
    );
    expect(notes.rows.map((r) => r.misconception)).toEqual(['', 'Thinks bigger denominators mean bigger fractions', '']);

    const copy = await rpc<string>(teacher(host), 'public.duplicate_quiz($1)', [id]);
    const copied = await db.query<Json>(`select level, objective, recovery from public.quiz_questions where quiz_id = $1 and position = 0`, [copy]);
    expect(copied.rows[0]).toMatchObject({ level: 1, objective: 'Compare fractions', recovery: { prompt: 'Parallel question 1' } });
  });

  it('refuses bad metadata, and a published quiz needs complete recovery questions', async () => {
    const bad = (patch: Json) => ({ ...QUIZ, questions: [{ ...(QUIZ.questions as Json[])[0], ...patch }] });
    const save = (quiz: Json) => rpc(teacher(host), 'public.save_quiz($1::jsonb)', [JSON.stringify(quiz)]);
    expect(await errorMessage(save(bad({ level: 5 })))).toMatch(/level 1, 2, 3 or the final/);
    expect(await errorMessage(save(bad({ kind: 'riddle' })))).toMatch(/unknown question kind/);
    expect(await errorMessage(save(bad({ objective: 'x'.repeat(121) })))).toMatch(/objective can be at most 120/);
    expect(await errorMessage(save(bad({ recovery: { ...recovery(1), options: [1, 2, 3, 4, 5].map((n) => ({ label: `${n}` })) } })))).toMatch(/at most 4 answers/);

    // A draft may hold an unfinished recovery question; publishing it is blocked.
    const draft = await rpc<string>(teacher(host), 'public.save_quiz($1::jsonb)', [JSON.stringify(bad({ recovery: { prompt: '', options: [{ label: 'Only one', is_correct: true }] } }))]);
    expect(await errorMessage(rpc(teacher(host), `public.set_quiz_status($1, 'published')`, [draft]))).toMatch(/recovery/);
  });
});

describe('the game', () => {
  it('recovery questions are held back; levels start where they change', async () => {
    const { sessionId, students } = await start(2);
    const s = await state(students[0], sessionId);
    expect(s.session.question_count).toBe(3);
    expect(s.question).toMatchObject({ position: 0, role: 'core', level: 1, level_start: true, objective: 'Compare fractions', kind: 'concept' });
    const { rows } = await db.query<{ position: number; role: string; level_start: boolean; core_position: number }>(
      'select position, role, level_start, core_position from public.session_questions where session_id = $1 order by position',
      [sessionId],
    );
    expect(rows).toEqual([
      { position: 0, role: 'core', level_start: true, core_position: 0 },
      { position: 1, role: 'core', level_start: false, core_position: 1 },
      { position: 2, role: 'core', level_start: true, core_position: 2 },
      { position: 1000, role: 'recovery', level_start: false, core_position: 0 },
      { position: 1002, role: 'recovery', level_start: false, core_position: 2 },
    ]);
  });

  it('the reveal names the most common mix-up (counts only, no names) and the mastery result', async () => {
    const { sessionId, students } = await start(4);
    await play(sessionId, students, 'raab');
    const q = (await state(students[0], sessionId)).question!;
    expect(q.misconception).toMatchObject({ label: 'Wrong A', count: 2, answered: 4, note: 'Thinks bigger denominators mean bigger fractions' });
    expect(q.mastery).toMatchObject({ accuracy: 25, passed: false, has_recovery: true, skipped: false });
    expect(JSON.stringify(q.misconception)).not.toMatch(/Player/);
  });

  it('below 75 %: "next" plays the recovery question after a review; then the quiz carries on', async () => {
    const { sessionId, students } = await start(4);
    await play(sessionId, students, 'rraa'); // 50 %
    await next(sessionId);
    const s = await state(students[0], sessionId);
    expect(s.session.current_position).toBe(1000);
    expect(s.question).toMatchObject({ role: 'recovery', core_position: 0, prompt: 'Parallel question 1' });
    expect(s.question!.review).toMatchObject({
      core_prompt: 'Question 1', accuracy: 50, correct_label: 'Right', explanation: 'Because 1',
      misconception: { label: 'Wrong A', note: 'Thinks bigger denominators mean bigger fractions' },
    });
    // The review time (8 s) comes before the question.
    const lead = (new Date(s.question!.starts_at).getTime() - Date.now()) / 1000;
    expect(lead).toBeGreaterThan(9);
    expect(lead).toBeLessThan(10.5);

    await play(sessionId, students, 'rrrr');
    await next(sessionId);
    expect((await state(students[0], sessionId)).question).toMatchObject({ position: 1, role: 'core' });
  });

  it('75 % or more moves straight on; no recovery written moves on; the teacher can skip one', async () => {
    const { sessionId, students } = await start(4);
    await play(sessionId, students, 'rrra'); // 75 %: passes
    await next(sessionId);
    expect((await state(students[0], sessionId)).question!.position).toBe(1);

    await play(sessionId, students, 'aaaa'); // Q2 failed, but it has no recovery question
    expect((await state(students[0], sessionId)).question!.mastery).toMatchObject({ passed: false, has_recovery: false });
    await next(sessionId);
    expect((await state(students[0], sessionId)).question).toMatchObject({ position: 2, level: 4, level_start: true });

    await play(sessionId, students, 'aaaa'); // Q3 failed, has recovery: the teacher skips it
    expect(await errorMessage(rpc(students[0], 'public.set_recovery_skipped($1, true)', [sessionId]))).not.toBe('');
    await rpc(teacher(host), 'public.set_recovery_skipped($1, true)', [sessionId]);
    expect((await state(students[0], sessionId)).question!.mastery).toMatchObject({ skipped: true });
    await next(sessionId);
    expect((await state(students[0], sessionId)).session).toMatchObject({ phase: 'podium', status: 'ended' });
  });

  it('the final challenge knows the weak objectives; the podium has a learning report', async () => {
    const { sessionId, students } = await start(4);
    await play(sessionId, students, 'raaa'); // Compare fractions: 25 %
    await next(sessionId); // recovery
    await play(sessionId, students, 'rrrb'); // recovery: 75 %
    await next(sessionId);
    await play(sessionId, students, 'rrrr'); // Add fractions: 100 %
    await next(sessionId);
    const finale = await state(students[0], sessionId);
    expect(finale.question).toMatchObject({ level: 4, level_start: true });
    expect(finale.learning!.weak_objectives).toEqual(['Compare fractions']);

    await play(sessionId, students, 'rrr-'); // Mixed: 75 %
    await next(sessionId);
    const end = await state(students[0], sessionId);
    expect(end.session.phase).toBe('podium');
    expect(end.learning!.report).toEqual([
      { objective: 'Compare fractions', topic: 'Fractions', questions: 1, accuracy: 25, recovery_accuracy: 75 },
      { objective: 'Mixed problems', topic: 'Fractions', questions: 1, accuracy: 75, recovery_accuracy: null },
      { objective: 'Add fractions', topic: 'Fractions', questions: 1, accuracy: 100, recovery_accuracy: null },
    ]);
  });

  it('a recovery question is played once; mastery off means no recovery questions', async () => {
    const quizSessions = await start(2);
    await play(quizSessions.sessionId, quizSessions.students, 'aa');
    await next(quizSessions.sessionId);
    await play(quizSessions.sessionId, quizSessions.students, 'aa'); // the recovery fails too
    await next(quizSessions.sessionId);
    expect((await state(quizSessions.students[0], quizSessions.sessionId)).question!.position).toBe(1);

    const sessionId = await rpc<string>(teacher(host), `public.create_session($1, '{}'::jsonb)`, [await quizId()]);
    const s: Actor = { kind: 'user', id: await createAuthUser(db, { anonymous: true }), anonymous: true };
    await rpc(s, 'public.join_session($1, $2, $3)', [sessionId, 'Solo', AVATAR]);
    const set = (v: Json) => rpc<number>(teacher(host), 'public.set_learning_settings($1, $2::jsonb)', [sessionId, JSON.stringify(v)]);
    expect(await errorMessage(set({ mastery_pct: 40 }))).toMatch(/50% to 100%/);
    expect(await errorMessage(set({ review_seconds: 60 }))).toMatch(/3 to 20/);
    expect(await errorMessage(rpc(s, 'public.set_learning_settings($1, $2::jsonb)', [sessionId, '{"mastery_enabled": false}']))).not.toBe('');
    await set({ mastery_enabled: false, mastery_pct: 80, review_seconds: 5 });
    await db.query('update public.session_battles set enabled = false where session_id = $1', [sessionId]);
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    expect(await errorMessage(set({ mastery_pct: 90 }))).toMatch(/before the game starts/);
    await play(sessionId, [s], 'a');
    await next(sessionId);
    expect((await state(s, sessionId)).question!.position).toBe(1);
  });

  it('in a boss battle a recovery question attacks too, but never unlocks a weapon', async () => {
    const sessionId = await rpc<string>(teacher(host), `public.create_session($1, '{}'::jsonb)`, [await quizId()]);
    const students: Actor[] = [];
    for (let i = 0; i < 4; i++) {
      const s: Actor = { kind: 'user', id: await createAuthUser(db, { anonymous: true }), anonymous: true };
      await rpc(s, 'public.join_session($1, $2, $3)', [sessionId, `P${i}`, AVATAR]);
      students.push(s);
    }
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    await play(sessionId, students, 'raaa');
    await next(sessionId);
    await play(sessionId, students, 'rrrr'); // 100 % on the recovery question
    expect((await state(students[0], sessionId)).battle!.last).toMatchObject({ position: 1000, unlocked: false });
  });
});
