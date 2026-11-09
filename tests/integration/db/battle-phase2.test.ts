import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { as, createAuthUser, createTestDb, type Actor } from './harness';

/*
 * Boss battle, phase 2: Normal / Rage / Enraged modes, class targets, counter-attacks, battle timers
 * and the teacher's settings.
 */

type Json = Record<string, unknown>;
type Battle = {
  hp: number | null;
  last: {
    eligible: number;
    correct: number;
    attackers: string[];
    damage: number;
    hp_before: number;
    hp_after: number;
    mode: string | null;
    target_pct: number | null;
    target_count: number | null;
    defended: boolean | null;
    heal: number;
  } | null;
  current: { question_id: string; mode: string; target_pct: number | null; target_count: number | null; announce: string | null } | null;
  config: Json;
};
type State = {
  session: { phase: string; reveal_ms: number };
  question: { id: string; time_limit_seconds: number; starts_at: string; deadline_at: string; options: { id: string; position: number }[] } | null;
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
  for (let i = 0; i < players; i++) {
    const s: Actor = { kind: 'user', id: await createAuthUser(db, { anonymous: true }), anonymous: true };
    await rpc(s, 'public.join_session($1, $2, $3)', [sessionId, `Player ${i + 1}`, AVATAR]);
    students.push(s);
  }
  return { sessionId, students };
}

const state = (actor: Actor, sessionId: string) => rpc<State>(actor, 'public.get_game_state($1)', [sessionId]);
const settings = (actor: Actor, sessionId: string, s: Json) =>
  rpc<number>(actor, 'public.set_battle_settings($1, $2::jsonb)', [sessionId, JSON.stringify(s)]);
/** Sets the monster's HP directly (as if earlier questions had brought it there). */
const setHp = (sessionId: string, hp: number) => db.query('update public.session_battles set hp = $2 where session_id = $1', [sessionId, hp]);

/** Lets the open question accept answers now (skips the synchronised-start lead). */
async function openNow(sessionId: string) {
  await db.query(
    `update public.session_questions set starts_at = clock_timestamp(), opened_at = clock_timestamp(),
            deadline_at = clock_timestamp() + make_interval(secs => time_limit_seconds)
      where session_id = $1 and status = 'open'`,
    [sessionId],
  );
}

/** The first `correct` students answer correctly, the rest wrongly, then the teacher closes the question. */
async function play(sessionId: string, students: Actor[], correct: number) {
  await openNow(sessionId);
  const s = await state(students[0], sessionId);
  const right = s.question!.options.find((o) => o.position === 0)!.id;
  const wrong = s.question!.options.find((o) => o.position === 1)!.id;
  for (let i = 0; i < students.length; i++) {
    await rpc(students[i], 'public.submit_answer($1, $2)', [s.question!.id, i < correct ? right : wrong]);
  }
  await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);
}

const next = (sessionId: string) => rpc(teacher(host), 'public.next_question($1, null)', [sessionId]);

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(async () => {
  host = await createAuthUser(db, { meta: { display_name: 'Ms Host' } });
});

describe('modes', () => {
  it('the first question is Normal, announced, and starts 3 s later; the target comes as a head count', async () => {
    const { sessionId, students } = await setup(10);
    await settings(teacher(host), sessionId, { hp: 1000 });
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    const s = await state(students[0], sessionId);
    expect(s.battle!.current).toMatchObject({ mode: 'normal', target_pct: 50, target_count: 5, announce: 'intro' });
    const lead = (new Date(s.question!.starts_at).getTime() - Date.now()) / 1000;
    expect(lead).toBeGreaterThan(4);
    expect(lead).toBeLessThanOrEqual(5.1);
    expect(s.session.reveal_ms).toBe(7000); // battle sessions get time for the counter-attack
  });

  it('the mode follows HP when a question opens, and a change of mode is announced', async () => {
    const { sessionId, students } = await setup(10, 4);
    await settings(teacher(host), sessionId, { hp: 1000 });
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    await play(sessionId, students, 10);
    await setHp(sessionId, 700); // exactly 70 %: Rage
    await next(sessionId);
    expect((await state(students[0], sessionId)).battle!.current).toMatchObject({ mode: 'rage', target_pct: 60, target_count: 6, announce: 'rage' });
    await play(sessionId, students, 10);
    await next(sessionId); // still Rage: no announcement
    expect((await state(students[0], sessionId)).battle!.current).toMatchObject({ mode: 'rage', announce: null });
    await play(sessionId, students, 10);
    await setHp(sessionId, 300);
    await next(sessionId);
    expect((await state(students[0], sessionId)).battle!.current).toMatchObject({ mode: 'enraged', target_pct: 70, target_count: 7, announce: 'enraged' });
  });
});

describe('the special attack', () => {
  async function rageQuestion(players = 10) {
    const { sessionId, students } = await setup(players, 2);
    await settings(teacher(host), sessionId, { hp: 1000 });
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    await play(sessionId, students, 0);
    await setHp(sessionId, 600);
    await next(sessionId);
    return { sessionId, students };
  }

  it('Rage: 6 of 10 correct (60 %) stops it; the hits count and nothing heals', async () => {
    const { sessionId, students } = await rageQuestion();
    await play(sessionId, students, 6);
    expect((await state(students[0], sessionId)).battle!.last).toMatchObject({
      mode: 'rage', target_pct: 60, target_count: 6, correct: 6, defended: true, damage: 18, heal: 0, hp_before: 600, hp_after: 582,
    });
  });

  it('Rage: 5 of 10 misses it: the correct answers still hit, then the monster heals 5 % of max HP', async () => {
    const { sessionId, students } = await rageQuestion();
    await play(sessionId, students, 5);
    const s = await state(students[0], sessionId);
    expect(s.battle!.last).toMatchObject({ defended: false, damage: 15, heal: 50, hp_before: 600, hp_after: 635 });
    expect(s.battle!.last!.attackers).toHaveLength(5);
    expect(s.battle!.hp).toBe(635);
  });

  it('30 students: 18 correct is exactly the Rage target', async () => {
    const { sessionId, students } = await rageQuestion(30);
    expect((await state(students[0], sessionId)).battle!.current).toMatchObject({ target_count: 18 });
    await play(sessionId, students, 18);
    expect((await state(students[0], sessionId)).battle!.last).toMatchObject({ correct: 18, defended: true });
  }, 60_000);

  it('healing never goes above max HP, and a monster brought to 0 does not heal', async () => {
    const { sessionId, students } = await setup(4, 3);
    await settings(teacher(host), sessionId, { hp: 100 });
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    await play(sessionId, students, 0); // Normal, missed: 3 % of 100 = 3, but HP is already full
    expect((await state(students[0], sessionId)).battle!.last).toMatchObject({ defended: false, heal: 0, hp_after: 100 });
    await next(sessionId);
    await setHp(sessionId, 2);
    await play(sessionId, students, 1); // 25 % misses the target, but the 3 damage brings it to 0
    expect((await state(students[0], sessionId)).battle!.last).toMatchObject({ defended: false, damage: 3, heal: 0, hp_after: 0 });
    await next(sessionId);
    expect((await state(students[0], sessionId)).battle!.current).toMatchObject({ mode: 'defeated' });
    await play(sessionId, students, 0);
    expect((await state(students[0], sessionId)).battle!.last).toMatchObject({ mode: 'defeated', defended: null, heal: 0, hp_after: 0 });
  });

  it('nobody eligible: no special attack either way', async () => {
    const { sessionId, students } = await rageQuestion(2);
    await db.query(`update public.session_questions set eligible_ids = '{}' where session_id = $1 and status = 'open'`, [sessionId]);
    await play(sessionId, students, 0);
    expect((await state(students[0], sessionId)).battle!.last).toMatchObject({ eligible: 0, defended: null, heal: 0 });
  });
});

describe('battle timers', () => {
  it('off by default: every question keeps its own time', async () => {
    const { sessionId, students } = await setup(3, 2);
    await settings(teacher(host), sessionId, { hp: 1000 });
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    await play(sessionId, students, 0);
    await setHp(sessionId, 500);
    await next(sessionId);
    expect((await state(students[0], sessionId)).question!.time_limit_seconds).toBe(20);
  });

  it('on: Rage questions get 10 s and the deadline follows; Normal keeps its own unless set', async () => {
    const { sessionId, students } = await setup(3, 2);
    await settings(teacher(host), sessionId, { hp: 1000, mode_timers: true });
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    expect((await state(students[0], sessionId)).question!.time_limit_seconds).toBe(20);
    await play(sessionId, students, 0);
    await setHp(sessionId, 500);
    await next(sessionId);
    const q = (await state(students[0], sessionId)).question!;
    expect(q.time_limit_seconds).toBe(10);
    expect(new Date(q.deadline_at).getTime() - new Date(q.starts_at).getTime()).toBe(10_000);
  });
});

describe('teacher settings', () => {
  it('intensity presets set targets and healing; a hand-made change makes it custom', async () => {
    const { sessionId, students } = await setup(1);
    expect((await state(students[0], sessionId)).battle!.config).toMatchObject({
      intensity: 'standard', targets: { normal: 50, rage: 60, enraged: 70 }, heal: { normal: 3, rage: 5, enraged: 8 },
    });
    await settings(teacher(host), sessionId, { intensity: 'fierce' });
    expect((await state(students[0], sessionId)).battle!.config).toMatchObject({
      intensity: 'fierce', targets: { normal: 60, rage: 70, enraged: 80 }, heal: { enraged: 12 },
    });
    await settings(teacher(host), sessionId, { targets: { rage: 65 }, rage_at: 75, enraged_at: 25, timers: { normal: 20, rage: 12 } });
    expect((await state(students[0], sessionId)).battle!.config).toMatchObject({
      intensity: 'custom', targets: { normal: 60, rage: 65, enraged: 80 }, rage_at: 75, enraged_at: 25, timers: { normal: 20, rage: 12, enraged: 15 },
    });
  });

  it('refuses impossible settings', async () => {
    const { sessionId } = await setup(1);
    expect(await errorMessage(settings(teacher(host), sessionId, { intensity: 'brutal' }))).toMatch(/gentle, standard or fierce/);
    expect(await errorMessage(settings(teacher(host), sessionId, { targets: { rage: 0 } }))).toMatch(/1 to 100/);
    expect(await errorMessage(settings(teacher(host), sessionId, { heal: { normal: 80 } }))).toMatch(/0 to 50/);
    expect(await errorMessage(settings(teacher(host), sessionId, { timers: { rage: 3 } }))).toMatch(/5 to 120/);
    expect(await errorMessage(settings(teacher(host), sessionId, { rage_at: 30, enraged_at: 40 }))).toMatch(/lower HP than Rage/);
    expect(await errorMessage(settings(teacher(host), sessionId, { mode_timers: 'yes' }))).toMatch(/on or off/);
  });
});
