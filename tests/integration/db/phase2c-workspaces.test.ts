import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { as, createAuthUser, createTestDb, errorCode, type Actor } from './harness';

type Json = Record<string, unknown>;

let db: PGlite;
let owner: string;
let alice: string;
let bob: string;
let outsider: string;
let student: string;

const user = (id: string): Actor => ({ kind: 'user', id });
const STUDENT = (): Actor => ({ kind: 'user', id: student, anonymous: true });

async function errorMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return '';
  } catch (error) {
    return (error as Error).message;
  }
}

async function rpc<T = unknown>(actor: Actor, sql: string, params: unknown[] = []): Promise<T> {
  return as(db, actor, async (tx: Transaction) => {
    const { rows } = await tx.query<{ r: T }>(`select ${sql} as r`, params);
    return rows[0]?.r as T;
  });
}

const quiz = (overrides: Json = {}): Json => ({
  title: 'Fractions',
  questions: [
    {
      type: 'multiple_choice',
      prompt: 'What is 1/2 + 1/4?',
      options: [
        { label: '3/4', is_correct: true },
        { label: '2/6', is_correct: false },
      ],
    },
  ],
  ...overrides,
});

const saveQuiz = (actor: Actor, body: Json) => rpc<string>(actor, 'public.save_quiz($1::jsonb)', [JSON.stringify(body)]);
const setStatus = (actor: Actor, id: string, status: string) =>
  rpc(actor, 'public.set_quiz_status($1, $2::public.quiz_status)', [id, status]);
const share = (actor: Actor, quizId: string, workspaceId: string, settings: Json) =>
  rpc(actor, 'public.set_quiz_sharing($1, $2, $3::jsonb)', [quizId, workspaceId, JSON.stringify(settings)]);
const createWorkspace = (actor: Actor, name: string) => rpc<string>(actor, 'public.create_workspace($1)', [name]);
const createInvite = (actor: Actor, workspaceId: string) =>
  rpc<{ id: string; token: string; expires_at: string }>(actor, 'public.create_workspace_invite($1)', [workspaceId]);
const acceptInvite = (actor: Actor, token: string) => rpc<string>(actor, 'public.accept_workspace_invite($1)', [token]);
const revision = async (id: string) =>
  (await db.query<{ revision: number }>('select revision from public.quizzes where id = $1', [id])).rows[0].revision;

/** A workspace owned by `owner` with alice and bob as members. */
async function workspaceWithMembers(name = 'Maths department') {
  const id = await createWorkspace(user(owner), name);
  const invite = await createInvite(user(owner), id);
  await acceptInvite(user(alice), invite.token);
  await acceptInvite(user(bob), invite.token);
  return id;
}

async function visibleTo(actor: Actor, quizId: string) {
  return as(db, actor, async (tx) => {
    const q = await tx.query('select 1 from public.quizzes where id = $1', [quizId]);
    const qq = await tx.query('select 1 from public.quiz_questions where quiz_id = $1', [quizId]);
    const o = await tx.query(
      'select o.is_correct from public.question_options o join public.quiz_questions q on q.id = o.question_id where q.quiz_id = $1',
      [quizId],
    );
    return [q.rows.length, qq.rows.length, o.rows.length];
  });
}

beforeAll(async () => {
  db = await createTestDb();
  owner = await createAuthUser(db, { meta: { display_name: 'Olivia Owner' } });
  alice = await createAuthUser(db, { meta: { display_name: 'Alice Adams' } });
  bob = await createAuthUser(db, { meta: { display_name: 'Bob Brown' } });
  outsider = await createAuthUser(db, { meta: { display_name: 'Oscar Outsider' } });
  student = await createAuthUser(db, { anonymous: true });
});

// Each test starts without workspaces (they are capped at 20 per owner).
beforeEach(async () => {
  await db.query('delete from public.workspaces');
});

it('caps owned workspaces at 20 per teacher', async () => {
  for (let i = 0; i < 20; i++) await createWorkspace(user(outsider), `Team ${i}`);
  expect(await errorMessage(createWorkspace(user(outsider), 'One too many'))).toMatch(/at most 20 workspaces/);
});

describe('workspaces', () => {
  it('creates a workspace with the creator as owner', async () => {
    const id = await createWorkspace(user(owner), '  Science team  ');
    const ws = await rpc<Json>(user(owner), 'public.get_workspace($1)', [id]);
    expect(ws).toMatchObject({ name: 'Science team', role: 'owner', owner_id: owner });
    expect(ws.members).toEqual([expect.objectContaining({ teacher_id: owner, role: 'owner', display_name: 'Olivia Owner' })]);
  });

  it('validates the name', async () => {
    expect(await errorMessage(createWorkspace(user(owner), '   '))).toMatch(/name/);
    expect(await errorMessage(createWorkspace(user(owner), 'x'.repeat(61)))).toMatch(/60 characters/);
  });

  it('lists my workspaces with member counts', async () => {
    const id = await workspaceWithMembers('Listing test');
    const mine = await rpc<Json[]>(user(alice), 'public.list_my_workspaces()');
    expect(mine).toContainEqual(expect.objectContaining({ id, role: 'member', owner_name: 'Olivia Owner', member_count: 3 }));
  });

  it('shows member names to other members, and nothing to non-members', async () => {
    const id = await workspaceWithMembers('Names test');
    const ws = await rpc<{ members: Json[]; invites: Json[] }>(user(alice), 'public.get_workspace($1)', [id]);
    expect(ws.members.map((m) => m.display_name)).toEqual(['Olivia Owner', 'Alice Adams', 'Bob Brown']);
    expect(ws.invites).toEqual([]); // invites are owner-only

    expect(await errorCode(rpc(user(outsider), 'public.get_workspace($1)', [id]))).toBe('P0002');
    const rows = await as(db, user(outsider), async (tx) => {
      const w = await tx.query('select 1 from public.workspaces where id = $1', [id]);
      const m = await tx.query('select 1 from public.workspace_members where workspace_id = $1', [id]);
      return w.rows.length + m.rows.length;
    });
    expect(rows).toBe(0);
  });

  it('lets only the owner rename, remove members and delete', async () => {
    const id = await workspaceWithMembers('Owner powers');
    expect(await errorMessage(rpc(user(alice), 'public.rename_workspace($1, $2)', [id, 'Hijacked']))).toMatch(/Only the workspace owner/);
    expect(await errorMessage(rpc(user(alice), 'public.remove_workspace_member($1, $2)', [id, bob]))).toMatch(/Only the workspace owner/);
    expect(await errorMessage(rpc(user(alice), 'public.delete_workspace($1)', [id]))).toMatch(/Only the workspace owner/);

    await rpc(user(owner), 'public.rename_workspace($1, $2)', [id, 'Renamed']);
    expect((await db.query<Json>('select name from public.workspaces where id = $1', [id])).rows[0].name).toBe('Renamed');
  });

  it('does not let the owner leave or remove themselves', async () => {
    const id = await workspaceWithMembers('Owner stays');
    expect(await errorMessage(rpc(user(owner), 'public.leave_workspace($1)', [id]))).toMatch(/Delete the workspace instead/);
    expect(await errorMessage(rpc(user(owner), 'public.remove_workspace_member($1, $2)', [id, owner]))).toMatch(/cannot remove yourself/);
  });

  it('blocks direct writes to workspace tables', async () => {
    const id = await workspaceWithMembers('Direct writes');
    const codes = await Promise.all([
      errorCode(as(db, user(outsider), (tx) => tx.query(`insert into public.workspace_members (workspace_id, teacher_id) values ($1, $2)`, [id, outsider]))),
      errorCode(as(db, user(owner), (tx) => tx.query(`update public.workspaces set name = 'x' where id = $1`, [id]))),
      errorCode(as(db, user(owner), (tx) => tx.query(`delete from public.workspace_members where workspace_id = $1`, [id]))),
    ]);
    expect(codes).toEqual(['42501', '42501', '42501']);
  });
});

describe('invite links', () => {
  let workspaceId: string;

  beforeEach(async () => {
    workspaceId = await createWorkspace(user(owner), 'Invite tests');
  });

  it('returns a 256-bit token once and stores only its hash', async () => {
    const invite = await createInvite(user(owner), workspaceId);
    expect(invite.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = (await db.query<{ token_hash: Uint8Array }>('select token_hash from public.workspace_invites where id = $1', [invite.id])).rows[0];
    expect(stored.token_hash.length).toBe(32);
    expect(Buffer.from(stored.token_hash).toString('utf8')).not.toContain(invite.token);
  });

  it('does not expose token hashes to the API', async () => {
    await createInvite(user(owner), workspaceId);
    expect(await errorCode(as(db, user(owner), (tx) => tx.query('select token_hash from public.workspace_invites')))).toBe('42501');
    const visible = await as(db, user(owner), async (tx) => (await tx.query('select id from public.workspace_invites where workspace_id = $1', [workspaceId])).rows.length);
    expect(visible).toBe(1);
  });

  it('lets only the owner create invite links', async () => {
    const invite = await createInvite(user(owner), workspaceId);
    await acceptInvite(user(alice), invite.token);
    expect(await errorMessage(createInvite(user(alice), workspaceId))).toMatch(/Only the workspace owner/);
    expect(await errorCode(createInvite(user(outsider), workspaceId))).toBe('P0002');
  });

  it('previews and joins, idempotently, counting each teacher once', async () => {
    const invite = await createInvite(user(owner), workspaceId);
    const preview = await rpc<Json>(user(alice), 'public.preview_workspace_invite($1)', [invite.token]);
    expect(preview).toMatchObject({ workspace_name: 'Invite tests', invited_by: 'Olivia Owner', member_count: 1, already_member: false });

    expect(await acceptInvite(user(alice), invite.token)).toBe(workspaceId);
    expect(await acceptInvite(user(alice), invite.token)).toBe(workspaceId);
    const row = (await db.query<Json>('select use_count from public.workspace_invites where id = $1', [invite.id])).rows[0];
    expect(row.use_count).toBe(1);
    const again = await rpc<Json>(user(alice), 'public.preview_workspace_invite($1)', [invite.token]);
    expect(again).toMatchObject({ already_member: true, member_count: 2 });
  });

  it('rejects revoked, expired and made-up tokens', async () => {
    const revoked = await createInvite(user(owner), workspaceId);
    await rpc(user(owner), 'public.revoke_workspace_invite($1)', [revoked.id]);
    expect(await errorMessage(acceptInvite(user(alice), revoked.token))).toMatch(/not valid/);

    const expired = await createInvite(user(owner), workspaceId);
    await db.query(`update public.workspace_invites set expires_at = now() - interval '1 minute' where id = $1`, [expired.id]);
    expect(await errorMessage(acceptInvite(user(alice), expired.token))).toMatch(/not valid/);
    expect(await errorCode(rpc(user(alice), 'public.preview_workspace_invite($1)', [expired.token]))).toBe('P0002');

    expect(await errorCode(acceptInvite(user(alice), 'not-a-real-token'))).toBe('P0002');
    const members = (await db.query<{ n: number }>('select count(*)::int as n from public.workspace_members where workspace_id = $1', [workspaceId])).rows[0].n;
    expect(members).toBe(1);
  });

  it('expires links after 7 days and caps active links at 10', async () => {
    const invite = await createInvite(user(owner), workspaceId);
    const days = (new Date(invite.expires_at).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
    for (let i = 0; i < 9; i++) await createInvite(user(owner), workspaceId);
    expect(await errorMessage(createInvite(user(owner), workspaceId))).toMatch(/10 active invite links/);
  });

  it('only lists active invites, and only to the owner', async () => {
    const a = await createInvite(user(owner), workspaceId);
    const b = await createInvite(user(owner), workspaceId);
    await rpc(user(owner), 'public.revoke_workspace_invite($1)', [a.id]);
    const ws = await rpc<{ invites: Json[] }>(user(owner), 'public.get_workspace($1)', [workspaceId]);
    expect(ws.invites.map((i) => i.id)).toEqual([b.id]);
  });

  it('refuses students and the anon role', async () => {
    const invite = await createInvite(user(owner), workspaceId);
    expect(await errorCode(acceptInvite(STUDENT(), invite.token))).toBe('42501');
    expect(await errorCode(createWorkspace(STUDENT(), 'Nope'))).toBe('42501');
    expect(await errorCode(acceptInvite({ kind: 'anon' }, invite.token))).toBe('42501');
    expect(await errorCode(as(db, { kind: 'anon' }, (tx) => tx.query('select * from public.workspaces')))).toBe('42501');
  });
});

describe('quiz sharing', () => {
  let workspaceId: string;
  let quizId: string;

  beforeEach(async () => {
    workspaceId = await workspaceWithMembers();
    quizId = await saveQuiz(user(owner), quiz());
  });

  it('keeps quizzes private by default', async () => {
    expect(await visibleTo(user(alice), quizId)).toEqual([0, 0, 0]);
    expect(await rpc<Json[]>(user(alice), 'public.list_shared_with_me()')).not.toContainEqual(expect.objectContaining({ id: quizId }));
  });

  it('opens a quiz to everyone in the workspace with view access', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: { access: 'view' }, members: [] });

    expect(await visibleTo(user(alice), quizId)).toEqual([1, 1, 2]);
    expect(await visibleTo(user(bob), quizId)).toEqual([1, 1, 2]);
    expect(await visibleTo(user(outsider), quizId)).toEqual([0, 0, 0]);
    expect(await visibleTo(STUDENT(), quizId)).toEqual([0, 0, 0]);

    const shared = await rpc<Json[]>(user(alice), 'public.list_shared_with_me()');
    expect(shared).toContainEqual(
      expect.objectContaining({ id: quizId, owner_name: 'Olivia Owner', access: 'view', can_publish: false, workspaces: ['Maths department'] }),
    );
    const perms = await rpc<Json>(user(alice), 'public.get_quiz_permissions($1)', [quizId]);
    expect(perms).toMatchObject({ role: 'view', can_publish: false, can_archive: false });
  });

  it('does not put shared quizzes into the recipient’s own library query', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: { access: 'edit' }, members: [] });
    const own = await as(db, user(alice), async (tx) => (await tx.query('select id from public.quizzes where owner_id = $1', [alice])).rows);
    expect(own).not.toContainEqual({ id: quizId });
  });

  it('view access cannot edit, copy or publish', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: { access: 'view' }, members: [] });
    expect(await errorMessage(saveQuiz(user(alice), quiz({ id: quizId, title: 'Changed' })))).toMatch(/not edit it/);
    expect(await errorMessage(rpc(user(alice), 'public.copy_shared_quiz($1)', [quizId]))).toMatch(/not copy it/);
    expect(await errorMessage(setStatus(user(alice), quizId, 'published'))).toMatch(/Only the owner/);
    expect(await errorMessage(rpc(user(alice), 'public.get_quiz_activity($1)', [quizId]))).toMatch(/owner and editors/);
  });

  it('copy access adds an independent draft to the member’s own library', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: { access: 'copy' }, members: [] });
    await setStatus(user(owner), quizId, 'published');

    const copyId = await rpc<string>(user(alice), 'public.copy_shared_quiz($1)', [quizId]);
    const copy = (await db.query<Json>('select owner_id, title, status, source_quiz_id, question_count from public.quizzes where id = $1', [copyId])).rows[0];
    expect(copy).toEqual({ owner_id: alice, title: 'Fractions', status: 'draft', source_quiz_id: quizId, question_count: 1 });

    // Copying does not allow changing the original, but the copy is fully Alice's.
    expect(await errorMessage(saveQuiz(user(alice), quiz({ id: quizId, title: 'Changed' })))).toMatch(/not edit it/);
    await saveQuiz(user(alice), quiz({ id: copyId, title: 'My version', questions: [] }));
    const original = (await db.query<Json>('select title, question_count from public.quizzes where id = $1', [quizId])).rows[0];
    expect(original).toEqual({ title: 'Fractions', question_count: 1 });
    // The owner can't see the copy.
    expect(await visibleTo(user(owner), copyId)).toEqual([0, 0, 0]);

    const activity = await rpc<Json[]>(user(owner), 'public.get_quiz_activity($1)', [quizId]);
    expect(activity[0]).toMatchObject({ action: 'copied', actor_name: 'Alice Adams' });
  });

  it('edit access changes the shared quiz for everyone and the owner sees who edited', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: { access: 'view' }, members: [{ teacher_id: alice, access: 'edit' }] });

    const before = await revision(quizId);
    await saveQuiz(user(alice), quiz({ id: quizId, title: 'Fractions (revised)', revision: before }));

    const row = (await db.query<Json>('select title, owner_id, updated_by, revision from public.quizzes where id = $1', [quizId])).rows[0];
    expect(row).toEqual({ title: 'Fractions (revised)', owner_id: owner, updated_by: alice, revision: before + 1 });

    const perms = await rpc<Json>(user(owner), 'public.get_quiz_permissions($1)', [quizId]);
    expect(perms).toMatchObject({ role: 'owner', updated_by_name: 'Alice Adams' });
    const activity = await rpc<Json[]>(user(owner), 'public.get_quiz_activity($1)', [quizId]);
    expect(activity[0]).toMatchObject({ action: 'edited', actor_name: 'Alice Adams', is_me: false });

    // Bob only has the workspace-wide view access.
    expect(await errorMessage(saveQuiz(user(bob), quiz({ id: quizId, title: 'Bob was here' })))).toMatch(/not edit it/);
    expect(await rpc<Json>(user(bob), 'public.get_quiz_permissions($1)', [quizId])).toMatchObject({ role: 'view' });
  });

  it('collapses consecutive edits by the same teacher into one activity entry', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: null, members: [{ teacher_id: alice, access: 'edit' }] });
    await saveQuiz(user(alice), quiz({ id: quizId, title: 'One' }));
    await saveQuiz(user(alice), quiz({ id: quizId, title: 'Two' }));
    const activity = await rpc<Json[]>(user(owner), 'public.get_quiz_activity($1)', [quizId]);
    expect(activity.filter((a) => a.action === 'edited' && a.actor_name === 'Alice Adams')).toHaveLength(1);
  });

  it('rejects a save made against an outdated revision', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: { access: 'edit' }, members: [] });
    const loaded = await revision(quizId);
    await saveQuiz(user(owner), quiz({ id: quizId, title: 'Owner saved first', revision: loaded }));

    const stale = as(db, user(alice), (tx) => tx.query('select public.save_quiz($1::jsonb)', [JSON.stringify(quiz({ id: quizId, title: 'Stale', revision: loaded }))]));
    const error = await stale.then(
      () => null,
      (e: { message: string; hint?: string }) => e,
    );
    expect(error?.message).toMatch(/Someone else saved this quiz/);
    expect(error?.hint).toBe('quiz_revision_conflict');
    expect((await db.query<Json>('select title from public.quizzes where id = $1', [quizId])).rows[0].title).toBe('Owner saved first');

    // Older clients that send no revision still save.
    await saveQuiz(user(alice), quiz({ id: quizId, title: 'No revision sent' }));
  });

  it('editors can publish only when the owner allows it, and never archive', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: null, members: [{ teacher_id: alice, access: 'edit', can_publish: false }] });
    expect(await errorMessage(setStatus(user(alice), quizId, 'published'))).toMatch(/Only the owner, or an editor/);

    await share(user(owner), quizId, workspaceId, { everyone: null, members: [{ teacher_id: alice, access: 'edit', can_publish: true }] });
    expect(await rpc<Json>(user(alice), 'public.get_quiz_permissions($1)', [quizId])).toMatchObject({ role: 'edit', can_publish: true });
    await setStatus(user(alice), quizId, 'published');
    await setStatus(user(alice), quizId, 'draft');
    expect(await errorMessage(setStatus(user(alice), quizId, 'archived'))).toMatch(/Only the owner can archive/);

    const actions = (await rpc<Json[]>(user(owner), 'public.get_quiz_activity($1)', [quizId])).map((a) => a.action);
    expect(actions.slice(0, 2)).toEqual(['unpublished', 'published']);
  });

  it('ignores the publish permission unless the access level is edit', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: { access: 'copy', can_publish: true }, members: [] });
    const grant = (await db.query<Json>('select access, can_publish from public.quiz_grants where quiz_id = $1', [quizId])).rows[0];
    expect(grant).toEqual({ access: 'copy', can_publish: false });
  });

  it('gives each member the highest of their workspace-wide and personal access', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: { access: 'copy' }, members: [{ teacher_id: bob, access: 'view' }] });
    expect(await rpc<Json>(user(bob), 'public.get_quiz_permissions($1)', [quizId])).toMatchObject({ role: 'copy' });
  });

  it('shares privately with chosen members only', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: null, members: [{ teacher_id: alice, access: 'view' }] });
    expect(await visibleTo(user(alice), quizId)).toEqual([1, 1, 2]);
    expect(await visibleTo(user(bob), quizId)).toEqual([0, 0, 0]);
  });

  it('returns the sharing settings to the owner only', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: { access: 'view' }, members: [{ teacher_id: alice, access: 'edit', can_publish: true }] });
    const settings = await rpc<{ workspaces: Json[] }>(user(owner), 'public.get_quiz_sharing($1)', [quizId]);
    const ws = settings.workspaces.find((w) => w.id === workspaceId);
    expect(ws).toMatchObject({
      name: 'Maths department',
      everyone: { access: 'view', can_publish: false },
      grants: [{ teacher_id: alice, access: 'edit', can_publish: true }],
    });
    expect((ws?.members as Json[]).map((m) => m.display_name)).toEqual(['Alice Adams', 'Bob Brown']);
    expect(await errorCode(rpc(user(alice), 'public.get_quiz_sharing($1)', [quizId]))).toBe('P0002');
  });

  it('validates sharing settings', async () => {
    expect(await errorMessage(share(user(owner), quizId, workspaceId, { members: [{ teacher_id: outsider, access: 'view' }] }))).toMatch(/only share with members/);
    expect(await errorMessage(share(user(owner), quizId, workspaceId, { members: [{ teacher_id: owner, access: 'view' }] }))).toMatch(/only share with members/);
    expect(await errorMessage(share(user(owner), quizId, workspaceId, { members: [{ teacher_id: alice, access: 'admin' }] }))).toMatch(/view, copy or edit/);
    expect(await errorMessage(share(user(owner), quizId, workspaceId, { everyone: { access: 'owner' } }))).toMatch(/view, copy or edit/);
    expect(
      await errorMessage(share(user(owner), quizId, workspaceId, { members: [{ teacher_id: alice, access: 'view' }, { teacher_id: alice, access: 'edit' }] })),
    ).toMatch(/only be listed once/);
    // Only the owner of the quiz can share it, and only into a workspace they belong to.
    expect(await errorCode(share(user(alice), quizId, workspaceId, { everyone: { access: 'view' } }))).toBe('P0002');
    const foreign = await createWorkspace(user(outsider), 'Somewhere else');
    expect(await errorCode(share(user(owner), quizId, foreign, { everyone: { access: 'view' } }))).toBe('P0002');
  });

  it('makes a quiz private again when sharing is cleared', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: { access: 'edit' }, members: [] });
    await share(user(owner), quizId, workspaceId, { everyone: null, members: [] });
    expect(await visibleTo(user(alice), quizId)).toEqual([0, 0, 0]);
  });

  it('revokes access immediately when a member is removed or leaves', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: { access: 'view' }, members: [{ teacher_id: alice, access: 'edit' }] });

    await rpc(user(owner), 'public.remove_workspace_member($1, $2)', [workspaceId, alice]);
    expect(await visibleTo(user(alice), quizId)).toEqual([0, 0, 0]);
    expect(await errorCode(saveQuiz(user(alice), quiz({ id: quizId })))).toBe('P0002');
    const aliceGrants = (await db.query<{ n: number }>('select count(*)::int as n from public.quiz_grants where teacher_id = $1', [alice])).rows[0].n;
    expect(aliceGrants).toBe(0);

    await rpc(user(bob), 'public.leave_workspace($1)', [workspaceId]);
    expect(await visibleTo(user(bob), quizId)).toEqual([0, 0, 0]);
  });

  it('removes a leaving member’s own shared quizzes from the workspace', async () => {
    const bobsQuiz = await saveQuiz(user(bob), quiz({ title: "Bob's quiz" }));
    await share(user(bob), bobsQuiz, workspaceId, { everyone: { access: 'view' }, members: [] });
    expect(await visibleTo(user(alice), bobsQuiz)).toEqual([1, 1, 2]);

    await rpc(user(bob), 'public.leave_workspace($1)', [workspaceId]);
    expect(await visibleTo(user(alice), bobsQuiz)).toEqual([0, 0, 0]);
  });

  it('removes all sharing when the workspace or the quiz is deleted', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: { access: 'view' }, members: [] });
    await rpc(user(owner), 'public.delete_workspace($1)', [workspaceId]);
    expect(await visibleTo(user(alice), quizId)).toEqual([0, 0, 0]);

    const other = await workspaceWithMembers('Second');
    await share(user(owner), quizId, other, { everyone: { access: 'view' }, members: [] });
    await as(db, user(owner), (tx) => tx.query('delete from public.quizzes where id = $1', [quizId]));
    const grants = (await db.query<{ n: number }>('select count(*)::int as n from public.quiz_grants where quiz_id = $1', [quizId])).rows[0].n;
    expect(grants).toBe(0);
  });

  it('never lets a grantee delete or share the quiz', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: { access: 'edit', can_publish: true }, members: [] });
    const deleted = await as(db, user(alice), async (tx) => (await tx.query('delete from public.quizzes where id = $1', [quizId])).affectedRows);
    expect(deleted).toBe(0);
    expect(await errorCode(rpc(user(alice), 'public.duplicate_quiz($1)', [quizId]))).toBe('P0002');
    expect(await errorCode(share(user(alice), quizId, workspaceId, { everyone: null }))).toBe('P0002');
  });

  it('lets grantees and owners read only the grants that concern them', async () => {
    await share(user(owner), quizId, workspaceId, { everyone: null, members: [{ teacher_id: alice, access: 'view' }] });
    const count = (actor: Actor) =>
      as(db, actor, async (tx) => (await tx.query('select 1 from public.quiz_grants where quiz_id = $1', [quizId])).rows.length);
    expect(await count(user(owner))).toBe(1);
    expect(await count(user(alice))).toBe(1);
    expect(await count(user(bob))).toBe(0);
  });

  it('refuses sharing RPCs to students and the anon role', async () => {
    expect(await errorCode(rpc(STUDENT(), 'public.list_shared_with_me()'))).toBe('42501');
    expect(await errorCode(rpc(STUDENT(), 'public.copy_shared_quiz($1)', [quizId]))).toBe('42501');
    expect(await errorCode(rpc({ kind: 'anon' }, 'public.list_shared_with_me()'))).toBe('42501');
    expect(await errorCode(as(db, { kind: 'anon' }, (tx) => tx.query('select * from public.quiz_grants')))).toBe('42501');
  });
});
