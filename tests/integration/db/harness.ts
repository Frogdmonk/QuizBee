/**
 * Database test harness.
 *
 * Runs the real migrations in PGlite (PostgreSQL compiled to WebAssembly) on
 * top of a small bootstrap that reproduces the parts of Supabase our SQL relies
 * on: the anon / authenticated / service_role roles, Supabase's default
 * privileges, the `auth` schema with `auth.uid()` / `auth.jwt()`, and the
 * `extensions` schema. No Docker required.
 *
 * Limits: this does not run GoTrue, PostgREST, Realtime or Storage. It verifies
 * SQL behaviour, privileges and RLS — end-to-end checks against a real Supabase
 * project are covered separately (see docs/TESTING.md).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

const SUPABASE_BOOTSTRAP = /* sql */ `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  create role supabase_auth_admin nologin noinherit;

  create schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;

  grant usage on schema public to anon, authenticated, service_role;
  -- Supabase's default privileges (our migrations revoke these)
  alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin;

  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    is_anonymous boolean not null default false,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    email_confirmed_at timestamptz,
    created_at timestamptz not null default now()
  );
  grant all on auth.users to supabase_auth_admin;

  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select auth.jwt() ->> 'role'
  $$;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
`;

export async function createTestDb(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_BOOTSTRAP);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error });
    }
  }
  return db;
}

export type Actor =
  | { kind: 'anon' }
  | { kind: 'user'; id: string; anonymous?: boolean }
  | { kind: 'service' };

/** Runs `fn` inside a transaction as the given API role with matching JWT claims. */
export async function as<T>(db: PGlite, actor: Actor, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const role = actor.kind === 'anon' ? 'anon' : actor.kind === 'service' ? 'service_role' : 'authenticated';
    const claims =
      actor.kind === 'user' ? { sub: actor.id, role, is_anonymous: Boolean(actor.anonymous) } : { role };
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}

/** Simulates Supabase Auth (GoTrue) creating a user, as supabase_auth_admin. */
export async function createAuthUser(
  db: PGlite,
  input: { email?: string | null; anonymous?: boolean; meta?: Record<string, unknown> } = {},
): Promise<string> {
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.exec('set local role supabase_auth_admin');
    await tx.query(
      `insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values ($1, $2, $3, $4::jsonb)`,
      [id, input.anonymous ? null : (input.email ?? `${id.slice(0, 8)}@example.com`), Boolean(input.anonymous), JSON.stringify(input.meta ?? {})],
    );
  });
  return id;
}

/** Postgres error code of a rejected promise (e.g. '42501' insufficient_privilege). */
export async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown';
  }
}
