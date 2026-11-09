import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { as, broadcasts, createAuthUser, createTestDb, type Actor } from './harness';

/*
 * Boss battle, phase 1: monster HP, the eligibility snapshot and one server-calculated attack per question.
 */

type Json = Record<string, unknown>;
type Battle = {
  enabled: boolean;
  monster: string;
  hp_setting: number | null;
  base_damage: number;
  max_hp: number | null;
  hp: number | null;
  last: {
    question_id: string;
    position: number;
    eligible: number;
    correct: number;
    accuracy: number;
    attackers: string[];
    damage: number;
    hp_before: number;
    hp_after: number;
  } | null;
};
type State = {
  session: { phase: string; status: string; state_version: number };
  question: { id: string; status: string; eligible_count: number | null; options: { id: string; position: number }[] } | null;
  battle: Battle | null;
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

const quiz = (questions: number): Json => ({
  title: 'Planets',
  speed_scoring: true,
  questions: Array.from({ length: questions }, (_, i) => ({
    type: 'multiple_choice',
    prompt: `Question ${i + 1}`,
    points: 1000,
    time_limit_seconds: 20,
    options: [
      { label: 'Right', is_correct: true },
      { label: 'Wrong', is_correct: false },
    ],
  })),
});

async function setup(players: number, questions = 3) {
  const quizId = await rpc<string>(teacher(host), 'public.save_quiz($1::jsonb)', [JSON.stringify(quiz(questions))]);
  await rpc(teacher(host), `public.set_quiz_status($1, 'published')`, [quizId]);
  const sessionId = await rpc<string>(teacher(host), `public.create_session($1, '{}'::jsonb)`, [quizId]);
  // Weapon unlocks (phase 3) have their own tests; here they would pause the game for a vote.
  await db.query('update public.session_battles set weapons_enabled = false where session_id = $1', [sessionId]);
  const students: Actor[] = [];
  for (let i = 0; i < players; i++) students.push(await join(sessionId, i));
  return { sessionId, students };
}

async function join(sessionId: string, i: number): Promise<Actor> {
  const s: Actor = { kind: 'user', id: await createAuthUser(db, { anonymous: true }), anonymous: true };
  await rpc(s, 'public.join_session($1, $2, $3)', [sessionId, `Player ${i + 1}`, AVATAR]);
  return s;
}

const state = (actor: Actor, sessionId: string) => rpc<State>(actor, 'public.get_game_state($1)', [sessionId]);
const settings = (actor: Actor, sessionId: string, s: Json) =>
  rpc<number>(actor, 'public.set_battle_settings($1, $2::jsonb)', [sessionId, JSON.stringify(s)]);

/** Lets the open question accept answers now (skips the 2 s synchronised-start lead). */
async function openNow(sessionId: string) {
  await db.query(
    `update public.session_questions set starts_at = clock_timestamp(), opened_at = clock_timestamp(),
            deadline_at = clock_timestamp() + make_interval(secs => time_limit_seconds)
      where session_id = $1 and status = 'open'`,
    [sessionId],
  );
}

async function answer(student: Actor, sessionId: string, correct: boolean) {
  const s = await state(student, sessionId);
  const option = s.question!.options.find((o) => o.position === (correct ? 0 : 1))!;
  return rpc<{ status: string }>(student, 'public.submit_answer($1, $2)', [s.question!.id, option.id]);
}

async function playerIdOf(student: Actor, sessionId: string): Promise<string> {
  return (await rpc<{ me: { participant_id: string } }>(student, 'public.get_game_state($1)', [sessionId])).me.participant_id;
}

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(async () => {
  host = await createAuthUser(db, { meta: { display_name: 'Ms Host' } });
});

describe('battle setup', () => {
  it('every new session has a battle, on by default, with automatic HP', async () => {
    const { sessionId, students } = await setup(2);
    const s = await state(students[0], sessionId);
    expect(s.battle).toMatchObject({ enabled: true, monster: 'gloomjaw', hp_setting: null, base_damage: 3, hp: null, last: null });
  });

  it('the start fixes HP to fit the class: players × questions × damage × 0.7, rounded', async () => {
    const { sessionId, students } = await setup(10, 3);
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    const s = await state(students[0], sessionId);
    // 10 × 3 × 3 × 0.7 = 63 → 60
    expect(s.battle).toMatchObject({ max_hp: 60, hp: 60 });
  });

  it('the teacher can set HP and damage, or switch the battle off, only in the lobby', async () => {
    const { sessionId, students } = await setup(2);
    const v0 = (await state(students[0], sessionId)).session.state_version;
    const v1 = await settings(teacher(host), sessionId, { hp: 1000, base_damage: 5 });
    expect(v1).toBe(v0 + 1);
    expect((await state(students[0], sessionId)).battle).toMatchObject({ hp_setting: 1000, base_damage: 5 });
    // Broadcast so every screen sees it.
    const last = (await broadcasts(db, `session:${sessionId}:game`)).filter((b) => b.event === 'state').at(-1)!;
    expect((last.payload.battle as Json).hp_setting).toBe(1000);
    // Same settings again: no change.
    expect(await settings(teacher(host), sessionId, { hp: 1000 })).toBe(v1);

    expect(await errorMessage(settings(teacher(host), sessionId, { hp: 10 }))).toMatch(/50 to 100000/);
    expect(await errorMessage(settings(teacher(host), sessionId, { base_damage: 2.5 }))).toMatch(/whole number/);
    expect(await errorMessage(settings(teacher(host), sessionId, { enabled: 'yes' }))).toMatch(/on or off/);
    expect(await errorMessage(settings(students[0], sessionId, { hp: 500 }))).not.toBe('');

    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    expect((await state(students[0], sessionId)).battle).toMatchObject({ max_hp: 1000, hp: 1000 });
    expect(await errorMessage(settings(teacher(host), sessionId, { hp: 500 }))).toMatch(/before the game starts/);
  });
});

describe('the attack after each question', () => {
  it('every correct answer hits: damage = correct × base damage, HP goes down, attackers in answer order', async () => {
    const { sessionId, students } = await setup(5);
    await settings(teacher(host), sessionId, { hp: 1000 });
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    await openNow(sessionId);
    expect((await state(students[0], sessionId)).question!.eligible_count).toBe(5);

    await answer(students[3], sessionId, true);
    await answer(students[0], sessionId, true);
    await answer(students[1], sessionId, false);
    await answer(students[4], sessionId, true);
    // students[2] never answers: counts as incorrect.
    await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);

    const s = await state(students[0], sessionId);
    const ids = await Promise.all([3, 0, 4].map((i) => playerIdOf(students[i], sessionId)));
    expect(s.battle!.hp).toBe(991);
    expect(s.battle!.last).toMatchObject({ position: 0, eligible: 5, correct: 3, accuracy: 60, damage: 9, hp_before: 1000, hp_after: 991 });
    expect(s.battle!.last!.attackers).toEqual(ids);
  });

  it('a question is resolved exactly once, however often it is closed or nudged', async () => {
    const { sessionId, students } = await setup(3);
    await settings(teacher(host), sessionId, { hp: 500 });
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    await openNow(sessionId);
    for (const st of students) await answer(st, sessionId, true);
    await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);
    await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);
    await rpc(students[0], 'public.advance_if_due($1)', [sessionId]);
    await rpc(teacher(host), 'public.end_game($1)', [sessionId]);

    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from public.battle_events where session_id = $1`, [sessionId]);
    expect(rows[0].n).toBe(1);
    expect((await state(students[0], sessionId)).battle!.hp).toBe(491);
  });

  it('players who join or leave during a question do not change its denominator', async () => {
    const { sessionId, students } = await setup(4);
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    await openNow(sessionId);
    // One eligible player leaves, one new player joins after the question opened.
    await rpc(students[3], 'public.leave_session($1)', [sessionId]);
    const late = await join(sessionId, 9);
    await answer(students[0], sessionId, true);
    await answer(students[1], sessionId, true);
    await answer(late, sessionId, true);
    await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);

    const last = (await state(students[0], sessionId)).battle!.last!;
    expect(last.eligible).toBe(4); // the snapshot taken at the open, including the player who left
    expect(last.correct).toBe(2); // the late joiner is not in the snapshot…
    expect(last.accuracy).toBe(50);
    expect(last.attackers).toHaveLength(3); // …but their correct answer still hits the monster
    expect(last.damage).toBe(9);
  });

  it('removed players do not attack', async () => {
    const { sessionId, students } = await setup(3);
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    await openNow(sessionId);
    for (const st of students) await answer(st, sessionId, true);
    await rpc(teacher(host), 'public.remove_participant($1, $2)', [sessionId, await playerIdOf(students[2], sessionId)]);
    await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);
    expect((await state(students[0], sessionId)).battle!.last!.attackers).toHaveLength(2);
  });

  it('HP never goes below zero, and later questions still resolve', async () => {
    const { sessionId, students } = await setup(3, 2);
    await settings(teacher(host), sessionId, { hp: 50, base_damage: 20 });
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    await openNow(sessionId);
    for (const st of students) await answer(st, sessionId, true);
    await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);
    expect((await state(students[0], sessionId)).battle).toMatchObject({ hp: 0, last: { damage: 60, hp_before: 50, hp_after: 0 } });

    await rpc(teacher(host), 'public.next_question($1, null)', [sessionId]);
    await openNow(sessionId);
    await answer(students[0], sessionId, true);
    await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);
    expect((await state(students[0], sessionId)).battle).toMatchObject({ hp: 0, last: { position: 1, damage: 20, hp_before: 0, hp_after: 0 } });
  });

  it('with the battle switched off nothing is recorded and scoring is unchanged', async () => {
    const { sessionId, students } = await setup(2);
    await settings(teacher(host), sessionId, { enabled: false });
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    await openNow(sessionId);
    await answer(students[0], sessionId, true);
    await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);
    const s = await rpc<State & { me: { score: number } }>(students[0], 'public.get_game_state($1)', [sessionId]);
    expect(s.battle).toMatchObject({ enabled: false, hp: null, last: null });
    expect(s.me.score).toBeGreaterThan(0);
  });

  it('100 players answering: one result, exact damage, and the reveal broadcast carries it', async () => {
    const { sessionId, students } = await setup(100, 1);
    await settings(teacher(host), sessionId, { hp: 1000 });
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    await openNow(sessionId);
    // 90 correct, 7 wrong, 3 silent. (Answers run one after another here: this checks the result, not load.)
    for (let i = 0; i < 97; i++) expect((await answer(students[i], sessionId, i < 90)).status).toBe('accepted');
    // A repeated answer is refused and does not count twice.
    expect((await answer(students[0], sessionId, true)).status).toBe('duplicate');
    await rpc(students[50], 'public.advance_if_due($1)', [sessionId]); // not due yet: nothing happens
    await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);

    const last = (await state(students[99], sessionId)).battle!.last!;
    expect(last).toMatchObject({ eligible: 100, correct: 90, accuracy: 90, damage: 270, hp_after: 730 });
    expect(new Set(last.attackers).size).toBe(90);
    const reveal = (await broadcasts(db, `session:${sessionId}:game`)).filter((b) => b.event === 'state').at(-1)!;
    expect(((reveal.payload.battle as Json).last as Json).damage).toBe(270);
    expect(JSON.stringify(reveal.payload).length).toBeLessThan(20_000);
  }, 120_000);
});
