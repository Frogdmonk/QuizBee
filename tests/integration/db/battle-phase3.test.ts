import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { as, broadcasts, createAuthUser, createTestDb, type Actor } from './harness';

/*
 * Boss battle, phase 3: the 90 % weapon unlock, one-vote-per-student voting, ties and the teacher's
 * override, equipping, and the weapons' effects.
 */

type Json = Record<string, unknown>;
type Vote = {
  id: string;
  round: number;
  status: string;
  offered: { key: string; name: string }[];
  options: string[];
  voters: number;
  ballots: number;
  round1_counts: Record<string, number> | null;
  counts: Record<string, number> | null;
  winner: string | null;
  decided_by: string | null;
};
type Battle = {
  hp: number;
  weapon: { key: string; charges_left: number; ready_at: number; armed_at: number | null } | null;
  vote: Vote | null;
  last: { unlocked: boolean; damage: number; per_hit: number; weapon_bonus: number; burn: number; special: string | null; frozen: boolean; defended: boolean | null; heal: number; hp_after: number } | null;
};
type State = {
  session: { phase: string; state_version: number };
  question: { id: string; board_at: string | null; options: { id: string; position: number }[] } | null;
  battle: Battle;
  me: { participant_id: string; vote: { round: number; choice: string } | null } | null;
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

async function join(sessionId: string, i: number): Promise<Actor> {
  const s: Actor = { kind: 'user', id: await createAuthUser(db, { anonymous: true }), anonymous: true };
  await rpc(s, 'public.join_session($1, $2, $3)', [sessionId, `Player ${i + 1}`, AVATAR]);
  return s;
}

/** A started battle: 1000 HP, 3 damage per hit, the first question open now. */
async function start(players: number, questions = 4) {
  const quizId = await rpc<string>(teacher(host), 'public.save_quiz($1::jsonb)', [JSON.stringify(quiz(questions))]);
  await rpc(teacher(host), `public.set_quiz_status($1, 'published')`, [quizId]);
  const sessionId = await rpc<string>(teacher(host), `public.create_session($1, '{}'::jsonb)`, [quizId]);
  const students: Actor[] = [];
  for (let i = 0; i < players; i++) students.push(await join(sessionId, i));
  await rpc(teacher(host), 'public.set_battle_settings($1, $2::jsonb)', [sessionId, JSON.stringify({ hp: 1000 })]);
  await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
  return { sessionId, students };
}

const state = (actor: Actor, sessionId: string) => rpc<State>(actor, 'public.get_game_state($1)', [sessionId]);
const nudge = (actor: Actor, sessionId: string) => rpc<number>(actor, 'public.advance_if_due($1)', [sessionId]);
const vote = (actor: Actor, voteId: string, weapon: string) => rpc<{ status: string }>(actor, 'public.cast_weapon_vote($1, $2)', [voteId, weapon]);
const decide = (sessionId: string, weapon: string | null) => rpc<number>(teacher(host), 'public.decide_weapon_vote($1, $2)', [sessionId, weapon]);
const special = (actor: Actor, sessionId: string) => rpc<number>(actor, 'public.use_weapon_special($1)', [sessionId]);

async function openNow(sessionId: string) {
  await db.query(
    `update public.session_questions set starts_at = clock_timestamp(), opened_at = clock_timestamp(),
            deadline_at = clock_timestamp() + make_interval(secs => time_limit_seconds)
      where session_id = $1 and status = 'open'`,
    [sessionId],
  );
}

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
/** The attack reveal is over: the vote opens now. */
const voteOpensNow = (sessionId: string) => db.query(`update public.battle_votes set opens_at = clock_timestamp() - interval '1 second' where session_id = $1`, [sessionId]);
/** The current round's time is up. */
const voteTimeUp = (sessionId: string) => db.query(`update public.battle_votes set closes_at = clock_timestamp() - interval '1 second' where session_id = $1`, [sessionId]);

/** Gets the class a weapon chosen by the teacher (skips the vote). */
async function equip(sessionId: string, students: Actor[], weapon: string) {
  await play(sessionId, students, students.length);
  const v = (await state(students[0], sessionId)).battle.vote!;
  if (!v.offered.some((o) => o.key === weapon)) await db.query('update public.battle_votes set offered = offered || $2::text where id = $1', [v.id, weapon]);
  await decide(sessionId, weapon);
}

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(async () => {
  host = await createAuthUser(db, { meta: { display_name: 'Ms Host' } });
});

describe('the unlock', () => {
  it('9 of 10 correct (90 %) unlocks a vote of three weapons; 8 of 10 does not', async () => {
    const { sessionId, students } = await start(10);
    await play(sessionId, students, 8);
    expect((await state(students[0], sessionId)).battle).toMatchObject({ vote: null, last: { unlocked: false } });

    await next(sessionId);
    await play(sessionId, students, 9);
    const s = await state(students[0], sessionId);
    expect(s.battle.last!.unlocked).toBe(true);
    expect(s.battle.vote).toMatchObject({ round: 1, status: 'open', voters: 10, ballots: 0, winner: null });
    expect(s.battle.vote!.offered).toHaveLength(3);
    expect(new Set(s.battle.vote!.offered.map((o) => o.key)).size).toBe(3); // three different weapons
    // The game waits for the vote: no leaderboard time, and nudging does nothing.
    expect(s.question!.board_at).toBeNull();
    await db.query(`update public.session_questions set closed_at = clock_timestamp() - interval '60 seconds' where session_id = $1 and status = 'closed'`, [sessionId]);
    await nudge(students[0], sessionId);
    expect((await state(students[0], sessionId)).session.phase).toBe('reveal');
  });

  it('never on the last question, never twice within the cooldown, and only once per question', async () => {
    const { sessionId, students } = await start(10, 5);
    await play(sessionId, students, 10); // Q1 unlocks
    await decide(sessionId, null); // cancel
    await rpc(teacher(host), 'public.close_question($1, null)', [sessionId]); // a repeated close changes nothing
    const { rows } = await db.query<{ n: number }>('select count(*)::int as n from public.battle_votes where session_id = $1', [sessionId]);
    expect(rows[0].n).toBe(1);
    for (let i = 0; i < 2; i++) {
      await next(sessionId);
      await play(sessionId, students, 10);
      expect((await state(students[0], sessionId)).battle.last).toMatchObject({ unlocked: false }); // cooldown: 2 questions
    }
    await next(sessionId);
    await play(sessionId, students, 10); // Q4: allowed again
    expect((await state(students[0], sessionId)).battle.last!.unlocked).toBe(true);
    await decide(sessionId, null);
    await next(sessionId);
    await play(sessionId, students, 10); // Q5 is the last question
    expect((await state(students[0], sessionId)).battle.last!.unlocked).toBe(false);
  });
});

describe('voting', () => {
  async function unlocked(players = 10) {
    const r = await start(players);
    await play(r.sessionId, r.students, players);
    const v = (await state(r.students[0], r.sessionId)).battle.vote!;
    return { ...r, v };
  }

  it('one vote per student, only while open, only for the offered weapons; tallies go to the host topic only', async () => {
    const { sessionId, students, v } = await unlocked(4);
    const [a, b] = v.options;
    expect((await vote(students[0], v.id, a)).status).toBe('early'); // during the attack reveal
    await voteOpensNow(sessionId);
    expect((await vote(students[0], v.id, a)).status).toBe('accepted');
    expect((await vote(students[0], v.id, b)).status).toBe('duplicate'); // no changing it
    const notOffered = ['thunder', 'inferno', 'frost', 'shadow', 'crystal', 'healing'].find((k) => !v.options.includes(k))!;
    expect(await errorMessage(vote(students[1], v.id, notOffered))).toMatch(/not in this vote/);
    const late = await join(sessionId, 9);
    expect((await vote(late, v.id, a)).status).toBe('not_eligible');
    expect((await state(students[0], sessionId)).me!.vote).toMatchObject({ round: 1, choice: a });

    const hostTallies = (await broadcasts(db, `session:${sessionId}:host`)).filter((m) => m.event === 'vote_tally');
    expect(hostTallies.at(-1)!.payload).toMatchObject({ vote_id: v.id, round: 1, total: 1, counts: { [a]: 1, [b]: 0 } });
    const gameTallies = (await broadcasts(db, `session:${sessionId}:game`)).filter((m) => m.event === 'vote_tally');
    expect(gameTallies).toHaveLength(0);
  });

  it('the most votes wins when time is up; the weapon is equipped and the leaderboard follows 4.5 s later', async () => {
    const { sessionId, students, v } = await unlocked(5);
    await voteOpensNow(sessionId);
    const [a, b] = v.options;
    await vote(students[0], v.id, a);
    await vote(students[1], v.id, a);
    await vote(students[2], v.id, b);
    await voteTimeUp(sessionId);
    await nudge(students[4], sessionId);
    const s = await state(students[0], sessionId);
    expect(s.battle.vote).toMatchObject({ status: 'done', winner: a, decided_by: 'vote', counts: { [a]: 2, [b]: 1 } });
    expect(s.battle.weapon).toMatchObject({ key: a, armed_at: null, ready_at: 1 });
    expect(s.question!.board_at).not.toBeNull();
    expect(s.session.phase).toBe('reveal');
    await db.query(`update public.battle_votes set resolved_at = clock_timestamp() - interval '5 seconds' where session_id = $1`, [sessionId]);
    await db.query(`update public.session_questions set closed_at = clock_timestamp() - interval '60 seconds' where session_id = $1 and status = 'closed'`, [sessionId]);
    await nudge(students[0], sessionId);
    expect((await state(students[0], sessionId)).session.phase).toBe('leaderboard');
  });

  it('when everyone has voted it closes at once', async () => {
    const { sessionId, students, v } = await unlocked(3);
    await voteOpensNow(sessionId);
    for (const st of students) await vote(st, v.id, v.options[1]);
    expect((await state(students[0], sessionId)).battle.vote).toMatchObject({ status: 'done', winner: v.options[1] });
  });

  it('a tie goes to a runoff between the tied weapons; a second tie goes to the teacher — never random', async () => {
    let s: State;
    const tie = await unlocked(4);
    await voteOpensNow(tie.sessionId);
    const [x, y] = tie.v.options;
    await vote(tie.students[0], tie.v.id, x);
    await vote(tie.students[1], tie.v.id, y);
    await voteTimeUp(tie.sessionId);
    await nudge(tie.students[0], tie.sessionId);
    s = await state(tie.students[0], tie.sessionId);
    expect(s.battle.vote).toMatchObject({ round: 2, status: 'open', options: [x, y].sort(), round1_counts: { [x]: 1, [y]: 1 } });
    expect(s.me!.vote).toBeNull(); // everyone votes again
    expect((await vote(tie.students[2], tie.v.id, x)).status).toBe('accepted');
    expect((await vote(tie.students[3], tie.v.id, y)).status).toBe('accepted');
    await voteTimeUp(tie.sessionId);
    await nudge(tie.students[0], tie.sessionId);
    s = await state(tie.students[0], tie.sessionId);
    expect(s.battle.vote).toMatchObject({ round: 2, status: 'teacher', winner: null });
    expect(s.battle.weapon).toBeNull();
    // The game waits for the teacher.
    expect(await errorMessage(rpc(teacher(host), 'public.show_leaderboard($1, null)', [tie.sessionId]))).toMatch(/Finish the weapon vote/);
    await decide(tie.sessionId, y);
    expect((await state(tie.students[0], tie.sessionId)).battle).toMatchObject({ vote: { status: 'done', winner: y, decided_by: 'teacher' }, weapon: { key: y } });
  });

  it('nobody votes: the teacher decides; the teacher can also cancel; players cannot decide', async () => {
    const { sessionId, students, v } = await unlocked(3);
    await voteOpensNow(sessionId);
    await voteTimeUp(sessionId);
    await nudge(students[0], sessionId);
    expect((await state(students[0], sessionId)).battle.vote).toMatchObject({ status: 'teacher' });
    expect(await errorMessage(rpc(students[0], 'public.decide_weapon_vote($1, $2)', [sessionId, v.options[0]]))).not.toBe('');
    await decide(sessionId, null);
    const s = await state(students[0], sessionId);
    expect(s.battle).toMatchObject({ vote: { status: 'cancelled', decided_by: 'cancelled' }, weapon: null });
    expect(s.question!.board_at).not.toBeNull();
  });
});

describe('weapons in battle', () => {
  it('Thunder Blade: +1 per hit; Thunderclap doubles the hits, uses a charge and then recharges', async () => {
    const { sessionId, students } = await start(10, 6);
    await equip(sessionId, students, 'thunder');
    await next(sessionId);
    await play(sessionId, students, 5);
    expect((await state(students[0], sessionId)).battle.last).toMatchObject({ per_hit: 4, damage: 20, weapon_bonus: 5, special: null });

    await special(teacher(host), sessionId); // between questions: armed for the next one
    expect((await state(students[0], sessionId)).battle.weapon).toMatchObject({ charges_left: 1, armed_at: 2 });
    await next(sessionId);
    await play(sessionId, students, 5);
    expect((await state(students[0], sessionId)).battle.last).toMatchObject({ per_hit: 8, damage: 40, special: 'thunder' });
    expect(await errorMessage(special(teacher(host), sessionId))).toMatch(/recharging/); // cooldown 1: not for question 4
    expect(await errorMessage(special(students[0], sessionId))).not.toBe(''); // the teacher decides when
  });

  it('Frost Hammer: Deep Freeze stops the special attack; its passive halves healing', async () => {
    const { sessionId, students } = await start(10, 6);
    await equip(sessionId, students, 'frost');
    await next(sessionId);
    await play(sessionId, students, 0); // Normal, missed: 3 % of 1000 = 30, halved = 15 (HP was below max)
    expect((await state(students[0], sessionId)).battle.last).toMatchObject({ defended: false, heal: 15 });
    await next(sessionId);
    await openNow(sessionId);
    await special(teacher(host), sessionId); // during the open question: this question
    await play(sessionId, students, 0);
    expect((await state(students[0], sessionId)).battle.last).toMatchObject({ frozen: true, defended: true, heal: 0, special: 'frost' });
  });

  it('Inferno Staff burns every question (1 % of max HP), Ignite five times as hard', async () => {
    const { sessionId, students } = await start(10, 6);
    await equip(sessionId, students, 'inferno');
    await next(sessionId);
    await play(sessionId, students, 10);
    expect((await state(students[0], sessionId)).battle.last).toMatchObject({ burn: 10, damage: 40 });
    await special(teacher(host), sessionId);
    await next(sessionId);
    await play(sessionId, students, 0);
    expect((await state(students[0], sessionId)).battle.last).toMatchObject({ burn: 50, special: 'inferno' });
  });

  it('Crystal Spear: +2 per hit against Normal; Shatter strikes for 10 % of max HP', async () => {
    const { sessionId, students } = await start(10, 6);
    await equip(sessionId, students, 'crystal');
    await next(sessionId);
    await openNow(sessionId);
    await special(teacher(host), sessionId);
    await play(sessionId, students, 2);
    expect((await state(students[0], sessionId)).battle.last).toMatchObject({ per_hit: 5, burn: 0, damage: 2 * 5 + 100, special: 'crystal' });
    expect((await state(students[0], sessionId)).battle.weapon).toMatchObject({ charges_left: 0 });
    await next(sessionId);
    await openNow(sessionId);
    expect(await errorMessage(special(teacher(host), sessionId))).toMatch(/no charges left/);
  });

  it('Shadow Bow: +2 per hit in Rage', async () => {
    const { sessionId, students } = await start(10, 6);
    await equip(sessionId, students, 'shadow');
    await db.query('update public.session_battles set hp = 500 where session_id = $1', [sessionId]);
    await next(sessionId); // opens in Rage
    await play(sessionId, students, 2);
    expect((await state(students[0], sessionId)).battle.last).toMatchObject({ per_hit: 5, damage: 10 });
  });
});

describe('weapon settings', () => {
  it('the teacher can turn weapons off or tune the unlock, lobby only', async () => {
    const quizId = await rpc<string>(teacher(host), 'public.save_quiz($1::jsonb)', [JSON.stringify(quiz(3))]);
    await rpc(teacher(host), `public.set_quiz_status($1, 'published')`, [quizId]);
    const sessionId = await rpc<string>(teacher(host), `public.create_session($1, '{}'::jsonb)`, [quizId]);
    const s0 = await join(sessionId, 0);
    const set = (s: Json) => rpc<number>(teacher(host), 'public.set_weapon_settings($1, $2::jsonb)', [sessionId, JSON.stringify(s)]);
    await set({ unlock_pct: 80, unlock_cooldown: 0, vote_seconds: 15, runoff_seconds: 4 });
    const cfg = (await rpc<{ battle: { config: Json } }>(s0, 'public.get_game_state($1)', [sessionId])).battle.config;
    expect(cfg).toMatchObject({ weapons_enabled: true, unlock_pct: 80, unlock_cooldown: 0, vote_ms: 15000, runoff_ms: 4000 });
    expect(await errorMessage(set({ unlock_pct: 40 }))).toMatch(/50% to 100%/);
    expect(await errorMessage(set({ vote_seconds: 60 }))).toMatch(/5 to 30/);
    expect(await errorMessage(rpc(s0, 'public.set_weapon_settings($1, $2::jsonb)', [sessionId, '{"weapons_enabled": false}']))).not.toBe('');
    await set({ weapons_enabled: false });
    await rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
    expect(await errorMessage(set({ unlock_pct: 90 }))).toMatch(/before the game starts/);
  });
});
