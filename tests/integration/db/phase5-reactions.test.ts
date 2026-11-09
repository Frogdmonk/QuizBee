import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { as, broadcasts, createAuthUser, createTestDb, type Actor } from './harness';

/*
 * Phase 5: the leaderboard after every question (timed reveal → leaderboard) and student reactions.
 */

type Json = Record<string, unknown>;
type State = {
  session: { phase: string; status: string; state_version: number; reactions_enabled: boolean; reveal_ms: number };
  question: { id: string; status: string; closed_at: string | null; board_at: string | null; options: { id: string }[] } | null;
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

const QUIZ: Json = {
  title: 'Planets',
  speed_scoring: true,
  questions: [0, 1].map((i) => ({
    type: 'multiple_choice',
    prompt: `Question ${i + 1}`,
    points: 1000,
    time_limit_seconds: 20,
    options: [
      { label: 'Right', is_correct: true },
      { label: 'Wrong', is_correct: false },
    ],
  })),
};

async function setup(players: number) {
  const quizId = await rpc<string>(teacher(host), 'public.save_quiz($1::jsonb)', [JSON.stringify(QUIZ)]);
  await rpc(teacher(host), `public.set_quiz_status($1, 'published')`, [quizId]);
  const sessionId = await rpc<string>(teacher(host), `public.create_session($1, '{}'::jsonb)`, [quizId]);
  // These tests cover the classic quiz flow; the boss battle (on by default) has its own tests.
  await db.query('update public.session_battles set enabled = false where session_id = $1', [sessionId]);
  const students: Actor[] = [];
  for (let i = 0; i < players; i++) {
    const s: Actor = { kind: 'user', id: await createAuthUser(db, { anonymous: true }), anonymous: true };
    await rpc(s, 'public.join_session($1, $2, $3)', [sessionId, `Player ${i + 1}`, AVATAR]);
    students.push(s);
  }
  return { sessionId, students };
}

const state = (actor: Actor, sessionId: string) => rpc<State>(actor, 'public.get_game_state($1)', [sessionId]);
const react = (actor: Actor, sessionId: string, emote: string) =>
  rpc<{ status: string; retry_ms?: number }>(actor, 'public.send_reaction($1, $2)', [sessionId, emote]);
const nudge = (actor: Actor, sessionId: string) => rpc<number>(actor, 'public.advance_if_due($1)', [sessionId]);

async function startNow(sessionId: string) {
  await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
  await db.query(
    `update public.session_questions set starts_at = clock_timestamp(), opened_at = clock_timestamp(),
            deadline_at = clock_timestamp() + make_interval(secs => time_limit_seconds)
      where session_id = $1 and status = 'open'`,
    [sessionId],
  );
}

/** Pretends the question closed `msAgo` milliseconds ago. */
async function closedAgo(sessionId: string, msAgo: number) {
  await db.query(
    `update public.session_questions set closed_at = clock_timestamp() - make_interval(secs => $2 / 1000.0)
      where session_id = $1 and status = 'closed'`,
    [sessionId, msAgo],
  );
}

const reactions = async (sessionId: string) =>
  (await broadcasts(db, `session:${sessionId}:game`)).filter((b) => b.event === 'reaction').map((b) => b.payload);

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(async () => {
  host = await createAuthUser(db, { meta: { display_name: 'Ms Host' } });
});

describe('leaderboard after every question', () => {
  it('the reveal carries when the leaderboard will appear', async () => {
    const { sessionId, students } = await setup(1);
    await startNow(sessionId);
    await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);
    const s = await state(students[0], sessionId);
    expect(s.session.phase).toBe('reveal');
    expect(s.session.reveal_ms).toBe(5000);
    const gap = new Date(s.question!.board_at!).getTime() - new Date(s.question!.closed_at!).getTime();
    expect(gap).toBe(5000);
  });

  it('advance_if_due moves a finished reveal to the leaderboard, and not before', async () => {
    const { sessionId, students } = await setup(2);
    await startNow(sessionId);
    await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);
    const v = (await state(students[0], sessionId)).session.state_version;

    expect(await nudge(students[0], sessionId)).toBe(v); // 0 s in: too early
    expect((await state(students[0], sessionId)).session.phase).toBe('reveal');

    await closedAgo(sessionId, 5200);
    expect(await nudge(students[1], sessionId)).toBe(v + 1);
    const after = await state(students[0], sessionId);
    expect(after.session.phase).toBe('leaderboard');
    // A second nudge (another phone) changes nothing.
    expect(await nudge(teacher(host), sessionId)).toBe(v + 1);

    const last = (await broadcasts(db, `session:${sessionId}:game`)).filter((b) => b.event === 'state').at(-1)!;
    expect((last.payload.session as Json).phase).toBe('leaderboard');
  });

  it('also after the last question, before the final results', async () => {
    const { sessionId, students } = await setup(1);
    await startNow(sessionId);
    await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);
    await rpc(teacher(host), 'public.next_question($1, null)', [sessionId]);
    await db.query(`update public.session_questions set starts_at = clock_timestamp() where session_id = $1 and status = 'open'`, [sessionId]);
    await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);
    await closedAgo(sessionId, 6000);
    await nudge(students[0], sessionId);
    expect((await state(students[0], sessionId)).session).toMatchObject({ phase: 'leaderboard', status: 'in_progress' });
  });

  it('outsiders cannot nudge', async () => {
    const { sessionId } = await setup(1);
    const stranger: Actor = { kind: 'user', id: await createAuthUser(db, { anonymous: true }), anonymous: true };
    expect(await errorMessage(nudge(stranger, sessionId))).toBe('Session not found.');
  });
});

describe('reactions', () => {
  it('a player in the lobby can react; everyone on the game topic gets it with name and avatar', async () => {
    const { sessionId, students } = await setup(1);
    expect(await react(students[0], sessionId, 'fire')).toEqual({ status: 'sent' });
    const [r] = await reactions(sessionId);
    expect(r).toMatchObject({ n: 'Player 1', a: AVATAR, e: 'fire' });
    expect(typeof r.id).toBe('string');
    expect(typeof r.pid).toBe('string');
  });

  it('only listed reactions: no free text', async () => {
    const { sessionId, students } = await setup(1);
    expect(await errorMessage(react(students[0], sessionId, 'hello everyone'))).toBe('That reaction is not available.');
    expect(await errorMessage(react(students[0], sessionId, '<img src=x>'))).toBe('That reaction is not available.');
    expect(await reactions(sessionId)).toHaveLength(0);
  });

  it('during a question only after answering it; during reveal and leaderboard always', async () => {
    const { sessionId, students } = await setup(2);
    await startNow(sessionId);
    expect(await react(students[0], sessionId, 'eyes')).toEqual({ status: 'not_now' });

    const q = (await state(students[0], sessionId)).question!;
    await rpc(students[0], 'public.submit_answer($1, $2)', [q.id, q.options[0].id]);
    expect(await react(students[0], sessionId, 'eyes')).toEqual({ status: 'sent' });
    expect(await react(students[1], sessionId, 'eyes')).toEqual({ status: 'not_now' }); // has not answered

    await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);
    expect(await react(students[1], sessionId, 'cry')).toEqual({ status: 'sent' });
  });

  it('rate limit: 5 per 8 seconds, then a retry time', async () => {
    const { sessionId, students } = await setup(1);
    for (let i = 0; i < 5; i++) expect((await react(students[0], sessionId, 'party')).status).toBe('sent');
    const limited = await react(students[0], sessionId, 'party');
    expect(limited.status).toBe('rate_limited');
    expect(limited.retry_ms).toBeGreaterThan(0);
    expect(limited.retry_ms).toBeLessThanOrEqual(8000);
    expect(await reactions(sessionId)).toHaveLength(5);

    // Window over: allowed again.
    await db.query(`update public.reaction_limits set window_started_at = clock_timestamp() - interval '9 seconds'`);
    expect((await react(students[0], sessionId, 'party')).status).toBe('sent');
  });

  it('the teacher can switch reactions off and on; screens learn it from the state broadcast', async () => {
    const { sessionId, students } = await setup(1);
    const v = await rpc<number>(teacher(host), 'public.set_reactions_enabled($1, false)', [sessionId]);
    expect((await state(students[0], sessionId)).session.reactions_enabled).toBe(false);
    expect(await react(students[0], sessionId, 'fire')).toEqual({ status: 'disabled' });
    const last = (await broadcasts(db, `session:${sessionId}:game`)).filter((b) => b.event === 'state').at(-1)!;
    expect(last.payload.session).toMatchObject({ reactions_enabled: false, state_version: v });

    await rpc(teacher(host), 'public.set_reactions_enabled($1, true)', [sessionId]);
    expect(await react(students[0], sessionId, 'fire')).toEqual({ status: 'sent' });
  });

  it('players and strangers cannot change the setting; removed players cannot react', async () => {
    const { sessionId, students } = await setup(2);
    expect(await errorMessage(rpc(students[0], 'public.set_reactions_enabled($1, false)', [sessionId]))).toBe('Session not found.');
    const pid = await rpc<string>(students[1], `(public.get_game_state($1)->'me'->>'participant_id')`, [sessionId]);
    await rpc(teacher(host), 'public.remove_participant($1, $2)', [sessionId, pid]);
    expect(await errorMessage(react(students[1], sessionId, 'fire'))).toBe('You are not in this game.');
  });

  it('nobody can read the rate-limit table directly', async () => {
    const { sessionId, students } = await setup(1);
    await react(students[0], sessionId, 'fire');
    expect(await errorMessage(rpc(students[0], '(select count(*) from public.reaction_limits)'))).toMatch(/permission denied/);
  });
});
