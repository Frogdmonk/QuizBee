-- ═════════════════════════════════════════════════════════════════════════════
-- Phase 1 — Foundation
--   * secure-by-default privileges
--   * private helper schema (not exposed through the Data API)
--   * teacher profiles + automatic creation on sign-up
-- ═════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- Secure-by-default privileges
-- Supabase grants anon/authenticated full access to every new table and
-- function in `public` by default, relying on RLS alone. We remove those
-- defaults so each object must be granted explicitly (defence in depth).
-- ─────────────────────────────────────────────────────────────────────────────
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
-- PostgreSQL grants EXECUTE to PUBLIC globally; per-schema rules cannot remove that.
alter default privileges for role postgres revoke execute on functions from public;

-- ─────────────────────────────────────────────────────────────────────────────
-- Private schema for internal helpers. Not listed in the API's exposed
-- schemas, so nothing here is callable over REST. Roles still need USAGE so
-- RLS policies can call the helpers.
-- ─────────────────────────────────────────────────────────────────────────────
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- True when the caller's JWT belongs to an anonymous (student) identity.
create or replace function private.is_anonymous_session()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

grant execute on function private.is_anonymous_session() to anon, authenticated, service_role;

-- Derives a safe default display name from sign-up metadata or the email.
create or replace function private.default_display_name(p_email text, p_meta jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := btrim(left(btrim(coalesce(p_meta ->> 'display_name', '')), 60));
  if v_name = '' then
    v_name := btrim(left(split_part(coalesce(p_email, ''), '@', 1), 60));
  end if;
  if v_name = '' then
    v_name := 'Teacher';
  end if;
  return v_name;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Teacher profiles (one per permanent, non-anonymous auth user)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.teacher_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  school_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_profiles_display_name_length
    check (char_length(btrim(display_name)) between 1 and 60),
  constraint teacher_profiles_school_name_length
    check (school_name is null or char_length(school_name) <= 120)
);

comment on table public.teacher_profiles is
  'Teacher accounts. Created automatically for non-anonymous auth users. Students (anonymous users) never get a row.';

create trigger teacher_profiles_set_updated_at
  before update on public.teacher_profiles
  for each row execute function private.set_updated_at();

alter table public.teacher_profiles enable row level security;

-- Explicit, minimal privileges. Inserts happen only via the sign-up trigger or
-- ensure_teacher_profile(); deletes cascade from auth.users.
grant select on table public.teacher_profiles to authenticated;
grant update (display_name, school_name) on table public.teacher_profiles to authenticated;

create policy "Teachers can read their own profile"
  on public.teacher_profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Teachers can update their own profile"
  on public.teacher_profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- True when the caller is a signed-in teacher (used by later RLS policies).
create or replace function private.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.is_anonymous_session()
     and exists (select 1 from public.teacher_profiles p where p.id = (select auth.uid()));
$$;

grant execute on function private.is_teacher() to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Create a profile automatically when a permanent account signs up.
-- Anonymous (student) sign-ins are skipped.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;

  insert into public.teacher_profiles (id, display_name)
  values (new.id, private.default_display_name(new.email, new.raw_user_meta_data))
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created_create_teacher_profile
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: ensure_teacher_profile()
-- Idempotently returns the caller's profile, creating it if missing (covers
-- accounts that existed before this migration). Refuses anonymous sessions.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.ensure_teacher_profile()
returns public.teacher_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.teacher_profiles;
  v_email text;
  v_meta jsonb;
begin
  if v_uid is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if private.is_anonymous_session() then
    raise exception 'Student sessions cannot have a teacher profile.' using errcode = '42501';
  end if;

  select * into v_profile from public.teacher_profiles where id = v_uid;
  if found then
    return v_profile;
  end if;

  select u.email, u.raw_user_meta_data
    into v_email, v_meta
    from auth.users u
   where u.id = v_uid
     and not coalesce(u.is_anonymous, false);
  if not found then
    raise exception 'Account not found.' using errcode = '42501';
  end if;

  insert into public.teacher_profiles (id, display_name)
  values (v_uid, private.default_display_name(v_email, v_meta))
  on conflict (id) do nothing;

  select * into v_profile from public.teacher_profiles where id = v_uid;
  return v_profile;
end;
$$;

revoke all on function public.ensure_teacher_profile() from public, anon;
grant execute on function public.ensure_teacher_profile() to authenticated;
