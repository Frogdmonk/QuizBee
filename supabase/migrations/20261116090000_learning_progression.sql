-- ═════════════════════════════════════════════════════════════════════════════
-- Learning progression (boss battle plan, phase 4).
--
-- Authoring (quiz editor):
--   * Each question can carry a level (1–3, 4 = final challenge), a learning
--     objective, a topic, a difficulty and a kind (recall, concept, application,
--     predict output, find the bug, multi-step: the editor suggests a timer per
--     kind; the teacher's time limit always wins).
--   * Each wrong answer can carry a misconception note ("why someone picks this").
--   * Each question can have one parallel recovery question (same objective,
--     different wording), stored as validated JSON on the question.
--
-- In the game:
--   * Mastery gate: after a core question whose class accuracy (correct among
--     the eligible snapshot) is below mastery_pct (75), "next" plays its
--     recovery question instead of moving on, if one was written and the
--     teacher has not skipped it. The recovery question opens after a review
--     (review_ms, 8 s): the most-picked wrong answer, its misconception note and
--     the explanation. Nobody is named. A recovery question is played once.
--   * Recovery questions are session_questions with role 'recovery' at position
--     1000 + their core question's position; they score and fight like any other.
--   * A new level gets a 3 s announcement; the final challenge names the
--     objectives the class has struggled with so far. The podium payload has a
--     learning report per objective.
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.quiz_questions
  add column level smallint check (level between 1 and 4),
  add column objective text not null default '' check (char_length(objective) <= 120),
  add column topic text not null default '' check (char_length(topic) <= 60),
  add column difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  add column kind text check (kind in ('recall', 'concept', 'application', 'predict', 'bug', 'multistep')),
  add column recovery jsonb;

alter table public.question_options
  add column misconception text not null default '' check (char_length(misconception) <= 200);

alter table public.session_questions
  add column role text not null default 'core' check (role in ('core', 'recovery')),
  add column core_position integer,
  add column level smallint,
  add column objective text not null default '',
  add column topic text not null default '',
  add column kind text,
  add column difficulty text,
  add column level_start boolean not null default false,
  add column recovery_skipped boolean not null default false;

alter table public.session_question_options
  add column misconception text not null default '';

alter table public.game_sessions
  add column mastery_enabled boolean not null default true,
  add column mastery_pct integer not null default 75 check (mastery_pct between 50 and 100),
  add column review_ms integer not null default 8000 check (review_ms between 3000 and 20000);

-- ─────────────────────────────────────────────────────────────────────────────
-- Authoring helpers.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.clean_text_field(p_value text, p_max integer, p_message text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if char_length(btrim(coalesce(p_value, ''))) > p_max then
    raise exception '%', p_message using errcode = 'P0001';
  end if;
  return btrim(coalesce(p_value, ''));
end;
$$;

-- A recovery question as stored: { prompt, explanation, time_limit_seconds, options: [{ label, is_correct, misconception }] }.
-- Text answers only (2–4). Incomplete content is allowed in drafts; private.quiz_issues blocks publishing it.
create or replace function private.clean_recovery(p_value jsonb, p_index integer)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_options jsonb;
  v_clean jsonb := '[]'::jsonb;
  v_option jsonb;
  v_time integer;
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p_value) <> 'object' then
    raise exception 'Question %: invalid recovery question.', p_index using errcode = 'P0001';
  end if;
  v_options := coalesce(p_value -> 'options', '[]'::jsonb);
  if jsonb_typeof(v_options) <> 'array' or jsonb_array_length(v_options) > 4 then
    raise exception 'Question %: a recovery question can have at most 4 answers.', p_index using errcode = 'P0001';
  end if;
  if (select count(*) from jsonb_array_elements(v_options) o where coalesce((o ->> 'is_correct')::boolean, false)) > 1 then
    raise exception 'Question %: mark only one correct answer in the recovery question.', p_index using errcode = 'P0001';
  end if;
  v_time := coalesce((p_value ->> 'time_limit_seconds')::integer, 20);
  if v_time not between 5 and 120 then
    raise exception 'Question %: the recovery question''s time limit must be between 5 and 120 seconds.', p_index using errcode = 'P0001';
  end if;
  for v_option in select value from jsonb_array_elements(v_options) loop
    v_clean := v_clean || jsonb_build_array(jsonb_build_object(
      'label', private.clean_text_field(v_option ->> 'label', 120, format('Question %s: recovery answers can be at most 120 characters.', p_index)),
      'is_correct', coalesce((v_option ->> 'is_correct')::boolean, false),
      'misconception', private.clean_text_field(v_option ->> 'misconception', 200, format('Question %s: misconception notes can be at most 200 characters.', p_index))
    ));
  end loop;
  return jsonb_build_object(
    'prompt', private.clean_text_field(p_value ->> 'prompt', 300, format('Question %s: the recovery question can be at most 300 characters.', p_index)),
    'explanation', private.clean_text_field(p_value ->> 'explanation', 500, format('Question %s: the recovery explanation can be at most 500 characters.', p_index)),
    'time_limit_seconds', v_time,
    'options', v_clean
  );
end;
$$;

-- Publishing checks: as before, plus complete recovery questions.
create or replace function private.quiz_issues(p_quiz_id uuid)
returns text[]
language sql
stable
set search_path = ''
as $$
  with qs as (
    select q.id, q.position, q.type, q.prompt, q.recovery,
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
       union all
       select 7, 'write the recovery question text.' where qs.recovery is not null and btrim(qs.recovery ->> 'prompt') = ''
       union all
       select 8, 'give the recovery question 2 to 4 answers.' where qs.recovery is not null and jsonb_array_length(qs.recovery -> 'options') not between 2 and 4
       union all
       select 9, 'fill in every recovery answer.' where qs.recovery is not null
         and exists (select 1 from jsonb_array_elements(qs.recovery -> 'options') o where btrim(o ->> 'label') = '')
       union all
       select 10, 'mark the recovery question''s correct answer.' where qs.recovery is not null
         and (select count(*) from jsonb_array_elements(qs.recovery -> 'options') o where (o ->> 'is_correct')::boolean) <> 1
     ) i
  )
  select coalesce(array_agg(msg order by pos, ord), '{}'::text[]) from issues;
$$;

-- Copies a quiz with its learning data.
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
    insert into public.quiz_questions (quiz_id, position, type, prompt, image_path, time_limit_seconds, points, explanation,
                                       level, objective, topic, difficulty, kind, recovery)
    values (v_new_id, v_question.position, v_question.type, v_question.prompt, v_question.image_path,
            v_question.time_limit_seconds, v_question.points, v_question.explanation,
            v_question.level, v_question.objective, v_question.topic, v_question.difficulty, v_question.kind, v_question.recovery)
    returning id into v_new_question_id;

    insert into public.question_options (question_id, position, label, image_path, is_correct, misconception)
    select v_new_question_id, position, label, image_path, is_correct, misconception
      from public.question_options
     where question_id = v_question.id;
  end loop;

  return v_new_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- save_quiz: as in the workspaces migration, plus the learning fields.
-- Question keys (all optional): level 1–4 | null, objective ≤ 120, topic ≤ 60,
-- difficulty easy|medium|hard|null, kind recall|concept|application|predict|bug|multistep|null,
-- recovery { prompt, explanation, time_limit_seconds, options[{label,is_correct,misconception}] } | null.
-- Option key: misconception ≤ 200.
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
  v_level integer;
  v_difficulty text;
  v_kind text;
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
    v_level := nullif(v_question ->> 'level', '')::integer;
    if v_level is not null and v_level not between 1 and 4 then
      raise exception 'Question %: choose level 1, 2, 3 or the final challenge.', v_q_index + 1 using errcode = 'P0001';
    end if;
    v_difficulty := nullif(v_question ->> 'difficulty', '');
    if v_difficulty is not null and v_difficulty not in ('easy', 'medium', 'hard') then
      raise exception 'Question %: choose easy, medium or hard.', v_q_index + 1 using errcode = 'P0001';
    end if;
    v_kind := nullif(v_question ->> 'kind', '');
    if v_kind is not null and v_kind not in ('recall', 'concept', 'application', 'predict', 'bug', 'multistep') then
      raise exception 'Question %: unknown question kind.', v_q_index + 1 using errcode = 'P0001';
    end if;

    v_options := coalesce(v_question -> 'options', '[]'::jsonb);
    if jsonb_typeof(v_options) <> 'array' or jsonb_array_length(v_options) > 4 then
      raise exception 'Question %: a question can have at most 4 answers.', v_q_index + 1 using errcode = 'P0001';
    end if;
    if (select count(*) from jsonb_array_elements(v_options) o where coalesce((o ->> 'is_correct')::boolean, false)) > 1 then
      raise exception 'Question %: mark only one correct answer.', v_q_index + 1 using errcode = 'P0001';
    end if;

    insert into public.quiz_questions (quiz_id, position, type, prompt, image_path, time_limit_seconds, points, explanation,
                                       level, objective, topic, difficulty, kind, recovery)
    values (
      v_quiz_id,
      v_q_index,
      v_type::public.question_type,
      btrim(coalesce(v_question ->> 'prompt', '')),
      private.clean_media_path(v_question ->> 'image_path'),
      coalesce((v_question ->> 'time_limit_seconds')::integer, 20),
      coalesce((v_question ->> 'points')::integer, 1000),
      btrim(coalesce(v_question ->> 'explanation', '')),
      v_level,
      private.clean_text_field(v_question ->> 'objective', 120, format('Question %s: the learning objective can be at most 120 characters.', v_q_index + 1)),
      private.clean_text_field(v_question ->> 'topic', 60, format('Question %s: the topic can be at most 60 characters.', v_q_index + 1)),
      v_difficulty,
      v_kind,
      private.clean_recovery(v_question -> 'recovery', v_q_index + 1)
    )
    returning id into v_question_id;

    v_o_index := 0;
    for v_option in select value from jsonb_array_elements(v_options)
    loop
      if char_length(btrim(coalesce(v_option ->> 'label', ''))) > 120 then
        raise exception 'Question %: answers can be at most 120 characters.', v_q_index + 1 using errcode = 'P0001';
      end if;
      insert into public.question_options (question_id, position, label, image_path, is_correct, misconception)
      values (
        v_question_id,
        v_o_index,
        btrim(coalesce(v_option ->> 'label', '')),
        private.clean_media_path(v_option ->> 'image_path'),
        coalesce((v_option ->> 'is_correct')::boolean, false),
        private.clean_text_field(v_option ->> 'misconception', 200, format('Question %s: misconception notes can be at most 200 characters.', v_q_index + 1))
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
-- start_game: as in the game engine migration, plus learning data and the
-- recovery questions (position 1000 + core position, played only when needed).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.start_game(p_session_id uuid, p_expected_version integer default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_at_version(p_session_id, p_expected_version);
  v_quiz public.quizzes;
  v_question record;
  v_option record;
  v_rec jsonb;
  v_recs jsonb := '{}'::jsonb;
  v_core public.session_questions;
  v_sq_id uuid;
  v_opt_id uuid;
  v_key text;
begin
  if v_session.id is null then
    return (select state_version from public.game_sessions where id = p_session_id);
  end if;
  if v_session.status <> 'lobby' then
    return v_session.state_version;
  end if;
  if v_session.participant_count < 1 then
    raise exception 'Wait for at least one player to join.' using errcode = 'P0001';
  end if;

  select * into v_quiz from public.quizzes where id = v_session.quiz_id;
  if not found then
    raise exception 'The quiz for this session was deleted.' using errcode = 'P0001';
  end if;
  if v_quiz.question_count = 0 or cardinality(private.quiz_issues(v_quiz.id)) > 0 then
    raise exception 'This quiz has unfinished questions. Fix them before starting.' using errcode = 'P0001';
  end if;

  for v_question in
    select * from public.quiz_questions where quiz_id = v_quiz.id order by position
  loop
    insert into public.session_questions (session_id, position, type, prompt, image_path, time_limit_seconds, points,
                                          role, level, objective, topic, kind, difficulty)
    values (p_session_id, v_question.position, v_question.type, v_question.prompt, v_question.image_path,
            v_question.time_limit_seconds, v_question.points,
            'core', v_question.level, v_question.objective, v_question.topic, v_question.kind, v_question.difficulty)
    returning id into v_sq_id;
    if v_question.recovery is not null then
      v_recs := v_recs || jsonb_build_object(v_sq_id::text, v_question.recovery);
    end if;
    for v_option in
      select * from public.question_options where question_id = v_question.id order by position
    loop
      insert into public.session_question_options (session_question_id, position, label, image_path, misconception)
      values (v_sq_id, v_option.position, v_option.label, v_option.image_path, v_option.misconception)
      returning id into v_opt_id;
      if v_option.is_correct then
        insert into public.session_answer_keys (session_question_id, correct_option_id, explanation)
        values (v_sq_id, v_opt_id, v_question.explanation);
      end if;
    end loop;
  end loop;

  -- Renumber positions 0..n-1 in case the quiz had gaps.
  update public.session_questions sq
     set position = r.rn - 1, core_position = r.rn - 1
    from (select id, row_number() over (order by position) as rn from public.session_questions where session_id = p_session_id) r
   where r.id = sq.id;

  -- A level starts where the level changes (and at the first question that has one).
  update public.session_questions sq
     set level_start = true
    from (select id, level, lag(level) over (order by position) as prev
            from public.session_questions where session_id = p_session_id) l
   where l.id = sq.id and l.level is not null and l.level is distinct from l.prev;

  -- Recovery questions, held back at 1000 + their core question's position.
  for v_key, v_rec in select key, value from jsonb_each(v_recs)
  loop
    select * into v_core from public.session_questions where id = v_key::uuid;
    insert into public.session_questions (session_id, position, type, prompt, image_path, time_limit_seconds, points,
                                          role, core_position, level, objective, topic, kind, difficulty)
    values (p_session_id, 1000 + v_core.position, 'multiple_choice', v_rec ->> 'prompt', null, (v_rec ->> 'time_limit_seconds')::integer,
            v_core.points, 'recovery', v_core.position, v_core.level, v_core.objective, v_core.topic, v_core.kind, v_core.difficulty)
    returning id into v_sq_id;
    insert into public.session_question_options (session_question_id, position, label, image_path, misconception)
    select v_sq_id, (o.ord - 1)::smallint, o.value ->> 'label', null, coalesce(o.value ->> 'misconception', '')
      from jsonb_array_elements(v_rec -> 'options') with ordinality as o(value, ord);
    insert into public.session_answer_keys (session_question_id, correct_option_id, explanation)
    select v_sq_id, so.id, coalesce(v_rec ->> 'explanation', '')
      from jsonb_array_elements(v_rec -> 'options') with ordinality as o(value, ord)
      join public.session_question_options so on so.session_question_id = v_sq_id and so.position = o.ord - 1
     where (o.value ->> 'is_correct')::boolean;
  end loop;

  insert into public.participant_scores (participant_id, session_id)
  select p.id, p.session_id from public.participants p
   where p.session_id = p_session_id and p.status = 'active'
  on conflict (participant_id) do nothing;

  update public.game_sessions
     set status = 'in_progress', started_at = now(), speed_scoring = v_quiz.speed_scoring,
         question_count = (select count(*) from public.session_questions where session_id = p_session_id and role = 'core')
   where id = p_session_id;

  v_session := private.open_question(p_session_id, 0);
  return v_session.state_version;
end;
$$;

-- Class accuracy of a closed question (correct among its eligible snapshot), 0–100; null if nobody was eligible.
create or replace function private.question_accuracy(p_question_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case when coalesce(cardinality(q.eligible_ids), 0) = 0 then null
              else round((select count(*) from public.answers a
                           where a.session_question_id = q.id and a.is_correct and a.participant_id = any (q.eligible_ids))
                         * 100.0 / cardinality(q.eligible_ids), 2) end
    from public.session_questions q where q.id = p_question_id;
$$;

-- The question that "next" opens after the current one: its recovery question if the
-- mastery gate is missed, otherwise the next core question; null = the end.
create or replace function private.next_position(p_session public.game_sessions)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  q public.session_questions;
  v_core integer;
  v_accuracy numeric;
begin
  select * into q from public.session_questions where session_id = p_session.id and position = p_session.current_position;
  v_core := coalesce(q.core_position, q.position);
  if q.role = 'core' and p_session.mastery_enabled and not q.recovery_skipped
     and exists (select 1 from public.session_questions r
                  where r.session_id = p_session.id and r.position = 1000 + q.position and r.status = 'pending') then
    v_accuracy := private.question_accuracy(q.id);
    if v_accuracy is not null and v_accuracy < p_session.mastery_pct then
      return 1000 + q.position;
    end if;
  end if;
  if v_core + 1 < p_session.question_count then
    return v_core + 1;
  end if;
  return null;
end;
$$;

create or replace function public.next_question(p_session_id uuid, p_expected_version integer default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_at_version(p_session_id, p_expected_version);
  v_next integer;
begin
  if v_session.id is null then
    return (select state_version from public.game_sessions where id = p_session_id);
  end if;
  if v_session.status <> 'in_progress' or v_session.phase not in ('reveal', 'leaderboard') then
    return v_session.state_version;
  end if;
  perform private.assert_no_open_vote(v_session);
  v_next := private.next_position(v_session);
  if v_next is not null then
    v_session := private.open_question(p_session_id, v_next);
  else
    update public.game_sessions
       set phase = 'podium', status = 'ended', ended_at = now(), state_version = state_version + 1
     where id = p_session_id returning * into v_session;
    perform private.broadcast_state(v_session);
  end if;
  return v_session.state_version;
end;
$$;

-- Host: skip (or bring back) the recovery question after the current core question.
create or replace function public.set_recovery_skipped(p_session_id uuid, p_skipped boolean)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_for_update(p_session_id);
  q public.session_questions;
begin
  if p_skipped is null then
    raise exception 'Choose skip or play.' using errcode = 'P0001';
  end if;
  select * into q from public.session_questions where session_id = p_session_id and position = v_session.current_position;
  if v_session.status <> 'in_progress' or v_session.phase not in ('reveal', 'leaderboard') or q.role <> 'core' then
    raise exception 'You can decide this after a question, before the next one.' using errcode = 'P0001';
  end if;
  if q.recovery_skipped = p_skipped then
    return v_session.state_version;
  end if;
  update public.session_questions set recovery_skipped = p_skipped where id = q.id;
  update public.game_sessions set state_version = state_version + 1
   where id = p_session_id returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session.state_version;
end;
$$;

-- Host, lobby only. p_settings: { mastery_enabled?: boolean, mastery_pct?: 50–100, review_seconds?: 3–20 }
create or replace function public.set_learning_settings(p_session_id uuid, p_settings jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_for_update(p_session_id);
  v_enabled boolean := v_session.mastery_enabled;
  v_pct integer := v_session.mastery_pct;
  v_review integer := v_session.review_ms;
begin
  if v_session.status <> 'lobby' then
    raise exception 'Learning settings can only be changed before the game starts.' using errcode = 'P0001';
  end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'Choose the learning settings.' using errcode = 'P0001';
  end if;
  if p_settings ? 'mastery_enabled' then
    if jsonb_typeof(p_settings -> 'mastery_enabled') <> 'boolean' then
      raise exception 'Choose on or off for the mastery check.' using errcode = 'P0001';
    end if;
    v_enabled := (p_settings ->> 'mastery_enabled')::boolean;
  end if;
  if p_settings ? 'mastery_pct' then
    v_pct := private.setting_int(p_settings -> 'mastery_pct', 50, 100, 'The mastery check needs 50% to 100%.');
  end if;
  if p_settings ? 'review_seconds' then
    v_review := private.setting_int(p_settings -> 'review_seconds', 3, 20, 'Review time: 3 to 20 seconds.') * 1000;
  end if;
  if v_enabled = v_session.mastery_enabled and v_pct = v_session.mastery_pct and v_review = v_session.review_ms then
    return v_session.state_version;
  end if;
  update public.game_sessions
     set mastery_enabled = v_enabled, mastery_pct = v_pct, review_ms = v_review, state_version = state_version + 1
   where id = p_session_id returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session.state_version;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Opening a question: eligibility, battle mode (phase 2), and the hold-back for
-- a review (recovery question) or a new level.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.snapshot_eligible()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  b public.session_battles;
  s public.game_sessions;
  v_prev text;
  v_timer integer;
  v_extra_ms integer := 0;
begin
  new.eligible_ids := coalesce((
    select array_agg(p.id order by p.id) from public.participants p
     where p.session_id = new.session_id and p.status = 'active'
  ), '{}');
  select * into s from public.game_sessions where id = new.session_id;

  select * into b from public.session_battles where session_id = new.session_id;
  if found and b.enabled and b.hp is not null then
    new.battle_mode := private.battle_mode_for(b);
    new.battle_target := case new.battle_mode
      when 'normal' then b.target_normal when 'rage' then b.target_rage when 'enraged' then b.target_enraged end;
    select q.battle_mode into v_prev
      from public.session_questions q
     where q.session_id = new.session_id and q.status <> 'pending' and q.id <> new.id and q.battle_mode is not null
     order by q.opened_at desc nulls last limit 1;
    if v_prev is null then
      new.battle_announce := 'intro';
    elsif v_prev is distinct from new.battle_mode and new.battle_mode in ('normal', 'rage', 'enraged') then
      new.battle_announce := new.battle_mode;
    end if;
    if b.mode_timers then
      v_timer := case new.battle_mode when 'normal' then b.timer_normal when 'rage' then b.timer_rage when 'enraged' then b.timer_enraged end;
      if v_timer is not null then
        new.time_limit_seconds := v_timer;
      end if;
    end if;
  end if;

  if new.role = 'recovery' then
    v_extra_ms := s.review_ms;
  elsif new.battle_announce is not null or new.level_start then
    v_extra_ms := 3000;
  end if;
  if new.starts_at is not null and (v_extra_ms > 0 or v_timer is not null) then
    new.starts_at := new.starts_at + make_interval(secs => v_extra_ms / 1000.0);
    new.opened_at := new.starts_at;
    new.deadline_at := new.starts_at + make_interval(secs => new.time_limit_seconds);
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- What screens see.
-- ─────────────────────────────────────────────────────────────────────────────

-- The most-picked wrong answer of a closed question, with its misconception note.
create or replace function private.top_misconception(p_question_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('option_id', o.id, 'position', o.position, 'label', o.label, 'count', c.n,
                            'answered', (select count(*) from public.answers a2 where a2.session_question_id = p_question_id),
                            'note', nullif(o.misconception, ''))
    from public.session_question_options o
    join public.session_answer_keys k on k.session_question_id = o.session_question_id
    cross join lateral (select count(*) as n from public.answers a where a.option_id = o.id) c
   where o.session_question_id = p_question_id and o.id <> k.correct_option_id and c.n > 0
   order by c.n desc, o.position
   limit 1;
$$;

-- Objectives the class has found hard so far (closed core questions below the mastery bar).
create or replace function private.weak_objectives(p_session public.game_sessions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(distinct q.objective), '[]'::jsonb)
    from public.session_questions q
   where q.session_id = p_session.id and q.role = 'core' and q.status = 'closed' and q.objective <> ''
     and private.question_accuracy(q.id) < p_session.mastery_pct;
$$;

-- Class accuracy per objective over every closed question (core and recovery), for the end.
create or replace function private.learning_report(p_session_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('objective', r.objective, 'topic', r.topic, 'questions', r.n,
                                               'accuracy', r.accuracy, 'recovery_accuracy', r.recovery_accuracy)
                            order by r.accuracy nulls last, r.objective), '[]'::jsonb)
    from (
      select coalesce(nullif(q.objective, ''), 'Other questions') as objective,
             max(q.topic) as topic,
             count(*) filter (where q.role = 'core') as n,
             round(avg(private.question_accuracy(q.id)) filter (where q.role = 'core'), 1) as accuracy,
             round(avg(private.question_accuracy(q.id)) filter (where q.role = 'recovery'), 1) as recovery_accuracy
        from public.session_questions q
       where q.session_id = p_session_id and q.status = 'closed'
       group by coalesce(nullif(q.objective, ''), 'Other questions')
    ) r;
$$;

create or replace function private.game_payload(p_session_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  s public.game_sessions;
  q public.session_questions;
  core public.session_questions;
  k public.session_answer_keys;
  v_closed boolean := false;
  v_question jsonb := null;
  v_board boolean;
  v_accuracy numeric;
begin
  select * into s from public.game_sessions where id = p_session_id;

  if s.current_position is not null then
    select * into q from public.session_questions
     where session_id = p_session_id and position = s.current_position;
    v_closed := q.status = 'closed';
    if v_closed then
      select * into k from public.session_answer_keys where session_question_id = q.id;
      v_accuracy := private.question_accuracy(q.id);
    end if;
    if q.role = 'recovery' then
      select * into core from public.session_questions where session_id = p_session_id and position = q.core_position;
    end if;
    v_question := jsonb_build_object(
      'id', q.id,
      'position', q.position,
      'type', q.type,
      'prompt', q.prompt,
      'image_path', q.image_path,
      'time_limit_seconds', q.time_limit_seconds,
      'points', q.points,
      'status', q.status,
      'starts_at', q.starts_at,
      'opened_at', q.opened_at,
      'deadline_at', q.deadline_at,
      'closed_at', q.closed_at,
      'board_at', case when v_closed then private.board_due_at(p_session_id, q.id) end,
      'eligible_count', cardinality(q.eligible_ids),
      'answer_count', (select count(*) from public.answers a where a.session_question_id = q.id),
      'options', (
        select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'position', o.position, 'label', o.label, 'image_path', o.image_path)
                                   order by o.position), '[]'::jsonb)
          from public.session_question_options o where o.session_question_id = q.id
      ),
      'correct_option_id', case when v_closed then k.correct_option_id end,
      'explanation', case when v_closed then nullif(k.explanation, '') end,
      'distribution', case when v_closed then (
        select coalesce(jsonb_object_agg(o.id, (select count(*) from public.answers a where a.option_id = o.id)), '{}'::jsonb)
          from public.session_question_options o where o.session_question_id = q.id
      ) end,
      -- Learning.
      'role', q.role,
      'core_position', coalesce(q.core_position, q.position),
      'level', q.level,
      'level_start', q.level_start,
      'objective', nullif(q.objective, ''),
      'topic', nullif(q.topic, ''),
      'kind', q.kind,
      'difficulty', q.difficulty,
      'misconception', case when v_closed then private.top_misconception(q.id) end,
      'mastery', case when v_closed and q.role = 'core' then jsonb_build_object(
        'accuracy', v_accuracy,
        'passed', v_accuracy is null or v_accuracy >= s.mastery_pct or not s.mastery_enabled,
        'has_recovery', exists (select 1 from public.session_questions r where r.session_id = p_session_id and r.position = 1000 + q.position),
        'skipped', q.recovery_skipped
      ) end,
      -- A recovery question opens with a review of the question the class missed.
      'review', case when q.role = 'recovery' then jsonb_build_object(
        'core_prompt', core.prompt,
        'accuracy', private.question_accuracy(core.id),
        'misconception', private.top_misconception(core.id),
        'explanation', (select nullif(ck.explanation, '') from public.session_answer_keys ck where ck.session_question_id = core.id),
        'correct_label', (select o.label from public.session_answer_keys ck
                            join public.session_question_options o on o.id = ck.correct_option_id
                           where ck.session_question_id = core.id)
      ) end
    );
  end if;

  v_board := s.phase in ('reveal', 'leaderboard', 'podium') or (s.status = 'ended' and s.started_at is not null);

  return jsonb_build_object(
    'server_now', clock_timestamp(),
    'session', jsonb_build_object(
      'id', s.id,
      'quiz_title', s.quiz_title,
      'status', s.status,
      'phase', s.phase,
      'state_version', s.state_version,
      'question_count', s.question_count,
      'current_position', s.current_position,
      'is_locked', s.is_locked,
      'participant_count', s.participant_count,
      'speed_scoring', s.speed_scoring,
      'reactions_enabled', s.reactions_enabled,
      'reveal_ms', s.reveal_ms,
      'mastery_enabled', s.mastery_enabled,
      'mastery_pct', s.mastery_pct,
      'review_ms', s.review_ms
    ),
    'question', v_question,
    'learning', case when s.started_at is null then null else jsonb_build_object(
      'weak_objectives', private.weak_objectives(s),
      'report', case when s.phase = 'podium' or s.status = 'ended' then private.learning_report(p_session_id) end
    ) end,
    'battle', private.battle_json(p_session_id),
    'leaderboard', case when v_board then private.leaderboard_json(p_session_id, 10) else '[]'::jsonb end,
    'ranks', case when v_board then (
      select coalesce(jsonb_agg(jsonb_build_array(ps.participant_id, ps.score, ps.rank, ps.previous_rank,
                                                  ps.last_points, ps.last_correct, ps.streak, ps.correct_count)), '[]'::jsonb)
        from public.participant_scores ps
       where ps.session_id = p_session_id and ps.rank is not null
    ) else '[]'::jsonb end,
    'ranked_count', (select count(*) from public.participant_scores where session_id = p_session_id and rank is not null),
    'leaderboard_version', (select max(scored_version) from public.participant_scores where session_id = p_session_id)
  );
end;
$$;

revoke all on function public.set_recovery_skipped(uuid, boolean) from public, anon;
revoke all on function public.set_learning_settings(uuid, jsonb) from public, anon;
grant execute on function public.set_recovery_skipped(uuid, boolean) to authenticated;
grant execute on function public.set_learning_settings(uuid, jsonb) to authenticated;
