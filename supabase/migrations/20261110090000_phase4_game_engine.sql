-- ═════════════════════════════════════════════════════════════════════════════
-- Phase 4 — Game engine: questions, answers, server-side scoring, leaderboard
--
--   * The quiz is SNAPSHOTTED when the game starts (editing the quiz mid-game
--     changes nothing). Answer keys live in session_answer_keys, which no
--     client can read; correctness reaches players only after a question closes.
--   * Points are computed in submit_answer from clock_timestamp() against the
--     stored deadline, and aggregated into participant_scores (score, rank,
--     previous_rank, streak) when the question closes. Clients never score.
--   * Every transition increments game_sessions.state_version and broadcasts a
--     small 'state' event; clients reload get_game_state(). Host commands carry
--     the version they saw: a stale version is a no-op (double clicks, two tabs).
--
-- Ranking: standard competition ranking on score (equal scores share a rank:
-- 1, 2, 2, 4). Display order inside a shared rank: more correct answers, then
-- lower total answer time, then earlier join.
-- ═════════════════════════════════════════════════════════════════════════════

create type public.question_status as enum ('pending', 'open', 'closed');

alter table public.game_sessions
  add column current_position integer,
  add column speed_scoring boolean not null default true;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────
create table public.session_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  position integer not null,
  type public.question_type not null,
  prompt text not null,
  image_path text,
  time_limit_seconds integer not null check (time_limit_seconds between 5 and 120),
  points integer not null check (points between 0 and 2000),
  status public.question_status not null default 'pending',
  opened_at timestamptz,
  deadline_at timestamptz,
  closed_at timestamptz,
  constraint session_questions_position_key unique (session_id, position) deferrable initially deferred
);

create table public.session_question_options (
  id uuid primary key default gen_random_uuid(),
  session_question_id uuid not null references public.session_questions (id) on delete cascade,
  position smallint not null,
  label text not null default '',
  image_path text,
  unique (session_question_id, position)
);

-- No policy for anyone: read only inside SECURITY DEFINER functions.
create table public.session_answer_keys (
  session_question_id uuid primary key references public.session_questions (id) on delete cascade,
  correct_option_id uuid not null references public.session_question_options (id) on delete cascade,
  explanation text not null default ''
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  session_question_id uuid not null references public.session_questions (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  option_id uuid not null references public.session_question_options (id) on delete cascade,
  answered_at timestamptz not null default clock_timestamp(),
  response_ms integer not null check (response_ms >= 0),
  is_correct boolean not null,
  points_awarded integer not null check (points_awarded >= 0),
  unique (participant_id, session_question_id)
);
create index answers_question on public.answers (session_question_id);

create table public.participant_scores (
  participant_id uuid primary key references public.participants (id) on delete cascade,
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  score integer not null default 0,
  correct_count integer not null default 0,
  answered_count integer not null default 0,
  total_response_ms bigint not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  rank integer,
  previous_rank integer,
  last_points integer not null default 0,
  last_correct boolean,
  scored_version integer
);
create index participant_scores_session on public.participant_scores (session_id, score desc);

alter table public.session_questions enable row level security;
alter table public.session_question_options enable row level security;
alter table public.session_answer_keys enable row level security;
alter table public.answers enable row level security;
alter table public.participant_scores enable row level security;
-- Deliberately no grants: every read goes through get_game_state().

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────────

-- 'host' | 'presenter' | 'player' | null for the caller in a session.
create or replace function private.session_role(p_session_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.game_sessions s
                  where s.id = p_session_id and s.host_id = auth.uid() and not private.is_anonymous_session()) then 'host'
    when exists (select 1 from public.session_viewers v where v.session_id = p_session_id and v.user_id = auth.uid()) then 'presenter'
    when exists (select 1 from public.participants p
                  where p.session_id = p_session_id and p.user_id = auth.uid() and p.status = 'active') then 'player'
    else null
  end;
$$;

-- Small notification: clients reload get_game_state() when they see a newer version.
create or replace function private.broadcast_state(s public.game_sessions)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_payload jsonb := jsonb_build_object(
    'state_version', s.state_version,
    'status', s.status,
    'phase', s.phase,
    'current_position', s.current_position,
    'is_locked', s.is_locked,
    'participant_count', s.participant_count
  );
begin
  perform private.broadcast(s.id, 'game', 'state', v_payload);
  perform private.broadcast(s.id, 'host', 'state', v_payload);
  -- Phase 3 clients listen for 'session'; keep it in step.
  perform private.broadcast_session(s);
end;
$$;

-- Opens the question at a position and moves the session to the question phase.
create or replace function private.open_question(p_session_id uuid, p_position integer)
returns public.game_sessions
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_session public.game_sessions;
begin
  update public.session_questions
     set status = 'open',
         opened_at = clock_timestamp(),
         deadline_at = clock_timestamp() + make_interval(secs => time_limit_seconds)
   where session_id = p_session_id and position = p_position;
  update public.game_sessions
     set current_position = p_position, phase = 'question', state_version = state_version + 1
   where id = p_session_id
  returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session;
end;
$$;

-- Closes the current question, aggregates its answers into participant_scores
-- and recomputes ranks. Idempotent: does nothing if the question is not open.
create or replace function private.close_current_question(p_session_id uuid)
returns public.game_sessions
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_session public.game_sessions;
  v_question public.session_questions;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  select * into v_question
    from public.session_questions
   where session_id = p_session_id and position = v_session.current_position
     for update;
  if not found or v_question.status <> 'open' then
    return v_session;
  end if;

  update public.session_questions set status = 'closed', closed_at = clock_timestamp() where id = v_question.id;

  -- Players who joined late get a score row now (they score 0 for this question).
  insert into public.participant_scores (participant_id, session_id)
  select p.id, p.session_id from public.participants p
   where p.session_id = p_session_id and p.status = 'active'
  on conflict (participant_id) do nothing;

  update public.participant_scores ps
     set previous_rank = ps.rank,
         score = ps.score + coalesce(x.points_awarded, 0),
         last_points = coalesce(x.points_awarded, 0),
         last_correct = x.is_correct,
         correct_count = ps.correct_count + case when x.is_correct then 1 else 0 end,
         answered_count = ps.answered_count + case when x.answer_id is null then 0 else 1 end,
         total_response_ms = ps.total_response_ms + coalesce(x.response_ms, 0),
         streak = case when x.is_correct then ps.streak + 1 else 0 end,
         best_streak = greatest(ps.best_streak, case when x.is_correct then ps.streak + 1 else 0 end),
         scored_version = v_session.state_version + 1
    from (
      select s2.participant_id, a.id as answer_id, a.points_awarded, a.is_correct, a.response_ms
        from public.participant_scores s2
        left join public.answers a
          on a.participant_id = s2.participant_id and a.session_question_id = v_question.id
       where s2.session_id = p_session_id
    ) x
   where x.participant_id = ps.participant_id;

  -- Competition ranking among players who are not removed.
  update public.participant_scores ps
     set rank = r.rk
    from (
      select s3.participant_id, rank() over (order by s3.score desc) as rk
        from public.participant_scores s3
        join public.participants p on p.id = s3.participant_id
       where s3.session_id = p_session_id and p.status <> 'removed'
    ) r
   where r.participant_id = ps.participant_id;
  update public.participant_scores ps
     set rank = null
    from public.participants p
   where p.id = ps.participant_id and ps.session_id = p_session_id and p.status = 'removed';

  update public.game_sessions
     set phase = 'reveal', state_version = state_version + 1
   where id = p_session_id
  returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session;
end;
$$;

-- Locks the caller's hosted session. A non-null p_expected_version that does
-- not match makes the caller's command a no-op (returns null).
create or replace function private.host_session_at_version(p_session_id uuid, p_expected_version integer)
returns public.game_sessions
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_for_update(p_session_id);
begin
  if p_expected_version is not null and p_expected_version <> v_session.state_version then
    return null;
  end if;
  return v_session;
end;
$$;

-- Top 10 plus the caller's own row; ordered for display.
create or replace function private.leaderboard_json(p_session_id uuid, p_limit integer default 10)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_data order by ord), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'participant_id', p.id,
               'nickname', p.nickname,
               'avatar', p.avatar,
               'status', p.status,
               'score', ps.score,
               'rank', ps.rank,
               'previous_rank', ps.previous_rank,
               'last_points', ps.last_points,
               'last_correct', ps.last_correct,
               'correct_count', ps.correct_count,
               'answered_count', ps.answered_count,
               'streak', ps.streak,
               'best_streak', ps.best_streak
             ) as row_data,
             row_number() over (order by ps.rank, ps.correct_count desc, ps.total_response_ms, p.joined_at, p.id) as ord
        from public.participant_scores ps
        join public.participants p on p.id = ps.participant_id
       where ps.session_id = p_session_id and ps.rank is not null
       order by ord
       limit p_limit
    ) t;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- RPCs: host
-- ═════════════════════════════════════════════════════════════════════════════

-- Snapshots the quiz, creates score rows and opens question 1. Returns the new state_version.
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
  v_sq_id uuid;
  v_opt_id uuid;
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
    insert into public.session_questions (session_id, position, type, prompt, image_path, time_limit_seconds, points)
    values (p_session_id, v_question.position, v_question.type, v_question.prompt, v_question.image_path,
            v_question.time_limit_seconds, v_question.points)
    returning id into v_sq_id;
    for v_option in
      select * from public.question_options where question_id = v_question.id order by position
    loop
      insert into public.session_question_options (session_question_id, position, label, image_path)
      values (v_sq_id, v_option.position, v_option.label, v_option.image_path)
      returning id into v_opt_id;
      if v_option.is_correct then
        insert into public.session_answer_keys (session_question_id, correct_option_id, explanation)
        values (v_sq_id, v_opt_id, v_question.explanation);
      end if;
    end loop;
  end loop;

  -- Renumber positions 0..n-1 in case the quiz had gaps.
  update public.session_questions sq
     set position = r.rn - 1
    from (select id, row_number() over (order by position) as rn from public.session_questions where session_id = p_session_id) r
   where r.id = sq.id and sq.position <> r.rn - 1;

  insert into public.participant_scores (participant_id, session_id)
  select p.id, p.session_id from public.participants p
   where p.session_id = p_session_id and p.status = 'active'
  on conflict (participant_id) do nothing;

  update public.game_sessions
     set status = 'in_progress', started_at = now(), speed_scoring = v_quiz.speed_scoring,
         question_count = (select count(*) from public.session_questions where session_id = p_session_id)
   where id = p_session_id;

  v_session := private.open_question(p_session_id, 0);
  return v_session.state_version;
end;
$$;

-- Host closes the current question early (or on time).
create or replace function public.close_question(p_session_id uuid, p_expected_version integer default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_at_version(p_session_id, p_expected_version);
begin
  if v_session.id is null then
    return (select state_version from public.game_sessions where id = p_session_id);
  end if;
  if v_session.status <> 'in_progress' or v_session.phase <> 'question' then
    return v_session.state_version;
  end if;
  v_session := private.close_current_question(p_session_id);
  return v_session.state_version;
end;
$$;

-- Reveal → leaderboard.
create or replace function public.show_leaderboard(p_session_id uuid, p_expected_version integer default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_at_version(p_session_id, p_expected_version);
begin
  if v_session.id is null then
    return (select state_version from public.game_sessions where id = p_session_id);
  end if;
  if v_session.status <> 'in_progress' or v_session.phase <> 'reveal' then
    return v_session.state_version;
  end if;
  update public.game_sessions set phase = 'leaderboard', state_version = state_version + 1
   where id = p_session_id returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session.state_version;
end;
$$;

-- Reveal/leaderboard → next question, or the podium after the last one.
create or replace function public.next_question(p_session_id uuid, p_expected_version integer default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_at_version(p_session_id, p_expected_version);
begin
  if v_session.id is null then
    return (select state_version from public.game_sessions where id = p_session_id);
  end if;
  if v_session.status <> 'in_progress' or v_session.phase not in ('reveal', 'leaderboard') then
    return v_session.state_version;
  end if;
  if v_session.current_position + 1 < v_session.question_count then
    v_session := private.open_question(p_session_id, v_session.current_position + 1);
  else
    update public.game_sessions
       set phase = 'podium', status = 'ended', ended_at = now(), state_version = state_version + 1
     where id = p_session_id returning * into v_session;
    perform private.broadcast_state(v_session);
  end if;
  return v_session.state_version;
end;
$$;

-- Ends a running game at once (scores so far stand). A lobby is cancelled instead.
create or replace function public.end_game(p_session_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_for_update(p_session_id);
begin
  if v_session.status = 'in_progress' then
    if v_session.phase = 'question' then
      v_session := private.close_current_question(p_session_id);
    end if;
    update public.game_sessions
       set phase = 'podium', status = 'ended', ended_at = now(), state_version = state_version + 1
     where id = p_session_id returning * into v_session;
    perform private.broadcast_state(v_session);
  elsif v_session.status = 'lobby' then
    update public.game_sessions
       set status = 'cancelled', ended_at = now(), state_version = state_version + 1
     where id = p_session_id returning * into v_session;
    perform private.broadcast_state(v_session);
  end if;
  return v_session.state_version;
end;
$$;

-- Any member (host, projector or player) may nudge: closes the open question
-- only once its deadline has passed or every active player has answered.
create or replace function public.advance_if_due(p_session_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions;
  v_question public.session_questions;
  v_answered integer;
  v_active integer;
begin
  if private.session_role(p_session_id) is null then
    raise exception 'Session not found.' using errcode = 'P0002';
  end if;
  select * into v_session from public.game_sessions where id = p_session_id for update;
  if v_session.status <> 'in_progress' or v_session.phase <> 'question' then
    return v_session.state_version;
  end if;
  select * into v_question from public.session_questions
   where session_id = p_session_id and position = v_session.current_position;
  select count(*) into v_answered from public.answers a
    join public.participants p on p.id = a.participant_id and p.status = 'active'
   where a.session_question_id = v_question.id;
  select count(*) into v_active from public.participants
   where session_id = p_session_id and status = 'active';
  if clock_timestamp() >= v_question.deadline_at or (v_active > 0 and v_answered >= v_active) then
    v_session := private.close_current_question(p_session_id);
  end if;
  return v_session.state_version;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- RPCs: players
-- ═════════════════════════════════════════════════════════════════════════════

-- Records one answer. Never reveals correctness.
-- Returns { status: 'accepted' | 'duplicate' | 'late' | 'closed' }.
create or replace function public.submit_answer(p_session_question_id uuid, p_option_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_question public.session_questions;
  v_session public.game_sessions;
  v_me public.participants;
  v_key public.session_answer_keys;
  v_now timestamptz := clock_timestamp();
  v_correct boolean;
  v_points integer;
  v_fraction numeric;
  v_inserted uuid;
  v_answered integer;
begin
  -- FOR SHARE: waits for a concurrent close, so scoring always sees every accepted answer.
  select * into v_question from public.session_questions where id = p_session_question_id for share;
  if not found then
    raise exception 'Question not found.' using errcode = 'P0002';
  end if;
  select * into v_me from public.participants
   where session_id = v_question.session_id and user_id = v_uid and status = 'active';
  if not found then
    raise exception 'You are not in this game.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.session_question_options where id = p_option_id and session_question_id = v_question.id) then
    raise exception 'That answer is not part of this question.' using errcode = 'P0001';
  end if;
  if v_question.status <> 'open' then
    return jsonb_build_object('status', 'closed');
  end if;
  if v_now > v_question.deadline_at then
    return jsonb_build_object('status', 'late');
  end if;

  select * into v_session from public.game_sessions where id = v_question.session_id;
  select * into v_key from public.session_answer_keys where session_question_id = v_question.id;
  v_correct := v_key.correct_option_id = p_option_id;
  v_fraction := greatest(0, least(1, extract(epoch from (v_question.deadline_at - v_now)) / v_question.time_limit_seconds));
  v_points := case
    when not v_correct then 0
    when v_session.speed_scoring then round(v_question.points * (0.5 + 0.5 * v_fraction))::integer
    else v_question.points
  end;

  insert into public.answers (session_question_id, participant_id, option_id, answered_at, response_ms, is_correct, points_awarded)
  values (v_question.id, v_me.id, p_option_id, v_now,
          greatest(0, (extract(epoch from (v_now - v_question.opened_at)) * 1000)::integer), v_correct, v_points)
  on conflict (participant_id, session_question_id) do nothing
  returning id into v_inserted;
  if v_inserted is null then
    return jsonb_build_object('status', 'duplicate');
  end if;

  insert into public.participant_scores (participant_id, session_id) values (v_me.id, v_question.session_id)
  on conflict (participant_id) do nothing;

  select count(*) into v_answered from public.answers where session_question_id = v_question.id;
  perform private.broadcast(v_question.session_id, 'host', 'answer_count',
    jsonb_build_object('session_question_id', v_question.id, 'answer_count', v_answered));
  return jsonb_build_object('status', 'accepted');
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- RPCs: everyone in the session
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.server_now()
returns timestamptz
language sql
volatile
security definer
set search_path = ''
as $$
  select clock_timestamp();
$$;

-- Role-filtered snapshot for (re)connection. Correctness, the distribution and
-- the explanation appear only after the current question has closed.
create or replace function public.get_game_state(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := private.session_role(p_session_id);
  v_session public.game_sessions;
  v_question public.session_questions;
  v_key public.session_answer_keys;
  v_me public.participants;
  v_score public.participant_scores;
  v_my_answer public.answers;
  v_question_json jsonb := null;
  v_me_json jsonb := null;
  v_closed boolean;
  v_answer_count integer;
begin
  if v_role is null then
    -- Removed / left players may still read the final state of their own game.
    if exists (select 1 from public.participants where session_id = p_session_id and user_id = auth.uid()) then
      v_role := 'player';
    else
      raise exception 'Session not found.' using errcode = 'P0002';
    end if;
  end if;
  select * into v_session from public.game_sessions where id = p_session_id;

  if v_session.current_position is not null then
    select * into v_question from public.session_questions
     where session_id = p_session_id and position = v_session.current_position;
    v_closed := v_question.status = 'closed';
    if v_closed then
      select * into v_key from public.session_answer_keys where session_question_id = v_question.id;
    end if;
    select count(*) into v_answer_count from public.answers where session_question_id = v_question.id;

    v_question_json := jsonb_build_object(
      'id', v_question.id,
      'position', v_question.position,
      'type', v_question.type,
      'prompt', v_question.prompt,
      'image_path', v_question.image_path,
      'time_limit_seconds', v_question.time_limit_seconds,
      'points', v_question.points,
      'status', v_question.status,
      'opened_at', v_question.opened_at,
      'deadline_at', v_question.deadline_at,
      'answer_count', v_answer_count,
      'options', (
        select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'position', o.position, 'label', o.label, 'image_path', o.image_path)
                                   order by o.position), '[]'::jsonb)
          from public.session_question_options o where o.session_question_id = v_question.id
      ),
      'correct_option_id', case when v_closed then v_key.correct_option_id end,
      'explanation', case when v_closed then nullif(v_key.explanation, '') end,
      'distribution', case when v_closed then (
        select coalesce(jsonb_object_agg(o.id, (select count(*) from public.answers a where a.option_id = o.id)), '{}'::jsonb)
          from public.session_question_options o where o.session_question_id = v_question.id
      ) end
    );
  end if;

  if v_role = 'player' then
    select * into v_me from public.participants where session_id = p_session_id and user_id = auth.uid();
    select * into v_score from public.participant_scores where participant_id = v_me.id;
    if v_question.id is not null then
      select * into v_my_answer from public.answers where participant_id = v_me.id and session_question_id = v_question.id;
    end if;
    v_me_json := jsonb_build_object(
      'participant_id', v_me.id,
      'nickname', v_me.nickname,
      'avatar', v_me.avatar,
      'status', v_me.status,
      'answer_option_id', v_my_answer.option_id,
      -- Correctness of the current answer only after the question closes.
      'last_correct', case when v_closed then v_score.last_correct end,
      'last_points', case when v_closed then v_score.last_points end,
      'score', coalesce(v_score.score, 0),
      'rank', v_score.rank,
      'previous_rank', v_score.previous_rank,
      'streak', coalesce(v_score.streak, 0),
      'correct_count', coalesce(v_score.correct_count, 0)
    );
  end if;

  return jsonb_build_object(
    'role', v_role,
    'server_now', clock_timestamp(),
    'session', jsonb_build_object(
      'id', v_session.id,
      'quiz_title', v_session.quiz_title,
      'pin', case when v_role in ('host', 'presenter') then v_session.pin end,
      'status', v_session.status,
      'phase', v_session.phase,
      'state_version', v_session.state_version,
      'question_count', v_session.question_count,
      'current_position', v_session.current_position,
      'is_locked', v_session.is_locked,
      'participant_count', v_session.participant_count,
      'speed_scoring', v_session.speed_scoring
    ),
    'question', v_question_json,
    'me', v_me_json,
    -- The leaderboard is shown from the first reveal onwards; it never contains answers.
    'leaderboard', case
      when v_session.phase in ('reveal', 'leaderboard', 'podium') or (v_session.status = 'ended' and v_session.started_at is not null)
      then private.leaderboard_json(p_session_id, 10)
      else '[]'::jsonb
    end,
    'ranked_count', (select count(*) from public.participant_scores where session_id = p_session_id and rank is not null),
    'leaderboard_version', (select max(scored_version) from public.participant_scores where session_id = p_session_id)
  );
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Late joining: players may now join a game in progress (unless locked or full).
-- Same behaviour as Phase 3 otherwise; replaces the function, keeps its grants.
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.join_session(p_session_id uuid, p_nickname text, p_avatar text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_clean jsonb;
  v_avatar text;
  v_session public.game_sessions;
  v_me public.participants;
  v_was_active boolean;
begin
  if v_uid is null or not private.is_anonymous_session() then
    raise exception 'Join from the student page with a game PIN.' using errcode = '42501';
  end if;
  v_clean := private.clean_nickname(p_nickname);
  v_avatar := private.clean_avatar(p_avatar);

  select * into v_session from public.game_sessions where id = p_session_id for update;
  if not found or v_session.status not in ('lobby', 'in_progress') then
    raise exception 'This game has ended.' using errcode = 'P0002';
  end if;

  select * into v_me from public.participants where session_id = p_session_id and user_id = v_uid for update;
  v_was_active := found and v_me.status = 'active';

  if found and v_me.status = 'removed' then
    raise exception 'The host removed you from this game.' using errcode = 'P0001';
  end if;
  if not v_was_active then
    if v_session.is_locked then
      raise exception 'The host has locked this game. Ask them to unlock it.' using errcode = 'P0001';
    end if;
    if v_session.participant_count >= v_session.max_participants then
      raise exception 'This game is full.' using errcode = 'P0001';
    end if;
  end if;

  if exists (
    select 1 from public.participants
     where session_id = p_session_id
       and status = 'active'
       and nickname_key = v_clean ->> 'key'
       and user_id <> v_uid
  ) then
    raise exception 'Someone in this game already uses that nickname. Try another.' using errcode = 'P0001';
  end if;

  if v_me.id is null then
    insert into public.participants (session_id, user_id, nickname, nickname_key, avatar)
    values (p_session_id, v_uid, v_clean ->> 'nickname', v_clean ->> 'key', v_avatar)
    returning * into v_me;
  else
    update public.participants
       set nickname = v_clean ->> 'nickname',
           nickname_key = v_clean ->> 'key',
           avatar = v_avatar,
           status = 'active',
           joined_at = case when v_was_active then joined_at else now() end,
           last_seen_at = now()
     where id = v_me.id
    returning * into v_me;
  end if;

  if v_session.status = 'in_progress' then
    insert into public.participant_scores (participant_id, session_id) values (v_me.id, p_session_id)
    on conflict (participant_id) do nothing;
  end if;

  if v_was_active then
    perform private.broadcast(p_session_id, 'host', 'participant_updated',
      jsonb_build_object('participant', private.participant_json(v_me)));
  else
    update public.game_sessions set participant_count = participant_count + 1
     where id = p_session_id
    returning * into v_session;
    perform private.broadcast(p_session_id, 'host', 'participant_joined',
      jsonb_build_object('participant', private.participant_json(v_me),
                         'participant_count', v_session.participant_count));
    perform private.maybe_broadcast_lobby_count(p_session_id);
  end if;

  return private.participant_json(v_me);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Function privileges
-- ─────────────────────────────────────────────────────────────────────────────
grant execute on function private.session_role(uuid) to authenticated, service_role;

revoke all on function public.start_game(uuid, integer) from public, anon;
revoke all on function public.close_question(uuid, integer) from public, anon;
revoke all on function public.show_leaderboard(uuid, integer) from public, anon;
revoke all on function public.next_question(uuid, integer) from public, anon;
revoke all on function public.end_game(uuid) from public, anon;
revoke all on function public.advance_if_due(uuid) from public, anon;
revoke all on function public.submit_answer(uuid, uuid) from public, anon;
revoke all on function public.server_now() from public, anon;
revoke all on function public.get_game_state(uuid) from public, anon;

grant execute on function public.start_game(uuid, integer) to authenticated;
grant execute on function public.close_question(uuid, integer) to authenticated;
grant execute on function public.show_leaderboard(uuid, integer) to authenticated;
grant execute on function public.next_question(uuid, integer) to authenticated;
grant execute on function public.end_game(uuid) to authenticated;
grant execute on function public.advance_if_due(uuid) to authenticated;
grant execute on function public.submit_answer(uuid, uuid) to authenticated;
grant execute on function public.server_now() to authenticated;
grant execute on function public.get_game_state(uuid) to authenticated;
