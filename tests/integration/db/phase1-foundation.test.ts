import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, createAuthUser, createTestDb, errorCode } from './harness';

type Profile = { id: string; display_name: string; school_name: string | null };

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
});

describe('teacher profile creation', () => {
  it('creates a profile with the sign-up display name', async () => {
    const id = await createAuthUser(db, { email: 'ada@school.test', meta: { display_name: '  Ada Lovelace  ' } });
    const { rows } = await db.query<Profile>('select * from public.teacher_profiles where id = $1', [id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].display_name).toBe('Ada Lovelace');
  });

  it('falls back to the email local part when no name is provided', async () => {
    const id = await createAuthUser(db, { email: 'grace.hopper@school.test' });
    const { rows } = await db.query<Profile>('select * from public.teacher_profiles where id = $1', [id]);
    expect(rows[0].display_name).toBe('grace.hopper');
  });

  it('truncates overly long names to 60 characters', async () => {
    const id = await createAuthUser(db, { meta: { display_name: 'x'.repeat(200) } });
    const { rows } = await db.query<Profile>('select * from public.teacher_profiles where id = $1', [id]);
    expect(rows[0].display_name).toHaveLength(60);
  });

  it('does not create a profile for anonymous (student) users', async () => {
    const id = await createAuthUser(db, { anonymous: true });
    const { rows } = await db.query('select 1 from public.teacher_profiles where id = $1', [id]);
    expect(rows).toHaveLength(0);
  });
});

describe('teacher profile row level security', () => {
  it('lets a teacher read only their own profile', async () => {
    const alice = await createAuthUser(db, { meta: { display_name: 'Alice' } });
    await createAuthUser(db, { meta: { display_name: 'Bob' } });
    const rows = await as(db, { kind: 'user', id: alice }, async (tx) => {
      const r = await tx.query<Profile>('select id, display_name from public.teacher_profiles');
      return r.rows;
    });
    expect(rows.map((r) => r.id)).toEqual([alice]);
  });

  it('lets a teacher update their own name and school', async () => {
    const id = await createAuthUser(db, { meta: { display_name: 'Before' } });
    const rows = await as(db, { kind: 'user', id }, async (tx) => {
      const r = await tx.query<Profile>(
        `update public.teacher_profiles set display_name = 'After', school_name = 'Hill School' where id = $1 returning *`,
        [id],
      );
      return r.rows;
    });
    expect(rows[0]).toMatchObject({ display_name: 'After', school_name: 'Hill School' });
  });

  it("silently matches zero rows when updating another teacher's profile", async () => {
    const attacker = await createAuthUser(db);
    const victim = await createAuthUser(db, { meta: { display_name: 'Victim' } });
    const affected = await as(db, { kind: 'user', id: attacker }, async (tx) => {
      const r = await tx.query(`update public.teacher_profiles set display_name = 'Hacked' where id = $1`, [victim]);
      return r.affectedRows;
    });
    expect(affected).toBe(0);
    const { rows } = await db.query<Profile>('select display_name from public.teacher_profiles where id = $1', [victim]);
    expect(rows[0].display_name).toBe('Victim');
  });

  it('rejects changes to protected columns such as id and created_at', async () => {
    const id = await createAuthUser(db);
    const code = await errorCode(
      as(db, { kind: 'user', id }, (tx) => tx.query(`update public.teacher_profiles set created_at = now() where id = $1`, [id])),
    );
    expect(code).toBe('42501');
  });

  it('rejects inserts and deletes from API roles', async () => {
    const id = await createAuthUser(db);
    const insertCode = await errorCode(
      as(db, { kind: 'user', id }, (tx) =>
        tx.query(`insert into public.teacher_profiles (id, display_name) values ($1, 'Dup')`, [id]),
      ),
    );
    const deleteCode = await errorCode(
      as(db, { kind: 'user', id }, (tx) => tx.query(`delete from public.teacher_profiles where id = $1`, [id])),
    );
    expect(insertCode).toBe('42501');
    expect(deleteCode).toBe('42501');
  });

  it('enforces display name length with a check constraint', async () => {
    const id = await createAuthUser(db);
    const code = await errorCode(
      as(db, { kind: 'user', id }, (tx) => tx.query(`update public.teacher_profiles set display_name = '   ' where id = $1`, [id])),
    );
    expect(code).toBe('23514');
  });

  it('denies the anon role any access to profiles', async () => {
    const code = await errorCode(as(db, { kind: 'anon' }, (tx) => tx.query('select * from public.teacher_profiles')));
    expect(code).toBe('42501');
  });

  it('shows nothing to anonymous student sessions', async () => {
    const student = await createAuthUser(db, { anonymous: true });
    const rows = await as(db, { kind: 'user', id: student, anonymous: true }, async (tx) => {
      return (await tx.query('select * from public.teacher_profiles')).rows;
    });
    expect(rows).toHaveLength(0);
  });
});

describe('ensure_teacher_profile()', () => {
  it('recreates a missing profile and is idempotent', async () => {
    const id = await createAuthUser(db, { email: 'late@school.test', meta: { display_name: 'Late Joiner' } });
    await db.query('delete from public.teacher_profiles where id = $1', [id]);

    const first = await as(db, { kind: 'user', id }, async (tx) => {
      return (await tx.query<Profile>('select * from public.ensure_teacher_profile()')).rows[0];
    });
    const second = await as(db, { kind: 'user', id }, async (tx) => {
      return (await tx.query<Profile>('select * from public.ensure_teacher_profile()')).rows[0];
    });
    expect(first).toMatchObject({ id, display_name: 'Late Joiner' });
    expect(second.id).toBe(id);
    const { rows } = await db.query('select 1 from public.teacher_profiles where id = $1', [id]);
    expect(rows).toHaveLength(1);
  });

  it('refuses anonymous student sessions', async () => {
    const student = await createAuthUser(db, { anonymous: true });
    const code = await errorCode(
      as(db, { kind: 'user', id: student, anonymous: true }, (tx) => tx.query('select * from public.ensure_teacher_profile()')),
    );
    expect(code).toBe('42501');
  });

  it('cannot be executed by the anon role', async () => {
    const code = await errorCode(as(db, { kind: 'anon' }, (tx) => tx.query('select * from public.ensure_teacher_profile()')));
    expect(code).toBe('42501');
  });
});

describe('private helpers', () => {
  it('is_teacher() distinguishes teachers from students', async () => {
    const teacher = await createAuthUser(db);
    const student = await createAuthUser(db, { anonymous: true });
    const teacherResult = await as(db, { kind: 'user', id: teacher }, async (tx) => {
      return (await tx.query<{ v: boolean }>('select private.is_teacher() as v')).rows[0].v;
    });
    const studentResult = await as(db, { kind: 'user', id: student, anonymous: true }, async (tx) => {
      return (await tx.query<{ v: boolean }>('select private.is_teacher() as v')).rows[0].v;
    });
    expect(teacherResult).toBe(true);
    expect(studentResult).toBe(false);
  });

  it('new public functions are not executable by API roles unless explicitly granted', async () => {
    await db.exec(`create function public.phase1_probe() returns int language sql as 'select 1'`);
    const authedCode = await errorCode(
      as(db, { kind: 'user', id: await createAuthUser(db) }, (tx) => tx.query('select public.phase1_probe()')),
    );
    const anonCode = await errorCode(as(db, { kind: 'anon' }, (tx) => tx.query('select public.phase1_probe()')));
    await db.exec('drop function public.phase1_probe()');
    expect(authedCode).toBe('42501');
    expect(anonCode).toBe('42501');
  });

  it('new public tables are not readable by API roles unless explicitly granted', async () => {
    await db.exec('create table public.phase1_probe (id int)');
    const code = await errorCode(as(db, { kind: 'anon' }, (tx) => tx.query('select * from public.phase1_probe')));
    await db.exec('drop table public.phase1_probe');
    expect(code).toBe('42501');
  });
});
