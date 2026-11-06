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

  -- Minimal Supabase Storage schema (buckets, objects with RLS, foldername()).
  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner uuid,
    created_at timestamptz default now()
  );
  alter table storage.objects enable row level security;
  grant all on storage.objects to anon, authenticated, service_role;
  grant select on storage.buckets to anon, authenticated, service_role;
  create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
  declare _parts text[];
  begin
    select string_to_array(name, '/') into _parts;
    return _parts[1:array_length(_parts, 1) - 1];
  end $$;
  grant execute on function storage.foldername(text) to anon, authenticated, service_role;

  -- Minimal Supabase Realtime schema. realtime.send() records the broadcast in
  -- realtime.messages (as the real one does); realtime.topic() reads the topic
  -- a client is joining, which Realtime sets before evaluating RLS policies.
  create schema realtime;
  grant usage on schema realtime to anon, authenticated, service_role;
  create table realtime.messages (
    id bigserial primary key,
    topic text not null,
    extension text not null,
    event text,
    payload jsonb,
    private boolean default false,
    inserted_at timestamptz default now()
  );
  alter table realtime.messages enable row level security;
  grant select, insert on realtime.messages to anon, authenticated;
  create function realtime.topic() returns text language sql stable as $$
    select nullif(current_setting('realtime.topic', true), '')
  $$;
  grant execute on function realtime.topic() to anon, authenticated, service_role;
  create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
  returns void language sql volatile as $$
    insert into realtime.messages (topic, extension, event, payload, private)
    values (topic, 'broadcast', event, payload, private)
  $$;
`;

/**
 * Asks the database whether `actor` may receive (or send on) a Realtime topic,
 * the same way Realtime does: it sets the topic, then runs the RLS-checked
 * statement as the user.
 */
export async function canUseTopic(
  db: PGlite,
  actor: Actor,
  topic: string,
  mode: 'receive' | 'send' = 'receive',
): Promise<boolean> {
  try {
    return await as(db, actor, async (tx) => {
      await tx.query(`select set_config('realtime.topic', $1, true)`, [topic]);
      if (mode === 'receive') {
        // A message for the topic must exist for the policy to have something to admit.
        const { rows } = await tx.query<{ ok: boolean }>(
          `select true as ok from realtime.messages where topic = $1 and extension = 'broadcast' limit 1`,
          [topic],
        );
        return rows.length > 0;
      }
      await tx.query(
        `insert into realtime.messages (topic, extension, event, payload, private) values ($1, 'broadcast', 'x', '{}', true)`,
        [topic],
      );
      return true;
    });
  } catch {
    return false;
  }
}

/** Broadcasts recorded by realtime.send() for a topic, oldest first. */
export async function broadcasts(db: PGlite, topic: string): Promise<{ event: string; payload: Record<string, unknown> }[]> {
  const { rows } = await db.query<{ event: string; payload: Record<string, unknown> }>(
    'select event, payload from realtime.messages where topic = $1 order by id',
    [topic],
  );
  return rows;
}

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
