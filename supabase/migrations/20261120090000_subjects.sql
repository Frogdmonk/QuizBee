-- ═════════════════════════════════════════════════════════════════════════════
-- Subjects: a teacher's folders of quizzes, shareable as a whole.
--
--   * subjects: owned by one teacher; a quiz is in at most one subject
--     (quizzes.subject_id). Deleting a subject keeps its quizzes (unfiled).
--   * subject_grants: like quiz_grants, but for a subject. They apply to every
--     quiz in the subject, including quizzes added later; taking a quiz out of
--     the subject takes that access away.
--   * Access is still decided in one place: shared_quiz_ids, quiz_access_of and
--     quiz_can_publish now also count the grants of the quiz's subject, so every
--     policy and RPC that already uses them (reading, copying, editing,
--     publishing, Shared with Me) respects subject sharing unchanged.
--   * quizzes.subject (free text, "Science · Grade 6") is unrelated and stays.
-- ═════════════════════════════════════════════════════════════════════════════

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.teacher_profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index subjects_owner_name_key on public.subjects (owner_id, lower(btrim(name)));

alter table public.quizzes add column subject_id uuid references public.subjects (id) on delete set null;
create index quizzes_subject_idx on public.quizzes (subject_id) where subject_id is not null;

create table public.subject_grants (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- null = everyone in the workspace; otherwise one chosen member.
  teacher_id uuid references public.teacher_profiles (id) on delete cascade,
  access public.quiz_access not null default 'view',
  can_publish boolean not null default false,
  granted_by uuid references public.teacher_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint subject_grants_publish_needs_edit check (not can_publish or access = 'edit')
);
create unique index subject_grants_everyone_key on public.subject_grants (subject_id, workspace_id) where teacher_id is null;
create unique index subject_grants_member_key on public.subject_grants (subject_id, workspace_id, teacher_id) where teacher_id is not null;
create index subject_grants_workspace_idx on public.subject_grants (workspace_id);

-- Everything goes through the RPCs below; owners may read their own subjects directly.
alter table public.subjects enable row level security;
alter table public.subject_grants enable row level security;
create policy "Owners can read their subjects" on public.subjects for select to authenticated using (owner_id = (select auth.uid()));

-- When someone leaves (or is removed from) a workspace, their own subject grants there go too.
create or replace function private.cleanup_subject_member_grants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.subject_grants where workspace_id = old.workspace_id and teacher_id = old.teacher_id;
  return old;
end;
$$;
create trigger workspace_members_cleanup_subject_grants
  after delete on public.workspace_members
  for each row execute function private.cleanup_subject_member_grants();

-- ─────────────────────────────────────────────────────────────────────────────
-- Access: a quiz is shared through its own grants or its subject's.
-- ─────────────────────────────────────────────────────────────────────────────

-- Subjects shared with the caller through a workspace they belong to.
create or replace function private.shared_subject_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct g.subject_id
    from public.subject_grants g
    join public.workspace_members m
      on m.workspace_id = g.workspace_id
     and m.teacher_id = (select auth.uid())
   where (g.teacher_id is null or g.teacher_id = (select auth.uid()))
     and not private.is_anonymous_session();
$$;
grant execute on function private.shared_subject_ids() to authenticated, service_role;

create or replace function private.shared_quiz_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.quiz_id
    from public.quiz_grants g
    join public.workspace_members m
      on m.workspace_id = g.workspace_id
     and m.teacher_id = (select auth.uid())
   where (g.teacher_id is null or g.teacher_id = (select auth.uid()))
     and not private.is_anonymous_session()
  union
  select q.id
    from public.quizzes q
   where q.subject_id in (select private.shared_subject_ids());
$$;

-- All grants that reach a teacher for a quiz: its own and its subject's.
create or replace function private.quiz_access_of(p_quiz_id uuid, p_teacher uuid)
returns public.quiz_access
language sql
stable
security definer
set search_path = ''
as $$
  select max(access) from (
    select g.access
      from public.quiz_grants g
      join public.workspace_members m on m.workspace_id = g.workspace_id and m.teacher_id = p_teacher
     where g.quiz_id = p_quiz_id
       and (g.teacher_id is null or g.teacher_id = p_teacher)
    union all
    select g.access
      from public.quizzes q
      join public.subject_grants g on g.subject_id = q.subject_id
      join public.workspace_members m on m.workspace_id = g.workspace_id and m.teacher_id = p_teacher
     where q.id = p_quiz_id
       and (g.teacher_id is null or g.teacher_id = p_teacher)
  ) a;
$$;

create or replace function private.quiz_can_publish(p_quiz_id uuid, p_teacher uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(bool_or(can_publish), false) from (
    select g.can_publish
      from public.quiz_grants g
      join public.workspace_members m on m.workspace_id = g.workspace_id and m.teacher_id = p_teacher
     where g.quiz_id = p_quiz_id and g.access = 'edit'
       and (g.teacher_id is null or g.teacher_id = p_teacher)
    union all
    select g.can_publish
      from public.quizzes q
      join public.subject_grants g on g.subject_id = q.subject_id
      join public.workspace_members m on m.workspace_id = g.workspace_id and m.teacher_id = p_teacher
     where q.id = p_quiz_id and g.access = 'edit'
       and (g.teacher_id is null or g.teacher_id = p_teacher)
  ) p;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Owner RPCs
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.clean_subject_name(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if char_length(v) not between 1 and 60 then
    raise exception 'Give the subject a name (up to 60 characters).' using errcode = 'P0001';
  end if;
  return v;
end;
$$;

create or replace function private.owned_subject(p_subject_id uuid, p_uid uuid)
returns public.subjects
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.subjects;
begin
  select * into s from public.subjects where id = p_subject_id and owner_id = p_uid;
  if not found then
    raise exception 'Subject not found.' using errcode = 'P0002';
  end if;
  return s;
end;
$$;

-- The caller's subjects with their quiz counts and whether they are shared.
create or replace function public.list_my_subjects()
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
             'id', s.id,
             'name', s.name,
             'quiz_count', (select count(*) from public.quizzes q where q.subject_id = s.id),
             'shared', exists (select 1 from public.subject_grants g where g.subject_id = s.id),
             'updated_at', s.updated_at
           ) order by lower(s.name))
      from public.subjects s
     where s.owner_id = v_uid
  ), '[]'::jsonb);
end;
$$;

create or replace function public.create_subject(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
  v_id uuid;
begin
  if (select count(*) from public.subjects where owner_id = v_uid) >= 200 then
    raise exception 'You can have at most 200 subjects.' using errcode = 'P0001';
  end if;
  begin
    insert into public.subjects (owner_id, name) values (v_uid, private.clean_subject_name(p_name)) returning id into v_id;
  exception when unique_violation then
    raise exception 'You already have a subject with that name.' using errcode = 'P0001';
  end;
  return v_id;
end;
$$;

create or replace function public.rename_subject(p_subject_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
begin
  perform private.owned_subject(p_subject_id, v_uid);
  begin
    update public.subjects set name = private.clean_subject_name(p_name), updated_at = now() where id = p_subject_id;
  exception when unique_violation then
    raise exception 'You already have a subject with that name.' using errcode = 'P0001';
  end;
end;
$$;

-- Deleting a subject keeps its quizzes (they become unfiled) and ends its sharing.
create or replace function public.delete_subject(p_subject_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
begin
  perform private.owned_subject(p_subject_id, v_uid);
  delete from public.subjects where id = p_subject_id;
end;
$$;

-- Puts the caller's quizzes in a subject (or takes them out with null). Returns how many moved.
create or replace function public.set_quizzes_subject(p_quiz_ids uuid[], p_subject_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
  v_count integer;
begin
  if p_quiz_ids is null or cardinality(p_quiz_ids) = 0 then
    return 0;
  end if;
  if cardinality(p_quiz_ids) > 500 then
    raise exception 'Choose at most 500 quizzes at a time.' using errcode = 'P0001';
  end if;
  if p_subject_id is not null then
    perform private.owned_subject(p_subject_id, v_uid);
  end if;
  if exists (select 1 from unnest(p_quiz_ids) as u(qid) where not exists (select 1 from public.quizzes q where q.id = u.qid and q.owner_id = v_uid)) then
    raise exception 'You can only file your own quizzes.' using errcode = 'P0001';
  end if;
  update public.quizzes set subject_id = p_subject_id where id = any (p_quiz_ids) and subject_id is distinct from p_subject_id;
  get diagnostics v_count = row_count;
  if p_subject_id is not null then
    update public.subjects set updated_at = now() where id = p_subject_id;
  end if;
  return v_count;
end;
$$;

-- Owner only: the subject's sharing in every workspace the owner belongs to (same shape as get_quiz_sharing).
create or replace function public.get_subject_sharing(p_subject_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
begin
  perform private.owned_subject(p_subject_id, v_uid);
  return jsonb_build_object(
    'subject_id', p_subject_id,
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
                   from public.subject_grants g
                  where g.subject_id = p_subject_id and g.workspace_id = w.id and g.teacher_id is null
               ),
               'grants', coalesce((
                 select jsonb_agg(jsonb_build_object('teacher_id', g.teacher_id, 'access', g.access, 'can_publish', g.can_publish))
                   from public.subject_grants g
                  where g.subject_id = p_subject_id and g.workspace_id = w.id and g.teacher_id is not null
               ), '[]'::jsonb)
             ) order by lower(w.name), w.id)
        from public.workspace_members m
        join public.workspaces w on w.id = m.workspace_id
       where m.teacher_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

-- Owner only. Atomically replaces the subject's grants in one workspace (same settings as set_quiz_sharing).
create or replace function public.set_subject_sharing(p_subject_id uuid, p_workspace_id uuid, p_settings jsonb)
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
  perform 1 from public.subjects where id = p_subject_id and owner_id = v_uid for update;
  if not found then
    raise exception 'Subject not found.' using errcode = 'P0002';
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

  delete from public.subject_grants where subject_id = p_subject_id and workspace_id = p_workspace_id;

  if v_everyone is not null and jsonb_typeof(v_everyone) = 'object' then
    v_access := v_everyone ->> 'access';
    if v_access is null or v_access not in ('view', 'copy', 'edit') then
      raise exception 'Choose view, copy or edit access.' using errcode = 'P0001';
    end if;
    insert into public.subject_grants (subject_id, workspace_id, teacher_id, access, can_publish, granted_by)
    values (p_subject_id, p_workspace_id, null, v_access::public.quiz_access,
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
       or not exists (select 1 from public.workspace_members where workspace_id = p_workspace_id and teacher_id = v_teacher) then
      raise exception 'You can only share with members of this workspace.' using errcode = 'P0001';
    end if;
    if v_teacher = any (v_seen) then
      raise exception 'Each member can only be listed once.' using errcode = 'P0001';
    end if;
    v_seen := v_seen || v_teacher;
    insert into public.subject_grants (subject_id, workspace_id, teacher_id, access, can_publish, granted_by)
    values (p_subject_id, p_workspace_id, v_teacher, v_access::public.quiz_access,
            v_access = 'edit' and coalesce((v_member ->> 'can_publish')::boolean, false), v_uid);
  end loop;
end;
$$;

-- Quizzes other teachers share with the caller, now with the shared subject each belongs to
-- (when that subject is shared with the caller), so Shared with Me can group them.
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
                 'shared_subject', case when q.subject_id in (select private.shared_subject_ids())
                   then (select jsonb_build_object('id', s.id, 'name', s.name) from public.subjects s where s.id = q.subject_id) end,
                 'workspaces', (
                   select coalesce(jsonb_agg(distinct w.name), '[]'::jsonb)
                     from public.workspaces w
                     join public.workspace_members m on m.workspace_id = w.id and m.teacher_id = v_uid
                    where w.id in (
                      select g.workspace_id from public.quiz_grants g
                       where g.quiz_id = q.id and (g.teacher_id is null or g.teacher_id = v_uid)
                      union
                      select g.workspace_id from public.subject_grants g
                       where g.subject_id = q.subject_id and (g.teacher_id is null or g.teacher_id = v_uid)
                    )
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

revoke all on function private.clean_subject_name(text) from public;
revoke all on function private.owned_subject(uuid, uuid) from public;
revoke all on function public.list_my_subjects() from public, anon;
revoke all on function public.create_subject(text) from public, anon;
revoke all on function public.rename_subject(uuid, text) from public, anon;
revoke all on function public.delete_subject(uuid) from public, anon;
revoke all on function public.set_quizzes_subject(uuid[], uuid) from public, anon;
revoke all on function public.get_subject_sharing(uuid) from public, anon;
revoke all on function public.set_subject_sharing(uuid, uuid, jsonb) from public, anon;
grant execute on function public.list_my_subjects() to authenticated;
grant execute on function public.create_subject(text) to authenticated;
grant execute on function public.rename_subject(uuid, text) to authenticated;
grant execute on function public.delete_subject(uuid) to authenticated;
grant execute on function public.set_quizzes_subject(uuid[], uuid) to authenticated;
grant execute on function public.get_subject_sharing(uuid) to authenticated;
grant execute on function public.set_subject_sharing(uuid, uuid, jsonb) to authenticated;
