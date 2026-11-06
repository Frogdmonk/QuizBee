-- ═════════════════════════════════════════════════════════════════════════════
-- Phase 2c — Workspaces and quiz sharing between teachers
--   * workspaces, workspace_members, workspace_invites (link invites)
--   * quiz_grants: per-quiz access for a whole workspace or chosen members
--       view < copy < edit   (edit is the highest level)
--       view  — open and preview the quiz
--       copy  — view + add an independent copy to their own library
--       edit  — copy + change the shared quiz itself (everyone sees the change);
--               the owner may additionally allow an editor to publish/unpublish
--   * quiz_activity: who edited / published / copied a quiz, visible to the owner
--   * quizzes.revision + updated_by: optimistic locking for concurrent editors
--
-- Purely additive. Existing quizzes have no grants, so they stay private and
-- behave exactly as before. save_quiz and set_quiz_status are replaced with
-- versions that also accept editors (same signatures, grants are kept).
-- ═════════════════════════════════════════════════════════════════════════════

create type public.workspace_role as enum ('owner', 'member');
create type public.quiz_access as enum ('view', 'copy', 'edit');
create type public.quiz_activity_action as enum ('edited', 'published', 'unpublished', 'archived', 'restored', 'copied');

-- ─────────────────────────────────────────────────────────────────────────────
-- Changes to existing tables
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.quizzes
  add column revision integer not null default 0,
  add column updated_by uuid references public.teacher_profiles (id) on delete set null;

comment on column public.quizzes.revision is
  'Incremented on every content save. save_quiz rejects a save made against an older revision (concurrent editors).';

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.teacher_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_name_length check (char_length(btrim(name)) between 1 and 60)
);

create index workspaces_owner_idx on public.workspaces (owner_id);

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function private.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  teacher_id uuid not null references public.teacher_profiles (id) on delete cascade,
  role public.workspace_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, teacher_id)
);

create index workspace_members_teacher_idx on public.workspace_members (teacher_id);
create unique index workspace_members_one_owner_idx on public.workspace_members (workspace_id) where role = 'owner';

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references public.teacher_profiles (id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  use_count integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.workspace_invites is
  'Reusable invite links. Only the SHA-256 of the 256-bit token is stored; the raw token is shown once.';

create index workspace_invites_workspace_idx on public.workspace_invites (workspace_id, created_at desc);

create table public.quiz_grants (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- null = everyone in the workspace ("open to all"); otherwise one chosen member.
  teacher_id uuid references public.teacher_profiles (id) on delete cascade,
  access public.quiz_access not null default 'view',
  can_publish boolean not null default false,
  granted_by uuid references public.teacher_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint quiz_grants_publish_needs_edit check (not can_publish or access = 'edit')
);

create unique index quiz_grants_everyone_key on public.quiz_grants (quiz_id, workspace_id) where teacher_id is null;
create unique index quiz_grants_member_key on public.quiz_grants (quiz_id, workspace_id, teacher_id) where teacher_id is not null;
create index quiz_grants_teacher_idx on public.quiz_grants (teacher_id) where teacher_id is not null;
create index quiz_grants_workspace_idx on public.quiz_grants (workspace_id);

create table public.quiz_activity (
  id bigint generated always as identity primary key,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  actor_id uuid references public.teacher_profiles (id) on delete set null,
  action public.quiz_activity_action not null,
  created_at timestamptz not null default now()
);

create index quiz_activity_quiz_idx on public.quiz_activity (quiz_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers (private schema, not exposed through the Data API)
-- ─────────────────────────────────────────────────────────────────────────────

-- Workspaces the caller belongs to. SECURITY DEFINER so RLS policies can use it
-- without recursing into workspace_members' own policy.
create or replace function private.my_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.workspace_id
    from public.workspace_members m
   where m.teacher_id = (select auth.uid())
     and not private.is_anonymous_session();
$$;

-- Quizzes shared with the caller through a workspace they still belong to.
create or replace function private.shared_quiz_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct g.quiz_id
    from public.quiz_grants g
    join public.workspace_members m
      on m.workspace_id = g.workspace_id
     and m.teacher_id = (select auth.uid())
   where (g.teacher_id is null or g.teacher_id = (select auth.uid()))
     and not private.is_anonymous_session();
$$;

grant execute on function private.my_workspace_ids() to authenticated, service_role;
grant execute on function private.shared_quiz_ids() to authenticated, service_role;

-- Highest access a (non-owner) teacher has to a quiz; null = none.
create or replace function private.quiz_access_of(p_quiz_id uuid, p_teacher uuid)
returns public.quiz_access
language sql
stable
security definer
set search_path = ''
as $$
  select max(g.access)
    from public.quiz_grants g
    join public.workspace_members m
      on m.workspace_id = g.workspace_id
     and m.teacher_id = p_teacher
   where g.quiz_id = p_quiz_id
     and (g.teacher_id is null or g.teacher_id = p_teacher);
$$;

-- True when an editor has been allowed to publish / unpublish the quiz.
create or replace function private.quiz_can_publish(p_quiz_id uuid, p_teacher uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(bool_or(g.can_publish), false)
    from public.quiz_grants g
    join public.workspace_members m
      on m.workspace_id = g.workspace_id
     and m.teacher_id = p_teacher
   where g.quiz_id = p_quiz_id
     and g.access = 'edit'
     and (g.teacher_id is null or g.teacher_id = p_teacher);
$$;

create or replace function private.require_teacher()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_teacher() then
    raise exception 'Only signed-in teachers can do that.' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create or replace function private.clean_workspace_name(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if char_length(v_name) not between 1 and 60 then
    raise exception 'Give the workspace a name (up to 60 characters).' using errcode = 'P0001';
  end if;
  return v_name;
end;
$$;

-- Caller's role in a workspace, or "not found" when they are not a member
-- (so non-members cannot probe which workspace ids exist).
create or replace function private.workspace_role_of(p_workspace_id uuid, p_teacher uuid)
returns public.workspace_role
language plpgsql
stable
set search_path = ''
as $$
declare
  v_role public.workspace_role;
begin
  select m.role into v_role
    from public.workspace_members m
   where m.workspace_id = p_workspace_id and m.teacher_id = p_teacher;
  if not found then
    raise exception 'Workspace not found.' using errcode = 'P0002';
  end if;
  return v_role;
end;
$$;

create or replace function private.require_workspace_owner(p_workspace_id uuid, p_teacher uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if private.workspace_role_of(p_workspace_id, p_teacher) <> 'owner' then
    raise exception 'Only the workspace owner can do that.' using errcode = 'P0001';
  end if;
end;
$$;

-- 256-bit random token, base64url without padding (43 characters).
create or replace function private.new_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
$$;

create or replace function private.token_hash(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select extensions.digest(coalesce(p_token, ''), 'sha256');
$$;

-- Removes sharing that depended on a teacher's membership of a workspace:
-- grants made to them there, and grants on their quizzes to that workspace.
create or replace function private.cleanup_member_grants(p_workspace_id uuid, p_teacher uuid)
returns void
language sql
set search_path = ''
as $$
  delete from public.quiz_grants g
   where g.workspace_id = p_workspace_id
     and (g.teacher_id = p_teacher
          or g.quiz_id in (select q.id from public.quizzes q where q.owner_id = p_teacher));
$$;

-- Records activity on a quiz. Consecutive edits by the same teacher within 15
-- minutes collapse into one entry so the log stays short.
create or replace function private.log_quiz_activity(
  p_quiz_id uuid,
  p_actor uuid,
  p_action public.quiz_activity_action
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_last record;
begin
  if p_action = 'edited' then
    select a.id, a.actor_id, a.action, a.created_at into v_last
      from public.quiz_activity a
     where a.quiz_id = p_quiz_id
     order by a.created_at desc, a.id desc
     limit 1;
    if found and v_last.actor_id = p_actor and v_last.action = 'edited'
       and v_last.created_at > now() - interval '15 minutes' then
      update public.quiz_activity set created_at = now() where id = v_last.id;
      return;
    end if;
  end if;
  insert into public.quiz_activity (quiz_id, actor_id, action) values (p_quiz_id, p_actor, p_action);
end;
$$;

create or replace function private.display_name_of(p_teacher uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce((select p.display_name from public.teacher_profiles p where p.id = p_teacher), 'Former teacher');
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row level security
-- Clients may only SELECT; every write goes through the RPCs below.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.quiz_grants enable row level security;
alter table public.quiz_activity enable row level security;

grant select on table public.workspaces to authenticated;
grant select on table public.workspace_members to authenticated;
-- token_hash is deliberately not readable.
grant select (id, workspace_id, created_by, expires_at, revoked_at, use_count, created_at)
  on table public.workspace_invites to authenticated;
grant select on table public.quiz_grants to authenticated;
grant select on table public.quiz_activity to authenticated;

create policy "Members can read their workspaces"
  on public.workspaces for select to authenticated
  using (id in (select private.my_workspace_ids()));

create policy "Members can read who is in their workspaces"
  on public.workspace_members for select to authenticated
  using (workspace_id in (select private.my_workspace_ids()));

create policy "Workspace owners can read their invites"
  on public.workspace_invites for select to authenticated
  using (exists (
    select 1 from public.workspaces w
     where w.id = workspace_invites.workspace_id
       and w.owner_id = (select auth.uid())
  ));

create policy "Quiz owners and grantees can read grants"
  on public.quiz_grants for select to authenticated
  using (
    teacher_id = (select auth.uid())
    or (teacher_id is null and workspace_id in (select private.my_workspace_ids()))
    or exists (
      select 1 from public.quizzes q
       where q.id = quiz_grants.quiz_id
         and q.owner_id = (select auth.uid())
    )
  );

create policy "Quiz owners can read quiz activity"
  on public.quiz_activity for select to authenticated
  using (exists (
    select 1 from public.quizzes q
     where q.id = quiz_activity.quiz_id
       and q.owner_id = (select auth.uid())
  ));

-- Shared quizzes become readable (including answer keys: these are teachers).
create policy "Members can read quizzes shared with them"
  on public.quizzes for select to authenticated
  using (id in (select private.shared_quiz_ids()));

create policy "Members can read questions of shared quizzes"
  on public.quiz_questions for select to authenticated
  using (quiz_id in (select private.shared_quiz_ids()));

create policy "Members can read answer options of shared quizzes"
  on public.question_options for select to authenticated
  using (exists (
    select 1 from public.quiz_questions qq
     where qq.id = question_options.question_id
       and qq.quiz_id in (select private.shared_quiz_ids())
  ));

-- ═════════════════════════════════════════════════════════════════════════════
-- RPCs: workspaces
-- Limits (mirrored in src/lib/workspace-rules.ts):
--   20 owned workspaces per teacher · 50 memberships per teacher
--   50 members per workspace · 10 active invite links per workspace · 7-day links
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.create_workspace(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
  v_name text := private.clean_workspace_name(p_name);
  v_id uuid;
begin
  if (select count(*) from public.workspaces where owner_id = v_uid) >= 20 then
    raise exception 'You can own at most 20 workspaces. Delete one you no longer use first.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.workspace_members where teacher_id = v_uid) >= 50 then
    raise exception 'You can be in at most 50 workspaces. Leave one first.' using errcode = 'P0001';
  end if;

  insert into public.workspaces (name, owner_id) values (v_name, v_uid) returning id into v_id;
  insert into public.workspace_members (workspace_id, teacher_id, role) values (v_id, v_uid, 'owner');
  return v_id;
end;
$$;

create or replace function public.rename_workspace(p_workspace_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
begin
  perform private.require_workspace_owner(p_workspace_id, v_uid);
  update public.workspaces set name = private.clean_workspace_name(p_name) where id = p_workspace_id;
end;
$$;

create or replace function public.delete_workspace(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
begin
  perform private.require_workspace_owner(p_workspace_id, v_uid);
  -- Members, invites and every quiz grant in the workspace cascade.
  delete from public.workspaces where id = p_workspace_id;
end;
$$;

create or replace function public.leave_workspace(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
begin
  if private.workspace_role_of(p_workspace_id, v_uid) = 'owner' then
    raise exception 'You own this workspace, so you cannot leave it. Delete the workspace instead.' using errcode = 'P0001';
  end if;
  delete from public.workspace_members where workspace_id = p_workspace_id and teacher_id = v_uid;
  perform private.cleanup_member_grants(p_workspace_id, v_uid);
end;
$$;

create or replace function public.remove_workspace_member(p_workspace_id uuid, p_teacher_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
begin
  perform private.require_workspace_owner(p_workspace_id, v_uid);
  if p_teacher_id = v_uid then
    raise exception 'You cannot remove yourself. Delete the workspace instead.' using errcode = 'P0001';
  end if;
  delete from public.workspace_members where workspace_id = p_workspace_id and teacher_id = p_teacher_id;
  if not found then
    raise exception 'That teacher is not a member of this workspace.' using errcode = 'P0002';
  end if;
  perform private.cleanup_member_grants(p_workspace_id, p_teacher_id);
end;
$$;

-- [{ id, name, role, owner_name, member_count, joined_at }]
create or replace function public.list_my_workspaces()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', w.id,
             'name', w.name,
             'role', m.role,
             'owner_name', private.display_name_of(w.owner_id),
             'member_count', (select count(*) from public.workspace_members x where x.workspace_id = w.id),
             'joined_at', m.joined_at
           ) order by lower(w.name), w.id)
      from public.workspace_members m
      join public.workspaces w on w.id = m.workspace_id
     where m.teacher_id = v_uid
  ), '[]'::jsonb);
end;
$$;

-- Workspace details for a member. Active invite links are included for the owner only.
create or replace function public.get_workspace(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
  v_role public.workspace_role := private.workspace_role_of(p_workspace_id, v_uid);
  v_workspace public.workspaces;
begin
  select * into v_workspace from public.workspaces where id = p_workspace_id;
  return jsonb_build_object(
    'id', v_workspace.id,
    'name', v_workspace.name,
    'role', v_role,
    'owner_id', v_workspace.owner_id,
    'created_at', v_workspace.created_at,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'teacher_id', m.teacher_id,
               'display_name', private.display_name_of(m.teacher_id),
               'role', m.role,
               'joined_at', m.joined_at
             ) order by (m.role = 'owner') desc, m.joined_at, m.teacher_id)
        from public.workspace_members m
       where m.workspace_id = p_workspace_id
    ), '[]'::jsonb),
    'invites', case when v_role = 'owner' then coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id,
               'created_at', i.created_at,
               'expires_at', i.expires_at,
               'use_count', i.use_count,
               'created_by_name', private.display_name_of(i.created_by)
             ) order by i.created_at desc)
        from public.workspace_invites i
       where i.workspace_id = p_workspace_id
         and i.revoked_at is null
         and i.expires_at > now()
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPCs: invite links
-- ─────────────────────────────────────────────────────────────────────────────

-- Returns { id, token, expires_at }. The raw token is never stored or shown again.
create or replace function public.create_workspace_invite(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
  v_token text;
  v_id uuid;
  v_expires timestamptz := now() + interval '7 days';
begin
  perform private.require_workspace_owner(p_workspace_id, v_uid);
  if (select count(*) from public.workspace_invites
       where workspace_id = p_workspace_id and revoked_at is null and expires_at > now()) >= 10 then
    raise exception 'This workspace already has 10 active invite links. Revoke one first.' using errcode = 'P0001';
  end if;

  v_token := private.new_token();
  insert into public.workspace_invites (workspace_id, created_by, token_hash, expires_at)
  values (p_workspace_id, v_uid, private.token_hash(v_token), v_expires)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'token', v_token, 'expires_at', v_expires);
end;
$$;

create or replace function public.revoke_workspace_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
  v_workspace uuid;
begin
  select workspace_id into v_workspace from public.workspace_invites where id = p_invite_id;
  if not found then
    raise exception 'Invite link not found.' using errcode = 'P0002';
  end if;
  perform private.require_workspace_owner(v_workspace, v_uid);
  update public.workspace_invites set revoked_at = now() where id = p_invite_id and revoked_at is null;
end;
$$;

-- What the invite page shows before joining.
create or replace function public.preview_workspace_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
  v_invite public.workspace_invites;
  v_workspace public.workspaces;
begin
  select * into v_invite
    from public.workspace_invites
   where token_hash = private.token_hash(p_token)
     and revoked_at is null
     and expires_at > now();
  if not found then
    raise exception 'This invite link is not valid. It may have expired or been revoked. Ask for a new link.' using errcode = 'P0002';
  end if;
  select * into v_workspace from public.workspaces where id = v_invite.workspace_id;

  return jsonb_build_object(
    'workspace_id', v_workspace.id,
    'workspace_name', v_workspace.name,
    'invited_by', private.display_name_of(v_invite.created_by),
    'owner_name', private.display_name_of(v_workspace.owner_id),
    'member_count', (select count(*) from public.workspace_members where workspace_id = v_workspace.id),
    'expires_at', v_invite.expires_at,
    'already_member', exists (
      select 1 from public.workspace_members where workspace_id = v_workspace.id and teacher_id = v_uid
    )
  );
end;
$$;

-- Joins the caller to the invite's workspace. Idempotent; returns the workspace id.
create or replace function public.accept_workspace_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
  v_invite public.workspace_invites;
begin
  select * into v_invite
    from public.workspace_invites
   where token_hash = private.token_hash(p_token)
     and revoked_at is null
     and expires_at > now()
     for update;
  if not found then
    raise exception 'This invite link is not valid. It may have expired or been revoked. Ask for a new link.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.workspace_members where workspace_id = v_invite.workspace_id and teacher_id = v_uid) then
    return v_invite.workspace_id;
  end if;
  if (select count(*) from public.workspace_members where workspace_id = v_invite.workspace_id) >= 50 then
    raise exception 'This workspace is full (50 members).' using errcode = 'P0001';
  end if;
  if (select count(*) from public.workspace_members where teacher_id = v_uid) >= 50 then
    raise exception 'You can be in at most 50 workspaces. Leave one first.' using errcode = 'P0001';
  end if;

  insert into public.workspace_members (workspace_id, teacher_id, role) values (v_invite.workspace_id, v_uid, 'member');
  update public.workspace_invites set use_count = use_count + 1 where id = v_invite.id;
  return v_invite.workspace_id;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- RPCs: sharing quizzes
-- ═════════════════════════════════════════════════════════════════════════════

-- Owner only. For every workspace the owner belongs to: its members and the
-- quiz's current grants there.
-- { quiz_id, workspaces: [{ id, name, members: [{teacher_id, display_name, role}],
--                           everyone: {access, can_publish} | null,
--                           grants: [{teacher_id, access, can_publish}] }] }
create or replace function public.get_quiz_sharing(p_quiz_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
begin
  if not exists (select 1 from public.quizzes where id = p_quiz_id and owner_id = v_uid) then
    raise exception 'Quiz not found.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'quiz_id', p_quiz_id,
    'workspaces', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', w.id,
               'name', w.name,
               'members', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'teacher_id', x.teacher_id,
                          'display_name', private.display_name_of(x.teacher_id),
                          'role', x.role
                        ) order by lower(private.display_name_of(x.teacher_id)), x.teacher_id)
                   from public.workspace_members x
                  where x.workspace_id = w.id and x.teacher_id <> v_uid
               ), '[]'::jsonb),
               'everyone', (
                 select jsonb_build_object('access', g.access, 'can_publish', g.can_publish)
                   from public.quiz_grants g
                  where g.quiz_id = p_quiz_id and g.workspace_id = w.id and g.teacher_id is null
               ),
               'grants', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'teacher_id', g.teacher_id,
                          'access', g.access,
                          'can_publish', g.can_publish
                        ))
                   from public.quiz_grants g
                  where g.quiz_id = p_quiz_id and g.workspace_id = w.id and g.teacher_id is not null
               ), '[]'::jsonb)
             ) order by lower(w.name), w.id)
        from public.workspace_members m
        join public.workspaces w on w.id = m.workspace_id
       where m.teacher_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

-- Owner only. Atomically replaces the quiz's grants in one workspace.
-- p_settings: { everyone: {access, can_publish} | null,
--               members:  [{teacher_id, access, can_publish}] }
-- everyone = null and members = [] makes the quiz private again in that workspace.
create or replace function public.set_quiz_sharing(p_quiz_id uuid, p_workspace_id uuid, p_settings jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
  v_everyone jsonb := p_settings -> 'everyone';
  v_members jsonb := coalesce(p_settings -> 'members', '[]'::jsonb);
  v_member jsonb;
  v_access text;
  v_teacher uuid;
  v_seen uuid[] := '{}';
begin
  perform 1 from public.quizzes where id = p_quiz_id and owner_id = v_uid for update;
  if not found then
    raise exception 'Quiz not found.' using errcode = 'P0002';
  end if;
  perform private.workspace_role_of(p_workspace_id, v_uid);

  if jsonb_typeof(coalesce(p_settings, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(v_members) <> 'array'
     or (v_everyone is not null and jsonb_typeof(v_everyone) not in ('object', 'null')) then
    raise exception 'Invalid sharing settings.' using errcode = '22023';
  end if;
  if jsonb_array_length(v_members) > 50 then
    raise exception 'You can choose at most 50 members.' using errcode = 'P0001';
  end if;

  delete from public.quiz_grants where quiz_id = p_quiz_id and workspace_id = p_workspace_id;

  if v_everyone is not null and jsonb_typeof(v_everyone) = 'object' then
    v_access := v_everyone ->> 'access';
    if v_access is null or v_access not in ('view', 'copy', 'edit') then
      raise exception 'Choose view, copy or edit access.' using errcode = 'P0001';
    end if;
    insert into public.quiz_grants (quiz_id, workspace_id, teacher_id, access, can_publish, granted_by)
    values (p_quiz_id, p_workspace_id, null, v_access::public.quiz_access,
            v_access = 'edit' and coalesce((v_everyone ->> 'can_publish')::boolean, false), v_uid);
  end if;

  for v_member in select value from jsonb_array_elements(v_members)
  loop
    v_access := v_member ->> 'access';
    if v_access is null or v_access not in ('view', 'copy', 'edit') then
      raise exception 'Choose view, copy or edit access.' using errcode = 'P0001';
    end if;
    v_teacher := nullif(v_member ->> 'teacher_id', '')::uuid;
    if v_teacher is null or v_teacher = v_uid
       or not exists (select 1 from public.workspace_members
                       where workspace_id = p_workspace_id and teacher_id = v_teacher) then
      raise exception 'You can only share with members of this workspace.' using errcode = 'P0001';
    end if;
    if v_teacher = any (v_seen) then
      raise exception 'Each member can only be listed once.' using errcode = 'P0001';
    end if;
    v_seen := v_seen || v_teacher;

    insert into public.quiz_grants (quiz_id, workspace_id, teacher_id, access, can_publish, granted_by)
    values (p_quiz_id, p_workspace_id, v_teacher, v_access::public.quiz_access,
            v_access = 'edit' and coalesce((v_member ->> 'can_publish')::boolean, false), v_uid);
  end loop;
end;
$$;

-- Quizzes other teachers share with the caller.
-- [{ id, title, description, subject, cover_image_path, status, question_count, updated_at,
--    owner_name, access, can_publish, workspaces: [name] }]
create or replace function public.list_shared_with_me()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
begin
  return coalesce((
    select jsonb_agg(item order by (item ->> 'updated_at') desc)
      from (
        select jsonb_build_object(
                 'id', q.id,
                 'title', q.title,
                 'description', q.description,
                 'subject', q.subject,
                 'cover_image_path', q.cover_image_path,
                 'status', q.status,
                 'question_count', q.question_count,
                 'updated_at', q.updated_at,
                 'owner_name', private.display_name_of(q.owner_id),
                 'access', private.quiz_access_of(q.id, v_uid),
                 'can_publish', private.quiz_can_publish(q.id, v_uid),
                 'workspaces', (
                   select coalesce(jsonb_agg(distinct w.name), '[]'::jsonb)
                     from public.quiz_grants g
                     join public.workspace_members m on m.workspace_id = g.workspace_id and m.teacher_id = v_uid
                     join public.workspaces w on w.id = g.workspace_id
                    where g.quiz_id = q.id and (g.teacher_id is null or g.teacher_id = v_uid)
                 )
               ) as item
          from public.quizzes q
         where q.id in (select private.shared_quiz_ids())
           and q.owner_id <> v_uid
         limit 500
      ) shared
  ), '[]'::jsonb);
end;
$$;

-- What the caller may do with a quiz they can see.
-- { role: owner|edit|copy|view, can_publish, can_archive, owner_name, revision,
--   updated_by_name, updated_at }
create or replace function public.get_quiz_permissions(p_quiz_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
  v_quiz public.quizzes;
  v_access public.quiz_access;
  v_is_owner boolean;
begin
  select * into v_quiz from public.quizzes where id = p_quiz_id;
  if not found then
    raise exception 'Quiz not found.' using errcode = 'P0002';
  end if;
  v_is_owner := v_quiz.owner_id = v_uid;
  if not v_is_owner then
    v_access := private.quiz_access_of(p_quiz_id, v_uid);
    if v_access is null then
      raise exception 'Quiz not found.' using errcode = 'P0002';
    end if;
  end if;

  return jsonb_build_object(
    'role', case when v_is_owner then 'owner' else v_access::text end,
    'can_publish', v_is_owner or (v_access = 'edit' and private.quiz_can_publish(p_quiz_id, v_uid)),
    'can_archive', v_is_owner,
    'owner_name', private.display_name_of(v_quiz.owner_id),
    'revision', v_quiz.revision,
    'updated_by_name', case when v_quiz.updated_by is null then null else private.display_name_of(v_quiz.updated_by) end,
    'updated_at', v_quiz.updated_at
  );
end;
$$;

-- Latest 50 activity entries. Owner and editors only.
-- [{ action, actor_name, is_me, created_at }]
create or replace function public.get_quiz_activity(p_quiz_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
  v_owner uuid;
  v_access public.quiz_access;
begin
  select owner_id into v_owner from public.quizzes where id = p_quiz_id;
  if found and v_owner <> v_uid then
    v_access := private.quiz_access_of(p_quiz_id, v_uid);
  end if;
  if not found or (v_owner <> v_uid and v_access is null) then
    raise exception 'Quiz not found.' using errcode = 'P0002';
  end if;
  if v_owner <> v_uid and v_access <> 'edit' then
    raise exception 'Only the owner and editors can see the activity of this quiz.' using errcode = 'P0001';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'action', a.action,
             'actor_name', case when a.actor_id is null then 'Former teacher' else private.display_name_of(a.actor_id) end,
             'is_me', coalesce(a.actor_id = v_uid, false),
             'created_at', a.created_at
           ) order by a.created_at desc, a.id desc)
      from (
        select * from public.quiz_activity
         where quiz_id = p_quiz_id
         order by created_at desc, id desc
         limit 50
      ) a
  ), '[]'::jsonb);
end;
$$;

-- Copy (or edit) access → an independent draft in the caller's own library.
create or replace function public.copy_shared_quiz(p_quiz_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
  v_quiz public.quizzes;
  v_access public.quiz_access;
  v_new_id uuid;
begin
  select * into v_quiz from public.quizzes where id = p_quiz_id;
  if not found then
    raise exception 'Quiz not found.' using errcode = 'P0002';
  end if;
  if v_quiz.owner_id = v_uid then
    raise exception 'This quiz is already in your library. Use Duplicate instead.' using errcode = 'P0001';
  end if;
  v_access := private.quiz_access_of(p_quiz_id, v_uid);
  if v_access is null then
    raise exception 'Quiz not found.' using errcode = 'P0002';
  end if;
  if v_access < 'copy' then
    raise exception 'You can view this quiz but not copy it. Ask the owner for copy access.' using errcode = 'P0001';
  end if;

  perform private.assert_quiz_quota(v_uid);
  v_new_id := private.copy_quiz(p_quiz_id, v_uid, v_quiz.title);
  update public.quizzes set updated_by = v_uid where id = v_new_id;
  perform private.log_quiz_activity(p_quiz_id, v_uid, 'copied');
  return v_new_id;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Replaced RPC: save_quiz — owners and editors; optimistic revision check.
-- Send "revision" (the value loaded) to be protected against overwriting a
-- newer save. Omitting it skips the check (keeps older clients working).
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.save_quiz(p_quiz jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_quiz_id uuid;
  v_owner uuid;
  v_revision integer;
  v_status public.quiz_status := 'draft';
  v_access public.quiz_access;
  v_questions jsonb := coalesce(p_quiz -> 'questions', '[]'::jsonb);
  v_title text := btrim(coalesce(p_quiz ->> 'title', ''));
  v_description text := btrim(coalesce(p_quiz ->> 'description', ''));
  v_subject text := btrim(coalesce(p_quiz ->> 'subject', ''));
  v_cover text;
  v_speed boolean := coalesce((p_quiz ->> 'speed_scoring')::boolean, true);
  v_question jsonb;
  v_options jsonb;
  v_option jsonb;
  v_q_index integer := 0;
  v_o_index integer;
  v_question_id uuid;
  v_type text;
  v_issues text[];
begin
  if not private.is_teacher() then
    raise exception 'Only signed-in teachers can save quizzes.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_quiz) <> 'object' or jsonb_typeof(v_questions) <> 'array' then
    raise exception 'Invalid quiz data.' using errcode = '22023';
  end if;
  if char_length(v_title) not between 1 and 120 then
    raise exception 'Give your quiz a title (up to 120 characters).' using errcode = 'P0001';
  end if;
  if char_length(v_description) > 1000 then
    raise exception 'The description can be at most 1000 characters.' using errcode = 'P0001';
  end if;
  if char_length(v_subject) > 60 then
    raise exception 'The subject can be at most 60 characters.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(v_questions) > 100 then
    raise exception 'A quiz can have at most 100 questions.' using errcode = 'P0001';
  end if;
  v_cover := private.clean_media_path(p_quiz ->> 'cover_image_path');

  if nullif(p_quiz ->> 'id', '') is not null then
    select id, status, owner_id, revision into v_quiz_id, v_status, v_owner, v_revision
      from public.quizzes
     where id = (p_quiz ->> 'id')::uuid
       for update;
    if found and v_owner <> v_uid then
      v_access := private.quiz_access_of(v_quiz_id, v_uid);
    end if;
    if not found or (v_owner <> v_uid and v_access is null) then
      raise exception 'Quiz not found.' using errcode = 'P0002';
    end if;
    if v_owner <> v_uid and v_access <> 'edit' then
      raise exception 'You can view this quiz but not edit it. Ask the owner for edit access.' using errcode = 'P0001';
    end if;
    if nullif(p_quiz ->> 'revision', '') is not null and (p_quiz ->> 'revision')::integer <> v_revision then
      raise exception 'Someone else saved this quiz while you were editing. Reload it to get their changes, then make your edits again.'
        using errcode = 'P0001', hint = 'quiz_revision_conflict';
    end if;

    update public.quizzes
       set title = v_title,
           description = v_description,
           subject = v_subject,
           cover_image_path = v_cover,
           speed_scoring = v_speed,
           question_count = jsonb_array_length(v_questions),
           revision = revision + 1,
           updated_by = v_uid
     where id = v_quiz_id;

    delete from public.quiz_questions where quiz_id = v_quiz_id;
    perform private.log_quiz_activity(v_quiz_id, v_uid, 'edited');
  else
    perform private.assert_quiz_quota(v_uid);
    insert into public.quizzes (owner_id, title, description, subject, cover_image_path, speed_scoring, question_count, updated_by)
    values (v_uid, v_title, v_description, v_subject, v_cover, v_speed, jsonb_array_length(v_questions), v_uid)
    returning id into v_quiz_id;
  end if;

  for v_question in select value from jsonb_array_elements(v_questions)
  loop
    v_type := v_question ->> 'type';
    if v_type is null or v_type not in ('multiple_choice', 'true_false', 'image_choice') then
      raise exception 'Question %: unknown question type.', v_q_index + 1 using errcode = 'P0001';
    end if;
    if char_length(btrim(coalesce(v_question ->> 'prompt', ''))) > 300 then
      raise exception 'Question %: the question text can be at most 300 characters.', v_q_index + 1 using errcode = 'P0001';
    end if;
    if coalesce((v_question ->> 'time_limit_seconds')::integer, 20) not between 5 and 120 then
      raise exception 'Question %: the time limit must be between 5 and 120 seconds.', v_q_index + 1 using errcode = 'P0001';
    end if;
    if coalesce((v_question ->> 'points')::integer, 1000) not between 0 and 2000 then
      raise exception 'Question %: points must be between 0 and 2000.', v_q_index + 1 using errcode = 'P0001';
    end if;
    if char_length(btrim(coalesce(v_question ->> 'explanation', ''))) > 500 then
      raise exception 'Question %: the explanation can be at most 500 characters.', v_q_index + 1 using errcode = 'P0001';
    end if;

    v_options := coalesce(v_question -> 'options', '[]'::jsonb);
    if jsonb_typeof(v_options) <> 'array' or jsonb_array_length(v_options) > 4 then
      raise exception 'Question %: a question can have at most 4 answers.', v_q_index + 1 using errcode = 'P0001';
    end if;
    if (select count(*) from jsonb_array_elements(v_options) o where coalesce((o ->> 'is_correct')::boolean, false)) > 1 then
      raise exception 'Question %: mark only one correct answer.', v_q_index + 1 using errcode = 'P0001';
    end if;

    insert into public.quiz_questions (quiz_id, position, type, prompt, image_path, time_limit_seconds, points, explanation)
    values (
      v_quiz_id,
      v_q_index,
      v_type::public.question_type,
      btrim(coalesce(v_question ->> 'prompt', '')),
      private.clean_media_path(v_question ->> 'image_path'),
      coalesce((v_question ->> 'time_limit_seconds')::integer, 20),
      coalesce((v_question ->> 'points')::integer, 1000),
      btrim(coalesce(v_question ->> 'explanation', ''))
    )
    returning id into v_question_id;

    v_o_index := 0;
    for v_option in select value from jsonb_array_elements(v_options)
    loop
      if char_length(btrim(coalesce(v_option ->> 'label', ''))) > 120 then
        raise exception 'Question %: answers can be at most 120 characters.', v_q_index + 1 using errcode = 'P0001';
      end if;
      insert into public.question_options (question_id, position, label, image_path, is_correct)
      values (
        v_question_id,
        v_o_index,
        btrim(coalesce(v_option ->> 'label', '')),
        private.clean_media_path(v_option ->> 'image_path'),
        coalesce((v_option ->> 'is_correct')::boolean, false)
      );
      v_o_index := v_o_index + 1;
    end loop;

    v_q_index := v_q_index + 1;
  end loop;

  if v_status = 'published' then
    v_issues := private.quiz_issues(v_quiz_id);
    if cardinality(v_issues) > 0 then
      raise exception 'This quiz is published, so every question must be complete. %', v_issues[1]
        using errcode = 'P0001', hint = 'Fix the question or unpublish the quiz first.';
    end if;
  end if;

  return v_quiz_id;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Replaced RPC: set_quiz_status — the owner can do anything; an editor the
-- owner allowed to publish can publish and unpublish (not archive/restore).
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.set_quiz_status(p_quiz_id uuid, p_status public.quiz_status)
returns public.quiz_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_current public.quiz_status;
  v_owner uuid;
  v_access public.quiz_access;
  v_issues text[];
begin
  if not private.is_teacher() then
    raise exception 'Only signed-in teachers can change quizzes.' using errcode = '42501';
  end if;

  select status, owner_id into v_current, v_owner
    from public.quizzes
   where id = p_quiz_id
     for update;
  if found and v_owner <> v_uid then
    v_access := private.quiz_access_of(p_quiz_id, v_uid);
  end if;
  if not found or (v_owner <> v_uid and v_access is null) then
    raise exception 'Quiz not found.' using errcode = 'P0002';
  end if;

  if v_owner <> v_uid then
    if v_access <> 'edit' or not private.quiz_can_publish(p_quiz_id, v_uid) then
      raise exception 'Only the owner, or an editor the owner allows to publish, can change this quiz''s status.'
        using errcode = 'P0001';
    end if;
    if p_status = 'archived' or v_current = 'archived' then
      raise exception 'Only the owner can archive or restore this quiz.' using errcode = 'P0001';
    end if;
  end if;

  if p_status = 'published' then
    v_issues := private.quiz_issues(p_quiz_id);
    if cardinality(v_issues) > 0 then
      raise exception 'This quiz cannot be published yet. %', v_issues[1] using errcode = 'P0001';
    end if;
  end if;

  update public.quizzes
     set status = p_status,
         updated_by = v_uid,
         published_at = case
           when p_status = 'published' and v_current <> 'published' then now()
           when p_status = 'published' then published_at
           else null
         end
   where id = p_quiz_id;

  if p_status <> v_current then
    perform private.log_quiz_activity(
      p_quiz_id,
      v_uid,
      case
        when p_status = 'published' then 'published'
        when p_status = 'archived' then 'archived'
        when v_current = 'archived' then 'restored'
        else 'unpublished'
      end::public.quiz_activity_action
    );
  end if;

  return p_status;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Privileges for the new RPCs (save_quiz / set_quiz_status keep their grants)
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.create_workspace(text) from public, anon;
revoke all on function public.rename_workspace(uuid, text) from public, anon;
revoke all on function public.delete_workspace(uuid) from public, anon;
revoke all on function public.leave_workspace(uuid) from public, anon;
revoke all on function public.remove_workspace_member(uuid, uuid) from public, anon;
revoke all on function public.list_my_workspaces() from public, anon;
revoke all on function public.get_workspace(uuid) from public, anon;
revoke all on function public.create_workspace_invite(uuid) from public, anon;
revoke all on function public.revoke_workspace_invite(uuid) from public, anon;
revoke all on function public.preview_workspace_invite(text) from public, anon;
revoke all on function public.accept_workspace_invite(text) from public, anon;
revoke all on function public.get_quiz_sharing(uuid) from public, anon;
revoke all on function public.set_quiz_sharing(uuid, uuid, jsonb) from public, anon;
revoke all on function public.list_shared_with_me() from public, anon;
revoke all on function public.get_quiz_permissions(uuid) from public, anon;
revoke all on function public.get_quiz_activity(uuid) from public, anon;
revoke all on function public.copy_shared_quiz(uuid) from public, anon;

grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.rename_workspace(uuid, text) to authenticated;
grant execute on function public.delete_workspace(uuid) to authenticated;
grant execute on function public.leave_workspace(uuid) to authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.list_my_workspaces() to authenticated;
grant execute on function public.get_workspace(uuid) to authenticated;
grant execute on function public.create_workspace_invite(uuid) to authenticated;
grant execute on function public.revoke_workspace_invite(uuid) to authenticated;
grant execute on function public.preview_workspace_invite(text) to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;
grant execute on function public.get_quiz_sharing(uuid) to authenticated;
grant execute on function public.set_quiz_sharing(uuid, uuid, jsonb) to authenticated;
grant execute on function public.list_shared_with_me() to authenticated;
grant execute on function public.get_quiz_permissions(uuid) to authenticated;
grant execute on function public.get_quiz_activity(uuid) to authenticated;
grant execute on function public.copy_shared_quiz(uuid) to authenticated;
