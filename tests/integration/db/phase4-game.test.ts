import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { as, broadcasts, createAuthUser, createTestDb, errorCode, type Actor } from './harness';

type Json = Record<string, unknown>;
type Option = { id: string; position: number; label: string };
type Question = {
  id: string;
  position: number;
  status: string;
  deadline_at: string;
  answer_count: number;
  options: Option[];
  correct_option_id: string | null;
  explanation: string | null;
  distribution: Record<string, number> | null;
};
type Entry = {
  participant_id: string;
  nickname: string;
  score: number;
  rank: number;
  previous_rank: number | null;
  last_points: number;
  last_correct: boolean | null;
  streak: number;
  correct_count: number;
};
type GameState = {
  role: string;
  session: { status: string; phase: string; state_version: number; current_position: number | null; question_count: number };
  question: Question | null;
  me: { participant_id: string; answer_option_id: string | null; last_correct: boolean | null; last_points: number | null; score: number; rank: number | null; previous_rank: number | null; streak: number } | null;
  leaderboard: Entry[];
  ranked_count: number;
  leaderboard_version: number | null;
};

const AVATAR = '000000000';
let db: PGlite;
let host: string;
let otherTeacher: string;

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

/** Three questions; the correct answer is always the first option (A). */
const QUIZ: Json = {
  title: 'Planets',
  speed_scoring: true,
  questions: [0, 1, 2].map((i) => ({
    type: 'multiple_choice',
    prompt: `Question ${i + 1}`,
    points: 1000,
    time_limit_seconds: 20,
    explanation: i === 0 ? 'Jupiter is the largest.' : '',
    options: [
      { label: 'Right', is_correct: true },
      { label: 'Wrong', is_correct: false },
    ],
  })),
};

async function newStudent(): Promise<Actor> {
  return { kind: 'user', id: await createAuthUser(db, { anonymous: true }), anonymous: true };
}

async function setup(players: number, quiz: Json = QUIZ) {
  const quizId = await rpc<string>(teacher(host), 'public.save_quiz($1::jsonb)', [JSON.stringify(quiz)]);
  await rpc(teacher(host), `public.set_quiz_status($1, 'published')`, [quizId]);
  const sessionId = await rpc<string>(teacher(host), `public.create_session($1, '{}'::jsonb)`, [quizId]);
  const students: Actor[] = [];
  for (let i = 0; i < players; i++) {
    const s = await newStudent();
    await rpc(s, 'public.join_session($1, $2, $3)', [sessionId, `Player ${i + 1}`, AVATAR]);
    students.push(s);
  }
  return { quizId, sessionId, students };
}

const state = (actor: Actor, sessionId: string) => rpc<GameState>(actor, 'public.get_game_state($1)', [sessionId]);
const start = (sessionId: string, version: number | null = null) =>
  rpc<number>(teacher(host), 'public.start_game($1, $2)', [sessionId, version]);
const submit = (actor: Actor, questionId: string, optionId: string) =>
  rpc<{ status: string }>(actor, 'public.submit_answer($1, $2)', [questionId, optionId]);
const closeQ = (sessionId: string, version: number | null = null) =>
  rpc<number>(teacher(host), 'public.close_question($1, $2)', [sessionId, version]);
const next = (sessionId: string, version: number | null = null) =>
  rpc<number>(teacher(host), 'public.next_question($1, $2)', [sessionId, version]);

/** Moves the open question's clock so that `secondsLeft` remain (simulates time passing). */
async function setSecondsLeft(questionId: string, secondsLeft: number) {
  await db.query(
    `update public.session_questions
        set opened_at = clock_timestamp() - make_interval(secs => time_limit_seconds - $2),
            deadline_at = clock_timestamp() + make_interval(secs => $2)
      where id = $1`,
    [questionId, secondsLeft],
  );
}

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(async () => {
  host = await createAuthUser(db, { meta: { display_name: 'Ms Host' } });
  otherTeacher = await createAuthUser(db);
});

describe('start_game', () => {
  it('snapshots the quiz and opens question 1', async () => {
    const { sessionId, quizId, students } = await setup(2);
    await start(sessionId);
    const s = await state(students[0], sessionId);
    expect(s.session).toMatchObject({ status: 'in_progress', phase: 'question', current_position: 0, question_count: 3 });
    expect(s.question?.options.map((o) => o.label)).toEqual(['Right', 'Wrong']);
    expect(s.question?.status).toBe('open');

    // Editing the quiz mid-game changes nothing in the session.
    await rpc(teacher(host), `public.set_quiz_status($1, 'draft')`, [quizId]);
    const after = await state(students[0], sessionId);
    expect(after.question?.options.map((o) => o.label)).toEqual(['Right', 'Wrong']);
  });

  it('needs a player, only the host may start, and a stale version is a no-op', async () => {
    const empty = await setup(0);
    expect(await errorMessage(start(empty.sessionId))).toMatch(/at least one player/);

    const { sessionId, students } = await setup(1);
    expect(await errorMessage(rpc(teacher(otherTeacher), 'public.start_game($1, null)', [sessionId]))).toBe('Session not found.');
    expect(await errorMessage(rpc(students[0], 'public.start_game($1, null)', [sessionId]))).toBe('Session not found.');

    const v = await start(sessionId);
    expect(await start(sessionId, v - 5)).toBe(v); // stale: nothing happens
    expect(await start(sessionId, v)).toBe(v); // already started: nothing happens
  });
});

describe('answers and secrecy', () => {
  it('never reveals correctness while the question is open', async () => {
    const { sessionId, students } = await setup(1);
    await start(sessionId);
    const s = await state(students[0], sessionId);
    const q = s.question!;
    expect(q.correct_option_id).toBeNull();
    expect(q.distribution).toBeNull();
    expect(q.explanation).toBeNull();

    expect(await submit(students[0], q.id, q.options[0].id)).toEqual({ status: 'accepted' });
    const after = await state(students[0], sessionId);
    expect(after.me).toMatchObject({ answer_option_id: q.options[0].id, last_correct: null, last_points: null });
    expect(JSON.stringify(after)).not.toContain('is_correct');
  });

  it('students cannot read game tables directly', async () => {
    const { sessionId, students } = await setup(1);
    await start(sessionId);
    for (const table of ['session_answer_keys', 'answers', 'participant_scores', 'session_questions', 'session_question_options']) {
      expect(await errorCode(as(db, students[0], (tx) => tx.query(`select * from public.${table}`)))).toBe('42501');
      expect(await errorCode(as(db, teacher(host), (tx) => tx.query(`select * from public.${table}`)))).toBe('42501');
    }
  });

  it('accepts one answer per player; duplicate, late and closed are reported', async () => {
    const { sessionId, students } = await setup(2);
    await start(sessionId);
    const q = (await state(students[0], sessionId)).question!;

    expect((await submit(students[0], q.id, q.options[1].id)).status).toBe('accepted');
    expect((await submit(students[0], q.id, q.options[0].id)).status).toBe('duplicate');

    await db.query(`update public.session_questions set deadline_at = clock_timestamp() - interval '1 second' where id = $1`, [q.id]);
    expect((await submit(students[1], q.id, q.options[0].id)).status).toBe('late');

    await closeQ(sessionId);
    expect((await submit(students[1], q.id, q.options[0].id)).status).toBe('closed');
  });

  it('rejects options from another question, outsiders and removed players', async () => {
    const { sessionId, students } = await setup(2);
    await start(sessionId);
    const q = (await state(students[0], sessionId)).question!;
    const otherOption = (await db.query<{ id: string }>(
      `select o.id from public.session_question_options o join public.session_questions q on q.id = o.session_question_id
        where q.session_id = $1 and q.position = 1 limit 1`,
      [sessionId],
    )).rows[0].id;
    expect(await errorMessage(submit(students[0], q.id, otherOption))).toMatch(/not part of this question/);

    const stranger = await newStudent();
    expect(await errorMessage(submit(stranger, q.id, q.options[0].id))).toBe('You are not in this game.');

    const me = (await state(students[1], sessionId)).me!;
    await rpc(teacher(host), 'public.remove_participant($1, $2)', [sessionId, me.participant_id]);
    expect(await errorMessage(submit(students[1], q.id, q.options[0].id))).toBe('You are not in this game.');
  });
});

describe('scoring and ranking', () => {
  it('awards speed-weighted points and ranks after the close', async () => {
    const { sessionId, students } = await setup(3);
    await start(sessionId);
    const q = (await state(students[0], sessionId)).question!;

    await setSecondsLeft(q.id, 20); // full time left → 1000
    await submit(students[0], q.id, q.options[0].id);
    await setSecondsLeft(q.id, 10); // half left → 750
    await submit(students[1], q.id, q.options[0].id);
    await submit(students[2], q.id, q.options[1].id); // wrong → 0

    const version = await closeQ(sessionId);
    const s = await state(students[0], sessionId);
    expect(s.session.phase).toBe('reveal');
    expect(s.question?.correct_option_id).toBe(q.options[0].id);
    expect(s.question?.explanation).toBe('Jupiter is the largest.');
    expect(s.question?.distribution).toEqual({ [q.options[0].id]: 2, [q.options[1].id]: 1 });

    const board = s.leaderboard;
    expect(board.map((e) => [e.nickname, e.score, e.rank])).toEqual([
      ['Player 1', 1000, 1],
      ['Player 2', 750, 2],
      ['Player 3', 0, 3],
    ]);
    expect(board[0]).toMatchObject({ last_correct: true, last_points: 1000, streak: 1, previous_rank: null });
    expect(board[2]).toMatchObject({ last_correct: false, last_points: 0, streak: 0 });
    expect(s.me).toMatchObject({ last_correct: true, last_points: 1000, score: 1000, rank: 1 });
    expect(s.leaderboard_version).toBe(version);
  });

  it('gives full points when speed scoring is off', async () => {
    const { sessionId, students } = await setup(1, { ...QUIZ, speed_scoring: false });
    await start(sessionId);
    const q = (await state(students[0], sessionId)).question!;
    await setSecondsLeft(q.id, 1);
    await submit(students[0], q.id, q.options[0].id);
    await closeQ(sessionId);
    expect((await state(students[0], sessionId)).me?.score).toBe(1000);
  });

  it('shares ranks on equal scores and tracks previous rank and streaks', async () => {
    const { sessionId, students } = await setup(3, { ...QUIZ, speed_scoring: false });
    await start(sessionId);
    let q = (await state(students[0], sessionId)).question!;
    await submit(students[0], q.id, q.options[0].id);
    await submit(students[1], q.id, q.options[0].id);
    await submit(students[2], q.id, q.options[1].id);
    await closeQ(sessionId);
    let board = (await state(students[0], sessionId)).leaderboard;
    expect(board.map((e) => e.rank)).toEqual([1, 1, 3]);

    await next(sessionId);
    q = (await state(students[0], sessionId)).question!;
    await submit(students[2], q.id, q.options[0].id); // the last player catches up
    await submit(students[0], q.id, q.options[0].id);
    await closeQ(sessionId);
    board = (await state(students[0], sessionId)).leaderboard;
    const byName = Object.fromEntries(board.map((e) => [e.nickname, e]));
    expect(byName['Player 1']).toMatchObject({ score: 2000, rank: 1, previous_rank: 1, streak: 2 });
    expect(byName['Player 2']).toMatchObject({ score: 1000, rank: 2, previous_rank: 1, streak: 0, last_correct: null });
    expect(byName['Player 3']).toMatchObject({ score: 1000, rank: 2, previous_rank: 3, streak: 1 });
  });

  it('scores the whole game through to the podium', async () => {
    const { sessionId, students } = await setup(2);
    await start(sessionId);
    for (let i = 0; i < 3; i++) {
      const q = (await state(students[0], sessionId)).question!;
      expect(q.position).toBe(i);
      await submit(students[0], q.id, q.options[0].id);
      await closeQ(sessionId);
      if (i === 1) await rpc(teacher(host), 'public.show_leaderboard($1, null)', [sessionId]);
      await next(sessionId);
    }
    const s = await state(students[1], sessionId);
    expect(s.session).toMatchObject({ status: 'ended', phase: 'podium' });
    expect(s.leaderboard[0]).toMatchObject({ nickname: 'Player 1', correct_count: 3, rank: 1 });
  });
});

describe('progression', () => {
  it('advance_if_due closes only after the deadline or when everyone answered', async () => {
    const { sessionId, students } = await setup(2);
    const v0 = await start(sessionId);
    const q = (await state(students[0], sessionId)).question!;

    expect(await rpc<number>(students[0], 'public.advance_if_due($1)', [sessionId])).toBe(v0);
    await submit(students[0], q.id, q.options[0].id);
    expect(await rpc<number>(students[0], 'public.advance_if_due($1)', [sessionId])).toBe(v0);
    await submit(students[1], q.id, q.options[0].id);
    const v1 = await rpc<number>(students[0], 'public.advance_if_due($1)', [sessionId]);
    expect(v1).toBeGreaterThan(v0);
    expect((await state(students[0], sessionId)).session.phase).toBe('reveal');

    // Deadline path on the next question.
    await next(sessionId);
    const q2 = (await state(students[0], sessionId)).question!;
    await db.query(`update public.session_questions set deadline_at = clock_timestamp() - interval '1 second' where id = $1`, [q2.id]);
    await rpc(teacher(host), 'public.advance_if_due($1)', [sessionId]);
    expect((await state(students[0], sessionId)).session.phase).toBe('reveal');

    expect(await errorMessage(rpc(await newStudent(), 'public.advance_if_due($1)', [sessionId]))).toBe('Session not found.');
  });

  it('closing twice and stale next commands are no-ops', async () => {
    const { sessionId, students } = await setup(1);
    await start(sessionId);
    const v = await closeQ(sessionId);
    expect(await closeQ(sessionId)).toBe(v);
    expect(await next(sessionId, v - 1)).toBe(v);
    const v2 = await next(sessionId, v);
    expect(v2).toBe(v + 1);
    expect((await state(students[0], sessionId)).session.current_position).toBe(1);
  });

  it('end_game stops a running game and keeps scores', async () => {
    const { sessionId, students } = await setup(1);
    await start(sessionId);
    const q = (await state(students[0], sessionId)).question!;
    await submit(students[0], q.id, q.options[0].id);
    await rpc(teacher(host), 'public.end_game($1)', [sessionId]);
    const s = await state(students[0], sessionId);
    expect(s.session).toMatchObject({ status: 'ended', phase: 'podium' });
    expect(s.leaderboard[0].correct_count).toBe(1);
  });

  it('broadcasts a state event on every transition', async () => {
    const { sessionId, students } = await setup(1);
    await start(sessionId);
    const q = (await state(students[0], sessionId)).question!;
    await submit(students[0], q.id, q.options[0].id);
    await closeQ(sessionId);
    const game = (await broadcasts(db, `session:${sessionId}:game`)).filter((e) => e.event === 'state');
    expect(game.map((e) => e.payload.phase)).toEqual(['question', 'reveal']);
    const host_ = await broadcasts(db, `session:${sessionId}:host`);
    expect(host_.some((e) => e.event === 'answer_count' && e.payload.answer_count === 1)).toBe(true);
    // Nothing broadcast to players reveals an answer key.
    expect(JSON.stringify(game)).not.toContain(q.options[0].id);
  });
});

describe('late joining', () => {
  it('lets a player join mid-game and ranks them from the next close', async () => {
    const { sessionId, students } = await setup(1);
    await start(sessionId);
    const late = await newStudent();
    await rpc(late, 'public.join_session($1, $2, $3)', [sessionId, 'Latecomer', AVATAR]);
    const q = (await state(late, sessionId)).question!;
    expect(q.status).toBe('open');
    await submit(late, q.id, q.options[0].id);
    await submit(students[0], q.id, q.options[1].id);
    await closeQ(sessionId);
    const board = (await state(late, sessionId)).leaderboard;
    expect(board[0]).toMatchObject({ nickname: 'Latecomer', rank: 1, previous_rank: null });
  });

  it('still refuses joins when the lobby is locked', async () => {
    const { sessionId } = await setup(1);
    await start(sessionId);
    await rpc(teacher(host), 'public.set_session_locked($1, true)', [sessionId]);
    expect(await errorMessage(rpc(await newStudent(), 'public.join_session($1, $2, $3)', [sessionId, 'Nope', AVATAR]))).toMatch(
      /locked/,
    );
  });
});
