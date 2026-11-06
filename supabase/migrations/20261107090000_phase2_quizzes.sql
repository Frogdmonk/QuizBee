-- ═════════════════════════════════════════════════════════════════════════════
-- Phase 2a — Quizzes
--   * quizzes, quiz_questions, question_options (teacher-owned, RLS)
--   * quiz-media storage bucket (owner-folder writes, public CDN reads)
--   * RPCs: save_quiz, set_quiz_status, duplicate_quiz
--
-- Clients may SELECT their own quizzes and DELETE them. Every other write goes
-- through the RPCs below so validation and question_count stay consistent.
-- ═════════════════════════════════════════════════════════════════════════════

create type public.quiz_status as enum ('draft', 'published', 'archived');
create type public.question_type as enum ('multiple_choice', 'true_false', 'image_choice');

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.teacher_profiles (id) on delete cascade,
  title text not null,
  description text not null default '',
  subject text not null default '',
  cover_image_path text,
  speed_scoring boolean not null default true,
  status public.quiz_status not null default 'draft',
  source_quiz_id uuid references public.quizzes (id) on delete set null,
  question_count integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quizzes_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint quizzes_description_length check (char_length(description) <= 1000),
  constraint quizzes_subject_length check (char_length(subject) <= 60),
  constraint quizzes_question_count_range check (question_count between 0 and 100)
);

create index quizzes_owner_updated_idx on public.quizzes (owner_id, updated_at desc);
create index quizzes_source_quiz_idx on public.quizzes (source_quiz_id) where source_quiz_id is not null;

create trigger quizzes_set_updated_at
  before update on public.quizzes
  for each row execute function private.set_updated_at();

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  position integer not null,
  type public.question_type not null,
  prompt text not null default '',
  image_path text,
  time_limit_seconds integer not null default 20,
  points integer not null default 1000,
  explanation text not null default '',
  created_at timestamptz not null default now(),
  constraint quiz_questions_position_range check (position between 0 and 99),
  constraint quiz_questions_prompt_length check (char_length(prompt) <= 300),
  constraint quiz_questions_time_limit_range check (time_limit_seconds between 5 and 120),
  constraint quiz_questions_points_range check (points between 0 and 2000),
  constraint quiz_questions_explanation_length check (char_length(explanation) <= 500),
  constraint quiz_questions_quiz_position_key unique (quiz_id, position) deferrable initially deferred
);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  position smallint not null,
  label text not null default '',
  image_path text,
  is_correct boolean not null default false,
  constraint question_options_position_range check (position between 0 and 3),
  constraint question_options_label_length check (char_length(label) <= 120),
  constraint question_options_question_position_key unique (question_id, position) deferrable initially deferred
);

-- Exactly one correct answer per question is enforced at publish time; at most one always.
create unique index question_options_one_correct_idx on public.question_options (question_id) where is_correct;

comment on table public.question_options is
  'Answer options including is_correct. Teacher-only: never exposed to students. Live games snapshot into session tables.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Row level security
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.question_options enable row level security;

grant select, delete on table public.quizzes to authenticated;
grant select on table public.quiz_questions to authenticated;
grant select on table public.question_options to authenticated;

create policy "Owners can read their quizzes"
  on public.quizzes for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "Owners can delete their quizzes"
  on public.quizzes for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "Owners can read their questions"
  on public.quiz_questions for select to authenticated
  using (exists (
    select 1 from public.quizzes q
     where q.id = quiz_questions.quiz_id
       and q.owner_id = (select auth.uid())
  ));

create policy "Owners can read their answer options"
  on public.question_options for select to authenticated
  using (exists (
    select 1
      from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
     where qq.id = question_options.question_id
       and q.owner_id = (select auth.uid())
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────────

-- Validates a storage object path inside the quiz-media bucket:
-- "<owner uuid>/<random name>.<ext>". Returns null for empty input.
create or replace function private.clean_media_path(p_path text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_path is null or btrim(p_path) = '' then
    return null;
  end if;
  if p_path !~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(webp|jpg|jpeg|png|gif)$' then
    raise exception 'Invalid image reference.' using errcode = '22023';
  end if;
  return p_path;
end;
$$;

-- Human-readable problems that block publishing. Empty array = ready to publish.
-- Mirrored on the client in src/lib/quiz-rules.ts.
create or replace function private.quiz_issues(p_quiz_id uuid)
returns text[]
language sql
stable
set search_path = ''
as $$
  with qs as (
    select q.id, q.position, q.type, q.prompt,
           (select count(*) from public.question_options o where o.question_id = q.id) as option_count,
           (select count(*) from public.question_options o where o.question_id = q.id and o.is_correct) as correct_count,
           exists (select 1 from public.question_options o where o.question_id = q.id and btrim(o.label) = '') as has_blank_label,
           exists (select 1 from public.question_options o where o.question_id = q.id and o.image_path is null) as has_missing_image
      from public.quiz_questions q
     where q.quiz_id = p_quiz_id
  ),
  issues as (
    select -1 as pos, 0 as ord, 'Add at least one question.' as msg
     where not exists (select 1 from qs)
    union all
    select qs.position, i.ord, format('Question %s: %s', qs.position + 1, i.msg)
      from qs
     cross join lateral (
       select 1 as ord, 'write the question text.' as msg where btrim(qs.prompt) = ''
       union all
       select 2, 'true/false questions need exactly 2 answers.' where qs.type = 'true_false' and qs.option_count <> 2
       union all
       select 3, 'add between 2 and 4 answers.' where qs.type <> 'true_false' and qs.option_count not between 2 and 4
       union all
       select 4, 'fill in every answer.' where qs.type <> 'image_choice' and qs.has_blank_label
       union all
       select 5, 'add an image to every answer.' where qs.type = 'image_choice' and qs.has_missing_image
       union all
       select 6, 'mark the correct answer.' where qs.correct_count <> 1
     ) i
  )
  select coalesce(array_agg(msg order by pos, ord), '{}'::text[]) from issues;
$$;

-- Copies a quiz (questions + options) to a new owner. Used by duplicate and,
-- later, by share-link imports. Caller is responsible for authorisation.
create or replace function private.copy_quiz(
  p_source_id uuid,
  p_new_owner uuid,
  p_title text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_id uuid;
  v_question record;
  v_new_question_id uuid;
begin
  insert into public.quizzes (owner_id, title, description, subject, cover_image_path, speed_scoring,
                              status, source_quiz_id, question_count)
  select p_new_owner, left(btrim(p_title), 120), description, subject, cover_image_path, speed_scoring,
         'draft', id, question_count
    from public.quizzes
   where id = p_source_id
  returning id into v_new_id;

  for v_question in
    select * from public.quiz_questions where quiz_id = p_source_id order by position
  loop
    insert into public.quiz_questions (quiz_id, position, type, prompt, image_path, time_limit_seconds, points, explanation)
    values (v_new_id, v_question.position, v_question.type, v_question.prompt, v_question.image_path,
            v_question.time_limit_seconds, v_question.points, v_question.explanation)
    returning id into v_new_question_id;

    insert into public.question_options (question_id, position, label, image_path, is_correct)
    select v_new_question_id, position, label, image_path, is_correct
      from public.question_options
     where question_id = v_question.id;
  end loop;

  return v_new_id;
end;
$$;

-- Keeps one teacher from exhausting the free database tier.
create or replace function private.assert_quiz_quota(p_owner uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if (select count(*) from public.quizzes where owner_id = p_owner) >= 500 then
    raise exception 'You have reached the limit of 500 quizzes. Delete some old quizzes first.' using errcode = 'P0001';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: save_quiz(p_quiz jsonb) → quiz id
-- Creates (id null/absent) or fully replaces a quiz in one transaction.
-- Drafts may be incomplete; a published quiz must stay publishable.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.save_quiz(p_quiz jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_quiz_id uuid;
  v_status public.quiz_status := 'draft';
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
    select id, status into v_quiz_id, v_status
      from public.quizzes
     where id = (p_quiz ->> 'id')::uuid
       and owner_id = v_uid
       for update;
    if not found then
      raise exception 'Quiz not found.' using errcode = 'P0002';
    end if;

    update public.quizzes
       set title = v_title,
           description = v_description,
           subject = v_subject,
           cover_image_path = v_cover,
           speed_scoring = v_speed,
           question_count = jsonb_array_length(v_questions)
     where id = v_quiz_id;

    delete from public.quiz_questions where quiz_id = v_quiz_id;
  else
    perform private.assert_quiz_quota(v_uid);
    insert into public.quizzes (owner_id, title, description, subject, cover_image_path, speed_scoring, question_count)
    values (v_uid, v_title, v_description, v_subject, v_cover, v_speed, jsonb_array_length(v_questions))
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

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: set_quiz_status(quiz, status) — publish requires a complete quiz.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_quiz_status(p_quiz_id uuid, p_status public.quiz_status)
returns public.quiz_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.quiz_status;
  v_issues text[];
begin
  if not private.is_teacher() then
    raise exception 'Only signed-in teachers can change quizzes.' using errcode = '42501';
  end if;

  select status into v_current
    from public.quizzes
   where id = p_quiz_id and owner_id = (select auth.uid())
     for update;
  if not found then
    raise exception 'Quiz not found.' using errcode = 'P0002';
  end if;

  if p_status = 'published' then
    v_issues := private.quiz_issues(p_quiz_id);
    if cardinality(v_issues) > 0 then
      raise exception 'This quiz cannot be published yet. %', v_issues[1] using errcode = 'P0001';
    end if;
  end if;

  update public.quizzes
     set status = p_status,
         published_at = case
           when p_status = 'published' and v_current <> 'published' then now()
           when p_status = 'published' then published_at
           else null
         end
   where id = p_quiz_id;

  return p_status;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: duplicate_quiz(quiz) → new quiz id (draft "Copy of …")
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.duplicate_quiz(p_quiz_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_title text;
begin
  if not private.is_teacher() then
    raise exception 'Only signed-in teachers can duplicate quizzes.' using errcode = '42501';
  end if;
  select title into v_title from public.quizzes where id = p_quiz_id and owner_id = v_uid;
  if not found then
    raise exception 'Quiz not found.' using errcode = 'P0002';
  end if;
  perform private.assert_quiz_quota(v_uid);
  return private.copy_quiz(p_quiz_id, v_uid, 'Copy of ' || v_title);
end;
$$;

revoke all on function public.save_quiz(jsonb) from public, anon;
revoke all on function public.set_quiz_status(uuid, public.quiz_status) from public, anon;
revoke all on function public.duplicate_quiz(uuid) from public, anon;
grant execute on function public.save_quiz(jsonb) to authenticated;
grant execute on function public.set_quiz_status(uuid, public.quiz_status) to authenticated;
grant execute on function public.duplicate_quiz(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage: quiz-media bucket
-- Public reads (served by the Storage CDN; object names are random UUIDs).
-- Writes only by teachers, only inside their own "<user id>/" folder.
-- Images are compressed to WebP in the browser before upload.
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quiz-media', 'quiz-media', true, 2097152, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Teachers upload quiz media to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'quiz-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_teacher())
  );

create policy "Teachers manage their own quiz media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'quiz-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
