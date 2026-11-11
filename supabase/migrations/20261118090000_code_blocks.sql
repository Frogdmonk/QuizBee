-- ═════════════════════════════════════════════════════════════════════════════
-- Code blocks in questions (programming quizzes).
--
--   * A question can show a block of source code under its text: code_language
--     (an identifier such as python, c, cpp, java; others are shown as plain
--     text) and code_content, kept exactly as written (indentation, blank lines,
--     quotes and backslashes). Both are null for an ordinary question.
--   * An answer can itself be a short code snippet (label_is_code): shown in a
--     monospaced font.
--   * Code is only stored and displayed. Nothing here, or anywhere in Rally,
--     compiles, runs or evaluates it.
--
-- Replaces quiz_issues, copy_quiz, save_quiz, start_game and game_payload from
-- the learning migration with the code columns added; nothing else changes.
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.quiz_questions
  add column code_language text check (code_language ~ '^[a-z0-9][a-z0-9+#._-]{0,19}$'),
  add column code_content text check (char_length(code_content) <= 2000),
  add constraint quiz_questions_code_pair check ((code_language is null) = (code_content is null));

alter table public.question_options
  add column label_is_code boolean not null default false;

alter table public.session_questions
  add column code_language text,
  add column code_content text;

alter table public.session_question_options
  add column label_is_code boolean not null default false;

-- A question with a code block needs its code before the quiz can be published.
create or replace function private.quiz_issues(p_quiz_id uuid)
returns text[]
language sql
stable
set search_path = ''
as $$
  with qs as (
    select q.id, q.position, q.type, q.prompt, q.recovery, q.code_language, q.code_content,
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
       union all
       select 11, 'add the code, or remove the code block.' where qs.code_language is not null and btrim(coalesce(qs.code_content, ''), E' \t\r\n') = ''
     ) i
  )
  select coalesce(array_agg(msg order by pos, ord), '{}'::text[]) from issues;
$$;

-- Copies a quiz with its learning data and code.
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
                                       level, objective, topic, difficulty, kind, recovery, code_language, code_content)
    values (v_new_id, v_question.position, v_question.type, v_question.prompt, v_question.image_path,
            v_question.time_limit_seconds, v_question.points, v_question.explanation,
            v_question.level, v_question.objective, v_question.topic, v_question.difficulty, v_question.kind, v_question.recovery,
            v_question.code_language, v_question.code_content)
    returning id into v_new_question_id;

    insert into public.question_options (question_id, position, label, image_path, is_correct, misconception, label_is_code)
    select v_new_question_id, position, label, image_path, is_correct, misconception, label_is_code
      from public.question_options
     where question_id = v_question.id;
  end loop;

  return v_new_id;
end;
$$;

-- save_quiz: as in the learning migration, plus the question's code block and code answers.
-- Question key: code { language, content } | null. Option key: is_code boolean.
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
  v_code jsonb;
  v_code_language text;
  v_code_content text;
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

    -- Code shown with the question: { language, content }. Kept exactly as written (no trimming),
    -- never run. The language is an identifier such as python, c, cpp or java.
    v_code := v_question -> 'code';
    v_code_language := null;
    v_code_content := null;
    if v_code is not null and jsonb_typeof(v_code) <> 'null' then
      if jsonb_typeof(v_code) <> 'object' or jsonb_typeof(v_code -> 'content') is distinct from 'string' then
        raise exception 'Question %: invalid code block.', v_q_index + 1 using errcode = 'P0001';
      end if;
      v_code_language := lower(btrim(coalesce(v_code ->> 'language', '')));
      if v_code_language !~ '^[a-z0-9][a-z0-9+#._-]{0,19}$' then
        raise exception 'Question %: choose the programming language of the code.', v_q_index + 1 using errcode = 'P0001';
      end if;
      v_code_content := v_code ->> 'content';
      if char_length(v_code_content) > 2000 then
        raise exception 'Question %: the code can be at most 2000 characters.', v_q_index + 1 using errcode = 'P0001';
      end if;
    end if;

    v_options := coalesce(v_question -> 'options', '[]'::jsonb);
    if jsonb_typeof(v_options) <> 'array' or jsonb_array_length(v_options) > 4 then
      raise exception 'Question %: a question can have at most 4 answers.', v_q_index + 1 using errcode = 'P0001';
    end if;
    if (select count(*) from jsonb_array_elements(v_options) o where coalesce((o ->> 'is_correct')::boolean, false)) > 1 then
      raise exception 'Question %: mark only one correct answer.', v_q_index + 1 using errcode = 'P0001';
    end if;

    insert into public.quiz_questions (quiz_id, position, type, prompt, image_path, time_limit_seconds, points, explanation,
                                       level, objective, topic, difficulty, kind, recovery, code_language, code_content)
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
      private.clean_recovery(v_question -> 'recovery', v_q_index + 1),
      v_code_language,
      v_code_content
    )
    returning id into v_question_id;

    v_o_index := 0;
    for v_option in select value from jsonb_array_elements(v_options)
    loop
      if char_length(btrim(coalesce(v_option ->> 'label', ''))) > 120 then
        raise exception 'Question %: answers can be at most 120 characters.', v_q_index + 1 using errcode = 'P0001';
      end if;
      insert into public.question_options (question_id, position, label, image_path, is_correct, misconception, label_is_code)
      values (
        v_question_id,
        v_o_index,
        btrim(coalesce(v_option ->> 'label', '')),
        private.clean_media_path(v_option ->> 'image_path'),
        coalesce((v_option ->> 'is_correct')::boolean, false),
        private.clean_text_field(v_option ->> 'misconception', 200, format('Question %s: misconception notes can be at most 200 characters.', v_q_index + 1)),
        coalesce((v_option ->> 'is_code')::boolean, false)
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

-- start_game: as in the learning migration; the snapshot keeps the code.
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
                                          role, level, objective, topic, kind, difficulty, code_language, code_content)
    values (p_session_id, v_question.position, v_question.type, v_question.prompt, v_question.image_path,
            v_question.time_limit_seconds, v_question.points,
            'core', v_question.level, v_question.objective, v_question.topic, v_question.kind, v_question.difficulty,
            v_question.code_language, v_question.code_content)
    returning id into v_sq_id;
    if v_question.recovery is not null then
      v_recs := v_recs || jsonb_build_object(v_sq_id::text, v_question.recovery);
    end if;
    for v_option in
      select * from public.question_options where question_id = v_question.id order by position
    loop
      insert into public.session_question_options (session_question_id, position, label, image_path, misconception, label_is_code)
      values (v_sq_id, v_option.position, v_option.label, v_option.image_path, v_option.misconception, v_option.label_is_code)
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

-- game_payload: as in the learning migration, plus the question's code and which answers are code.
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
      'code', case when q.code_language is not null then jsonb_build_object('language', q.code_language, 'content', q.code_content) end,
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
        select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'position', o.position, 'label', o.label, 'image_path', o.image_path,
                                                      'is_code', o.label_is_code)
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
