import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { as, createAuthUser, createTestDb, type Actor } from './harness';
import { catalogueMonster, generateMonster } from '@/lib/monsters/generate';
import { CATALOGUE_BY_ID } from '@/lib/monsters/catalogue';

/*
 * Monster engine, phases 1–2: the session stores its monster (validated, locked at the start,
 * the same on every screen and after reconnecting) and its difficulty (presets, automatic
 * resolution from the quiz, HP scaling). HP itself stays server-side as before.
 */

type Json = Record<string, unknown>;
type Battle = {
  monster: string;
  monster_spec: Json | null;
  difficulty: string;
  difficulty_resolved: string | null;
  max_hp: number | null;
  config: { intensity: string; rage_at: number; enraged_at: number; targets: Json; heal: Json };
};
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

const quiz = (difficulties: (string | null)[]): Json => ({
  title: 'Monsters',
  questions: difficulties.map((difficulty, i) => ({
    type: 'multiple_choice',
    prompt: `Question ${i + 1}`,
    difficulty,
    options: [{ label: 'Right', is_correct: true }, { label: 'Wrong' }],
  })),
});

async function lobby(difficulties: (string | null)[] = Array(10).fill(null), players = 10) {
  const quizId = await rpc<string>(teacher(host), 'public.save_quiz($1::jsonb)', [JSON.stringify(quiz(difficulties))]);
  await rpc(teacher(host), `public.set_quiz_status($1, 'published')`, [quizId]);
  const sessionId = await rpc<string>(teacher(host), `public.create_session($1, '{}'::jsonb)`, [quizId]);
  const students: Actor[] = [];
  for (let i = 0; i < players; i++) {
    const s: Actor = { kind: 'user', id: await createAuthUser(db, { anonymous: true }), anonymous: true };
    await rpc(s, 'public.join_session($1, $2, $3)', [sessionId, `Player ${i + 1}`, '000000000']);
    students.push(s);
  }
  return { sessionId, students };
}

const start = (sessionId: string) => rpc(teacher(host), 'public.start_game($1, null)', [sessionId]);
const battle = async (actor: Actor, sessionId: string) => (await rpc<{ battle: Battle }>(actor, 'public.get_game_state($1)', [sessionId])).battle;
const setMonster = (sessionId: string, spec: unknown, actor: Actor = teacher(host)) =>
  rpc(actor, 'public.set_battle_monster($1, $2::jsonb)', [sessionId, spec === null ? null : JSON.stringify(spec)]);
const setDifficulty = (sessionId: string, d: string) => rpc(teacher(host), 'public.set_battle_difficulty($1, $2)', [sessionId, d]);

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(async () => {
  host = await createAuthUser(db, { meta: { display_name: 'Ms Host' } });
});

describe('the session’s monster', () => {
  it('defaults to Gloomjaw on automatic difficulty, exactly as before', async () => {
    const { sessionId } = await lobby();
    const b = await battle(teacher(host), sessionId);
    expect(b).toMatchObject({ monster: 'gloomjaw', monster_spec: null, difficulty: 'auto', difficulty_resolved: null });
  });

  it('stores a generated monster, shows it to everyone and keeps it after the start (reconnects included)', async () => {
    const { sessionId, students } = await lobby();
    const spec = generateMonster({ seed: 2024, topics: ['Question topics'] });
    await setMonster(sessionId, spec);
    expect((await battle(teacher(host), sessionId)).monster_spec).toEqual(spec);
    expect((await battle(teacher(host), sessionId)).monster).toBe(spec.id);

    await start(sessionId);
    expect(await errorMessage(setMonster(sessionId, catalogueMonster(CATALOGUE_BY_ID.get('ashfang')!)))).toMatch(/locked once the game starts/);
    for (const s of students.slice(0, 3)) expect((await battle(s, sessionId)).monster_spec).toEqual(spec);
  });

  it('only the host can choose, a broken monster is refused, and null goes back to the default', async () => {
    const { sessionId, students } = await lobby();
    const spec = catalogueMonster(CATALOGUE_BY_ID.get('hollow-king')!);
    expect(await errorMessage(setMonster(sessionId, spec, students[0]))).not.toBe('');
    for (const bad of [
      { ...spec, rig: 'robot' },
      { ...spec, palette: { ...spec.palette, main: 'red' } },
      { ...spec, name: 'x'.repeat(41) },
      { ...spec, parts: { ...spec.parts, evil: '<script>' } },
      { ...spec, abilities: { ...spec.abilities, primary: '' } },
      { ...spec, padding: 'x'.repeat(5000) },
      'gloomjaw',
    ]) {
      expect(await errorMessage(setMonster(sessionId, bad)), JSON.stringify(bad).slice(0, 60)).toMatch(/could not be used|Choose a monster/);
    }
    await setMonster(sessionId, spec);
    await setMonster(sessionId, null);
    expect(await battle(teacher(host), sessionId)).toMatchObject({ monster: 'gloomjaw', monster_spec: null });
  });
});

describe('difficulty', () => {
  it('a chosen difficulty applies its preset at once; epic enters Rage earlier; locked after the start', async () => {
    const { sessionId } = await lobby();
    await setDifficulty(sessionId, 'hard');
    expect((await battle(teacher(host), sessionId)).config).toMatchObject({ intensity: 'fierce', targets: { normal: 60, rage: 70, enraged: 80 } });
    await setDifficulty(sessionId, 'epic');
    expect((await battle(teacher(host), sessionId)).config).toMatchObject({ intensity: 'fierce', rage_at: 75, enraged_at: 40 });
    await setDifficulty(sessionId, 'easy');
    expect((await battle(teacher(host), sessionId)).config).toMatchObject({ intensity: 'gentle', rage_at: 70, enraged_at: 30, heal: { normal: 0 } });
    expect(await errorMessage(setDifficulty(sessionId, 'nightmare'))).toMatch(/Choose automatic, easy, medium, hard or epic/);
    await start(sessionId);
    expect(await errorMessage(setDifficulty(sessionId, 'medium'))).toMatch(/before the game starts/);
  });

  it('automatic: an untagged quiz is medium (unchanged HP), mostly-hard is easy, a long mostly-easy quiz is hard', async () => {
    // 10 players × 10 questions × 3 damage × 0.7 = 210 HP at medium.
    const untagged = await lobby();
    await start(untagged.sessionId);
    expect(await battle(teacher(host), untagged.sessionId)).toMatchObject({ difficulty_resolved: 'medium', max_hp: 210, config: { intensity: 'standard' } });

    const hardQuiz = await lobby(['hard', 'hard', 'hard', 'medium', null, null, null, null, null, null]);
    await start(hardQuiz.sessionId);
    expect(await battle(teacher(host), hardQuiz.sessionId)).toMatchObject({ difficulty_resolved: 'easy', max_hp: 180, config: { intensity: 'gentle' } });

    const easyQuiz = await lobby(['easy', 'easy', 'easy', 'easy', 'easy', 'easy', 'easy', 'medium', 'medium', 'hard']);
    await start(easyQuiz.sessionId);
    expect(await battle(teacher(host), easyQuiz.sessionId)).toMatchObject({ difficulty_resolved: 'hard', max_hp: 240, config: { intensity: 'fierce' } });
  });

  it('epic scales automatic HP; a teacher’s own HP and hand-tuned settings are never overridden', async () => {
    const epic = await lobby();
    await setDifficulty(epic.sessionId, 'epic');
    await start(epic.sessionId);
    expect(await battle(teacher(host), epic.sessionId)).toMatchObject({ difficulty_resolved: 'epic', max_hp: 270 });

    const own = await lobby(['hard', 'hard', 'hard', 'hard', null, null, null, null, null, null]);
    await rpc(teacher(host), `public.set_battle_settings($1, '{"hp": 500, "targets": {"normal": 45}}'::jsonb)`, [own.sessionId]);
    await start(own.sessionId);
    expect(await battle(teacher(host), own.sessionId)).toMatchObject({ difficulty_resolved: 'easy', max_hp: 500, config: { intensity: 'custom', targets: { normal: 45 } } });
  });
});
