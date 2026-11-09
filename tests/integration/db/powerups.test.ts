import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { as, createAuthUser, createTestDb, type Actor } from './harness';

/*
 * Boss battle plan, phase 5: shared team energy, the teacher's team abilities, the power-up draft
 * before the final challenge, and each power-up's server-checked effect.
 */

type Json = Record<string, unknown>;
type Last = {
  damage: number; per_hit: number; heal: number; defended: boolean | null; hp_after: number; shielded: boolean; lightning: number;
  rally: boolean; scan: boolean; boosted: number; energy_gain: number; energy_reasons: string[];
};
type State = {
  session: { phase: string; current_position: number };
  question: { id: string; position: number; level: number | null; starts_at: string; deadline_at: string; options: { id: string; position: number }[] } | null;
  battle: {
    hp: number; energy: number; draft_position: number | null; weapon: { key: string } | null;
    armed: { shield: number | null; lightning: number | null; rally: number | null; scan: number | null };
    current: { draft: boolean; hidden_option_id: string | null; time_warp_s: number; topic: string | null } | null;
    last: Last | null;
  };
  me: { participant_id: string; powerup: { state: string; offered: { key: string }[]; chosen: string | null; hint: string | null } | null } | null;
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

const OPTIONS = [
  { label: 'Right', is_correct: true },
  { label: 'Wrong A', is_correct: false, misconception: 'Mixes up numerator and denominator' },
  { label: 'Wrong B', is_correct: false },
];
/** Levels 1, 1, final, final; objectives A, B, A, B. */
const LEVELLED: Json = {
  title: 'Fractions',
  speed_scoring: false,
  questions: [1, 1, 4, 4].map((level, i) => ({
    type: 'multiple_choice', prompt: `Question ${i + 1}`, points: 1000, time_limit_seconds: 20, explanation: '',
    level, objective: i % 2 === 0 ? 'Compare fractions' : 'Add fractions', topic: 'Fractions', options: OPTIONS,
  })),
};
const plain = (n: number): Json => ({
  title: 'Plain', speed_scoring: false,
  questions: Array.from({ length: n }, (_, i) => ({ type: 'multiple_choice', prompt: `Q${i + 1}`, points: 1000, time_limit_seconds: 20, options: OPTIONS })),
});

async function start(players: number, quiz: Json = LEVELLED, battle: Json = { hp: 1000 }) {
  const quizId = await rpc<string>(teacher(host), 'public.save_quiz($1::jsonb)', [JSON.stringify(quiz)]);
  await rpc(teacher(host), `public.set_quiz_status($1, 'published')`, [quizId]);
  const sessionId = await rpc<string>(teacher(host), `public.create_session($1, '{}'::jsonb)`, [quizId]);
  await rpc(teacher(host), 'public.set_battle_settings($1, $2::jsonb)', [sessionId, JSON.stringify(battle)]);
  await db.query('update public.session_battles set weapons_enabled = false where session_id = $1', [sessionId]);
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
const ability = (sessionId: string, key: string) => rpc<number>(teacher(host), 'public.use_team_ability($1, $2)', [sessionId, key]);
const use = (s: Actor, sessionId: string) => rpc<{ status: string; hint?: string }>(s, 'public.use_powerup($1)', [sessionId]);
const choose = (s: Actor, sessionId: string, key: string) => rpc<{ status: string }>(s, 'public.choose_powerup($1, $2)', [sessionId, key]);
const energy = (sessionId: string, value: number) => db.query('update public.session_battles set energy = $2 where session_id = $1', [sessionId, value]);

async function openNow(sessionId: string) {
  await db.query(
    `update public.session_questions set starts_at = clock_timestamp(), opened_at = clock_timestamp(),
            deadline_at = clock_timestamp() + make_interval(secs => time_limit_seconds)
      where session_id = $1 and status = 'open'`,
    [sessionId],
  );
}

async function answer(s: Actor, sessionId: string, which: 'r' | 'a' | 'b') {
  const q = (await state(s, sessionId)).question!;
  const option = q.options.find((o) => o.position === { r: 0, a: 1, b: 2 }[which])!;
  return rpc<{ status: string; revived?: boolean }>(s, 'public.submit_answer($1, $2)', [q.id, option.id]);
}

/** answers: 'r' right, 'a'/'b' wrong, '-' silent; then the teacher closes the question. */
async function play(sessionId: string, students: Actor[], answers: string, opened = false) {
  if (!opened) await openNow(sessionId);
  for (let i = 0; i < students.length; i++) if (answers[i] && answers[i] !== '-') await answer(students[i], sessionId, answers[i] as 'r');
  await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]);
}

/** Plays Q1 and Q2 so the next question (Q3) is the first final-challenge question: the draft. */
async function toDraft(sessionId: string, students: Actor[], q1 = 'rrrr', q2 = 'rrrr') {
  await play(sessionId, students, q1);
  await next(sessionId);
  await play(sessionId, students, q2);
  await next(sessionId);
}

/** Gives every student a specific power-up for the final challenge and opens Q3 now. */
async function holding(sessionId: string, students: Actor[], key: string) {
  await db.query(`update public.participant_powerups set offered = array[$2, 'team_heal', 'time_warp'] where session_id = $1`, [sessionId, key]);
  for (const s of students) await choose(s, sessionId, key);
  await openNow(sessionId);
}

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(async () => {
  host = await createAuthUser(db, { meta: { display_name: 'Ms Host' } });
});

describe('team energy', () => {
  it('earned for mastery, defending, and participation — and recorded with its reasons', async () => {
    const { sessionId, students } = await start(4);
    await play(sessionId, students, 'rrra'); // 75 %: mastery, the Tail Swipe (50 %) stopped, everyone answered
    expect((await state(students[0], sessionId)).battle).toMatchObject({
      energy: 25, last: { energy_gain: 25, energy_reasons: ['mastery', 'defended', 'participation'] },
    });
    await next(sessionId);
    await play(sessionId, students, 'a---'); // nothing earned
    expect((await state(students[0], sessionId)).battle).toMatchObject({ energy: 25, last: { energy_gain: 0, energy_reasons: [] } });
  });

  it('capped at 100', async () => {
    const { sessionId, students } = await start(4);
    await energy(sessionId, 95);
    await play(sessionId, students, 'rrrr');
    expect((await state(students[0], sessionId)).battle).toMatchObject({ energy: 100, last: { energy_gain: 5 } });
  });
});

describe('team abilities (teacher)', () => {
  it('need enough energy, and only the teacher can use them', async () => {
    const { sessionId, students } = await start(4);
    await openNow(sessionId);
    expect(await errorMessage(ability(sessionId, 'team_shield'))).toMatch(/Not enough team energy \(0 of 30/);
    await energy(sessionId, 100);
    expect(await errorMessage(rpc(students[0], 'public.use_team_ability($1, $2)', [sessionId, 'team_shield']))).not.toBe('');
    expect(await errorMessage(ability(sessionId, 'fireball'))).toMatch(/Unknown team ability/);
  });

  it('Team Shield blocks the counter-attack heal; Group Lightning strikes 8 % of max HP', async () => {
    const { sessionId, students } = await start(4);
    await energy(sessionId, 100);
    await openNow(sessionId);
    await ability(sessionId, 'team_shield');
    await ability(sessionId, 'group_lightning');
    expect((await state(students[0], sessionId)).battle).toMatchObject({ energy: 30, armed: { shield: 0, lightning: 0 } });
    expect(await errorMessage(ability(sessionId, 'team_shield'))).toMatch(/Not enough|already/);
    await play(sessionId, students, 'r---', true); // 25 %: the Tail Swipe lands, but the shield holds
    expect((await state(students[0], sessionId)).battle.last).toMatchObject({ defended: false, shielded: true, heal: 0, lightning: 80, damage: 83 });
  });

  it('Knowledge Reveal hides one wrong answer of the running question; Final Rally waits for the final challenge', async () => {
    const { sessionId, students } = await start(4);
    await energy(sessionId, 100);
    expect(await errorMessage(ability(sessionId, 'final_rally'))).toMatch(/final challenge/);
    await openNow(sessionId);
    await ability(sessionId, 'knowledge_reveal');
    const s = await state(students[0], sessionId);
    const hidden = s.battle.current!.hidden_option_id;
    expect(hidden).not.toBeNull();
    expect(s.question!.options.find((o) => o.id === hidden)!.position).not.toBe(0); // never the right answer
    expect(await errorMessage(ability(sessionId, 'knowledge_reveal'))).toMatch(/already hidden/);

    await play(sessionId, students, 'rrrr', true);
    await next(sessionId);
    await play(sessionId, students, 'rrrr');
    await next(sessionId); // Q3: the final challenge (and the draft)
    await energy(sessionId, 100);
    await openNow(sessionId);
    await ability(sessionId, 'final_rally');
    await play(sessionId, students, 'rr--', true);
    expect((await state(students[0], sessionId)).battle.last).toMatchObject({ rally: true, per_hit: 6, damage: 12 });
  });
});

describe('the power-up draft', () => {
  it('before the first final-challenge question: 3 power-ups each, 15 s to choose, one pick', async () => {
    const { sessionId, students } = await start(4);
    await toDraft(sessionId, students);
    const s = await state(students[0], sessionId);
    expect(s.question).toMatchObject({ position: 2, level: 4 });
    expect(s.battle).toMatchObject({ draft_position: 2, current: { draft: true } });
    const lead = (new Date(s.question!.starts_at).getTime() - Date.now()) / 1000;
    expect(lead).toBeGreaterThan(15);
    expect(s.me!.powerup).toMatchObject({ state: 'offered', chosen: null });
    const offered = s.me!.powerup!.offered.map((o) => o.key);
    expect(new Set(offered).size).toBe(3);

    const all = ['thunder_strike', 'guardian_shield', 'xray', 'time_warp', 'revival', 'scanner', 'team_heal', 'comeback'];
    expect(await errorMessage(choose(students[0], sessionId, all.find((k) => !offered.includes(k))!))).toMatch(/not offered/);
    expect(await choose(students[0], sessionId, offered[2])).toMatchObject({ status: 'chosen' });
    expect(await choose(students[0], sessionId, offered[1])).toMatchObject({ status: 'already' });
    expect((await state(students[0], sessionId)).me!.powerup).toMatchObject({ state: 'held', chosen: offered[2] });
  });

  it('anyone who did not choose gets their first option when the question closes; no second draft', async () => {
    const { sessionId, students } = await start(4);
    await toDraft(sessionId, students);
    const offered = (await state(students[1], sessionId)).me!.powerup!.offered.map((o) => o.key);
    await play(sessionId, students, 'rrrr');
    expect((await state(students[1], sessionId)).me!.powerup).toMatchObject({ state: 'held', chosen: offered[0] });
    await next(sessionId);
    expect((await state(students[1], sessionId)).battle.current!.draft).toBe(false);
  });

  it('a quiz without levels drafts before its last question (3+ questions); players who joined late get none', async () => {
    const { sessionId, students } = await start(3, plain(3));
    await play(sessionId, students, 'rrr');
    await next(sessionId);
    await play(sessionId, students, 'rrr');
    await next(sessionId);
    expect((await state(students[0], sessionId)).battle.current!.draft).toBe(true);
    const { rows } = await db.query<{ n: number }>('select count(*)::int as n from public.participant_powerups where session_id = $1', [sessionId]);
    expect(rows[0].n).toBe(3);
  });
});

describe('power-ups', () => {
  it('Thunder Strike doubles my correct hit; a power-up is used once and only during a question', async () => {
    const { sessionId, students } = await start(4);
    await toDraft(sessionId, students);
    expect(await errorMessage(use(students[0], sessionId))).toMatch(/Choose a power-up first/);
    await holding(sessionId, students, 'thunder_strike');
    expect(await use(students[0], sessionId)).toMatchObject({ status: 'armed' });
    expect(await errorMessage(use(students[0], sessionId))).toMatch(/already used/);
    await use(students[1], sessionId); // armed, but answers wrong: no boost
    await play(sessionId, students, 'rarr', true);
    expect((await state(students[0], sessionId)).battle.last).toMatchObject({ boosted: 1, per_hit: 3, damage: 3 * 3 + 3 });
    expect((await state(students[0], sessionId)).me!.powerup!.state).toBe('used');
  });

  it('Comeback Charge needs an earlier miss on the same objective, then hits three times as hard', async () => {
    const { sessionId, students } = await start(2);
    await toDraft(sessionId, students, 'ar', 'rr'); // student 0 missed "Compare fractions" (Q1)
    await holding(sessionId, students, 'comeback');
    expect(await errorMessage(use(students[1], sessionId))).toMatch(/have not missed this idea/);
    expect(await use(students[0], sessionId)).toMatchObject({ status: 'armed' });
    await play(sessionId, students, 'rr', true);
    expect((await state(students[0], sessionId)).battle.last).toMatchObject({ boosted: 1, damage: 3 * 3 + 3 });
  });

  it('Revival Crystal: answer, then change it once; a correct change earns half points', async () => {
    const { sessionId, students } = await start(2);
    await toDraft(sessionId, students);
    await holding(sessionId, students, 'revival');
    expect(await errorMessage(use(students[0], sessionId))).toMatch(/Answer first/);
    await answer(students[0], sessionId, 'a');
    expect(await use(students[0], sessionId)).toMatchObject({ status: 'armed' });
    expect(await answer(students[0], sessionId, 'r')).toMatchObject({ status: 'accepted', revived: true });
    expect(await answer(students[0], sessionId, 'b')).toMatchObject({ status: 'duplicate' }); // only once
    const { rows } = await db.query<{ is_correct: boolean; points_awarded: number }>(
      `select a.is_correct, a.points_awarded from public.answers a join public.session_questions q on q.id = a.session_question_id
        where q.session_id = $1 and q.position = 2 and a.participant_id = $2`,
      [sessionId, (await state(students[0], sessionId)).me!.participant_id],
    );
    expect(rows[0]).toEqual({ is_correct: true, points_awarded: 500 });
  });

  it('X-Ray Vision shows what the question tests and a trap, never the answer', async () => {
    const { sessionId, students } = await start(2);
    await toDraft(sessionId, students);
    await holding(sessionId, students, 'xray');
    const r = await use(students[0], sessionId);
    expect(r).toEqual({ status: 'used', hint: 'This question tests: Compare fractions. Careful, a common trap: Mixes up numerator and denominator' });
    expect(r.hint).not.toMatch(/Right/);
    expect((await state(students[0], sessionId)).me!.powerup!.hint).toBe(r.hint);
    expect((await state(students[1], sessionId)).me!.powerup!.hint).toBeNull(); // only for me
  });

  it('Time Warp adds 5 s for everyone (at most 10 s per question)', async () => {
    const { sessionId, students } = await start(3);
    await toDraft(sessionId, students, 'rrr', 'rrr');
    await holding(sessionId, students, 'time_warp');
    const before = new Date((await state(students[0], sessionId)).question!.deadline_at).getTime();
    await use(students[0], sessionId);
    await use(students[1], sessionId);
    expect(await errorMessage(use(students[2], sessionId))).toMatch(/already has 10 extra seconds/);
    const s = await state(students[0], sessionId);
    expect(new Date(s.question!.deadline_at).getTime() - before).toBe(10_000);
    expect(s.battle.current!.time_warp_s).toBe(10);
    expect((await state(students[2], sessionId)).me!.powerup!.state).toBe('held'); // not wasted
  });

  it('Weakness Scanner: the topic on screen and +1 per class hit; Guardian Shield blocks the heal; Team Heal +20', async () => {
    const { sessionId, students } = await start(4);
    await toDraft(sessionId, students);
    await db.query(`update public.participant_powerups set offered = array['scanner', 'guardian_shield', 'team_heal'] where session_id = $1`, [sessionId]);
    await choose(students[0], sessionId, 'scanner');
    await choose(students[1], sessionId, 'guardian_shield');
    await choose(students[2], sessionId, 'team_heal');
    await choose(students[3], sessionId, 'scanner');
    await openNow(sessionId);
    const e0 = (await state(students[0], sessionId)).battle.energy;
    await use(students[0], sessionId);
    expect(await errorMessage(use(students[3], sessionId))).toMatch(/already found/);
    await use(students[1], sessionId);
    await use(students[2], sessionId);
    const s = await state(students[0], sessionId);
    expect(s.battle.current!.topic).toBe('Fractions');
    expect(s.battle.energy).toBe(Math.min(100, e0 + 20));
    await play(sessionId, students, 'r---', true); // 25 %: the special attack lands, the shield holds
    expect((await state(students[0], sessionId)).battle.last).toMatchObject({ scan: true, per_hit: 4, shielded: true, heal: 0 });
  });
});

describe('the Healing Wand', () => {
  it('+5 energy every question; Renewal restores 30 at once', async () => {
    const { sessionId, students } = await start(4, LEVELLED);
    await db.query(`update public.session_battles set weapon = 'healing', weapon_charges = 2, weapon_ready_at = 0 where session_id = $1`, [sessionId]);
    await play(sessionId, students, 'a---');
    expect((await state(students[0], sessionId)).battle.last).toMatchObject({ energy_gain: 5, energy_reasons: ['wand'] });
    await rpc(teacher(host), 'public.use_weapon_special($1)', [sessionId]);
    expect((await state(students[0], sessionId)).battle.energy).toBe(35);
  });
});
