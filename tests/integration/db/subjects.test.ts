import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { as, createAuthUser, createTestDb, type Actor } from './harness';

/*
 * Subjects: folders of quizzes owned by a teacher, shareable as a whole. A subject's grants reach
 * every quiz in it (including later ones) through the same access helpers as quiz grants.
 */

type Shared = { id: string; title: string; access: string; shared_subject: { id: string; name: string } | null; workspaces: string[] };
let db: PGlite;
let owner: Actor;
let colleague: Actor;
let outsider: Actor;
let workspaceId: string;

const user = async (name: string): Promise<Actor> => ({ kind: 'user', id: await createAuthUser(db, { meta: { display_name: name } }) });

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
const quiz = (actor: Actor, title: string) =>
  rpc<string>(actor, 'public.save_quiz($1::jsonb)', [JSON.stringify({ title, questions: [{ type: 'true_false', prompt: 'Q', options: [{ label: 'True', is_correct: true }, { label: 'False' }] }] })]);
const createSubject = (actor: Actor, name: string) => rpc<string>(actor, 'public.create_subject($1)', [name]);
const file = (actor: Actor, ids: string[], subject: string | null) => rpc<number>(actor, 'public.set_quizzes_subject($1::uuid[], $2)', [ids, subject]);
const share = (actor: Actor, subject: string, settings: object) =>
  rpc(actor, 'public.set_subject_sharing($1, $2, $3::jsonb)', [subject, workspaceId, JSON.stringify(settings)]);
const sharedWith = (actor: Actor) => rpc<Shared[]>(actor, 'public.list_shared_with_me()');
/** Can this teacher read the quiz row directly (row-level security)? */
const canSee = (actor: Actor, quizId: string) =>
  as(db, actor, async (tx) => (await tx.query('select id from public.quizzes where id = $1', [quizId])).rows.length === 1);

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(async () => {
  owner = await user('Ms Owner');
  colleague = await user('Mr Colleague');
  outsider = await user('Dr Outsider');
  workspaceId = await rpc<string>(owner, 'public.create_workspace($1)', ['Science']);
  const invite = await rpc<{ token: string }>(owner, 'public.create_workspace_invite($1)', [workspaceId]);
  await rpc(colleague, 'public.accept_workspace_invite($1)', [invite.token]);
});

describe('subjects', () => {
  it('a teacher creates subjects and files quizzes in them; names are unique per teacher', async () => {
    const physics = await createSubject(owner, '  Physics   Year 9 ');
    expect(await errorMessage(createSubject(owner, 'physics year 9'))).toMatch(/already have a subject with that name/);
    expect(await errorMessage(createSubject(owner, ' '))).toMatch(/Give the subject a name/);
    const [a, b] = [await quiz(owner, 'Forces'), await quiz(owner, 'Energy')];
    expect(await file(owner, [a, b], physics)).toBe(2);
    expect(await file(owner, [a, b], physics)).toBe(0); // already there
    const list = await rpc<{ id: string; name: string; quiz_count: number; shared: boolean }[]>(owner, 'public.list_my_subjects()');
    expect(list).toEqual([expect.objectContaining({ id: physics, name: 'Physics Year 9', quiz_count: 2, shared: false })]);
    await rpc(owner, 'public.rename_subject($1, $2)', [physics, 'Physics']);
    expect((await rpc<{ name: string }[]>(owner, 'public.list_my_subjects()'))[0].name).toBe('Physics');
  });

  it('only the owner can file quizzes, share or delete a subject', async () => {
    const mine = await createSubject(owner, 'Mine');
    const theirQuiz = await quiz(colleague, 'Theirs');
    expect(await errorMessage(file(owner, [theirQuiz], mine))).toMatch(/only file your own quizzes/);
    expect(await errorMessage(file(colleague, [theirQuiz], mine))).toMatch(/Subject not found/);
    expect(await errorMessage(share(colleague, mine, { everyone: { access: 'edit' } }))).toMatch(/Subject not found/);
    expect(await errorMessage(rpc(colleague, 'public.delete_subject($1)', [mine]))).toMatch(/Subject not found/);
  });

  it('sharing a subject shares every quiz in it, including ones added later; taking one out ends that', async () => {
    const chemistry = await createSubject(owner, 'Chemistry');
    const atoms = await quiz(owner, 'Atoms');
    const unfiled = await quiz(owner, 'Not in the subject');
    await file(owner, [atoms], chemistry);
    await share(owner, chemistry, { everyone: { access: 'view' }, members: [] });

    expect(await canSee(colleague, atoms)).toBe(true);
    expect(await canSee(colleague, unfiled)).toBe(false);
    expect(await canSee(outsider, atoms)).toBe(false);
    let shared = await sharedWith(colleague);
    expect(shared.map((q) => q.title)).toEqual(['Atoms']);
    expect(shared[0]).toMatchObject({ access: 'view', shared_subject: { id: chemistry, name: 'Chemistry' }, workspaces: ['Science'] });

    const bonds = await quiz(owner, 'Bonds');
    await file(owner, [bonds], chemistry);
    expect(await canSee(colleague, bonds)).toBe(true);

    await file(owner, [atoms], null);
    expect(await canSee(colleague, atoms)).toBe(false);
    shared = await sharedWith(colleague);
    expect(shared.map((q) => q.title)).toEqual(['Bonds']);
  });

  it('access levels work through the subject: copy, edit with publishing; the highest grant wins', async () => {
    const maths = await createSubject(owner, 'Maths');
    const fractions = await quiz(owner, 'Fractions');
    await file(owner, [fractions], maths);
    const colleagueId = (colleague as { id: string }).id;
    await share(owner, maths, { everyone: null, members: [{ teacher_id: colleagueId, access: 'copy' }] });
    const copyId = await rpc<string>(colleague, 'public.copy_shared_quiz($1)', [fractions]);
    expect(copyId).toBeTruthy();
    expect(await errorMessage(rpc(colleague, `public.save_quiz($1::jsonb)`, [JSON.stringify({ id: fractions, title: 'Changed', questions: [] })]))).toMatch(/view this quiz but not edit/);

    await share(owner, maths, { everyone: { access: 'edit', can_publish: true }, members: [] });
    await rpc(colleague, `public.save_quiz($1::jsonb)`, [JSON.stringify({ id: fractions, title: 'Fractions (edited)', questions: [{ type: 'true_false', prompt: 'Q', options: [{ label: 'True', is_correct: true }, { label: 'False' }] }] })]);
    await rpc(colleague, `public.set_quiz_status($1, 'published')`, [fractions]);
    const perms = await rpc<{ role: string; can_publish: boolean }>(colleague, 'public.get_quiz_permissions($1)', [fractions]);
    expect(perms).toMatchObject({ role: 'edit', can_publish: true });

    // A quiz grant and a subject grant together: the higher one counts.
    await share(owner, maths, { everyone: { access: 'view' }, members: [] });
    await rpc(owner, 'public.set_quiz_sharing($1, $2, $3::jsonb)', [fractions, workspaceId, JSON.stringify({ everyone: { access: 'copy' }, members: [] })]);
    expect((await sharedWith(colleague)).find((q) => q.id === fractions)?.access).toBe('copy');
  });

  it('leaving the workspace ends subject access; deleting a subject keeps its quizzes, unshared', async () => {
    const history = await createSubject(owner, 'History');
    const romans = await quiz(owner, 'Romans');
    await file(owner, [romans], history);
    const colleagueId = (colleague as { id: string }).id;
    await share(owner, history, { everyone: null, members: [{ teacher_id: colleagueId, access: 'view' }] });
    expect(await canSee(colleague, romans)).toBe(true);

    await rpc(colleague, 'public.leave_workspace($1)', [workspaceId]);
    expect(await canSee(colleague, romans)).toBe(false);
    expect((await db.query('select count(*)::int as n from public.subject_grants where subject_id = $1', [history])).rows[0]).toEqual({ n: 0 });

    const invite = await rpc<{ token: string }>(owner, 'public.create_workspace_invite($1)', [workspaceId]);
    await rpc(colleague, 'public.accept_workspace_invite($1)', [invite.token]);
    await share(owner, history, { everyone: { access: 'view' }, members: [] });
    expect(await canSee(colleague, romans)).toBe(true);
    await rpc(owner, 'public.delete_subject($1)', [history]);
    expect(await canSee(owner, romans)).toBe(true);
    expect(await canSee(colleague, romans)).toBe(false);
    expect((await db.query('select subject_id from public.quizzes where id = $1', [romans])).rows[0]).toEqual({ subject_id: null });
  });
});
