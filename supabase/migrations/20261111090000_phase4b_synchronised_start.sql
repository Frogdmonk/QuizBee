-- ═════════════════════════════════════════════════════════════════════════════
-- Phase 4b — Everyone on the same page at the same moment
--
-- Problems this fixes (Phase 4 as first shipped):
--   1. The countdown started when the database OPENED a question, not when each
--      phone SHOWED it. A phone that received the question 1 s late had 1 s less
--      time and earned fewer speed points for the same answer.
--   2. A broadcast only said "version N is out"; every phone then called
--      get_game_state(). 100 phones = 100 requests at once, answered at very
--      different speeds.
--
-- Now:
--   * SCHEDULED START: open_question sets starts_at = now + start_lead_ms
--     (default 2 s) and deadline_at = starts_at + time limit. Clients hold the
--     question back until starts_at (server clock), so a message that arrives a
--     little earlier or later changes nothing. Answers before starts_at are
--     refused ('early'); speed points count from starts_at.
--   * FULL BROADCAST: the 'state' event carries everything a screen needs (the
--     question without its answer key; after a close, the correct option, the
--     answer counts and every player's rank row). No follow-up request.
--     get_game_state() returns the same payload plus the caller's own data, so a
--     reconnecting client and a broadcast listener always agree.
--
-- Secrecy is unchanged: correct_option_id, the explanation and the distribution
-- are only included once the question has closed.
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.session_questions add column starts_at timestamptz;
alter table public.game_sessions
  add column start_lead_ms integer not null default 2000 check (start_lead_ms between 0 and 10000);

-- Rows created before this migration have no scheduled start.
update public.session_questions set starts_at = opened_at where starts_at is null and opened_at is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- The role-independent state shared by get_game_state() and the broadcast.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.game_payload(p_session_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  s public.game_sessions;
  q public.session_questions;
  k public.session_answer_keys;
  v_closed boolean := false;
  v_question jsonb := null;
  v_board boolean;
begin
  select * into s from public.game_sessions where id = p_session_id;

  if s.current_position is not null then
    select * into q from public.session_questions
     where session_id = p_session_id and position = s.current_position;
    v_closed := q.status = 'closed';
    if v_closed then
      select * into k from public.session_answer_keys where session_question_id = q.id;
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
      'speed_scoring', s.speed_scoring
    ),
    'question', v_question,
    'leaderboard', case when v_board then private.leaderboard_json(p_session_id, 10) else '[]'::jsonb end,
    -- Compact rows for everybody so each phone finds its own score and rank without another request:
    -- [participant_id, score, rank, previous_rank, last_points, last_correct, streak, correct_count]
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

-- One full-state broadcast per transition (players, projector, host).
-- The host topic only gets a small marker; it is not used to carry state.
create or replace function private.broadcast_state(s public.game_sessions)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  perform private.broadcast(s.id, 'game', 'state', private.game_payload(s.id));
  perform private.broadcast(s.id, 'host', 'state', jsonb_build_object('state_version', s.state_version, 'phase', s.phase));
  -- Lobby-only listeners (Phase 3) still need 'session' until a game has actually started.
  if s.started_at is null then
    perform private.broadcast_session(s);
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Opening a question: scheduled start.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.open_question(p_session_id uuid, p_position integer)
returns public.game_sessions
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_session public.game_sessions;
  v_start timestamptz;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  v_start := clock_timestamp() + make_interval(secs => v_session.start_lead_ms / 1000.0);
  update public.session_questions
     set status = 'open',
         starts_at = v_start,
         opened_at = v_start,
         deadline_at = v_start + make_interval(secs => time_limit_seconds)
   where session_id = p_session_id and position = p_position;
  update public.game_sessions
     set current_position = p_position, phase = 'question', state_version = state_version + 1
   where id = p_session_id
  returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Answering: refuse anything before the scheduled start; score from the start.
-- Returns { status: 'accepted' | 'duplicate' | 'late' | 'early' | 'closed' }.
-- ─────────────────────────────────────────────────────────────────────────────
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
  if v_now < v_question.starts_at then
    return jsonb_build_object('status', 'early');
  end if;
  if v_now > v_question.deadline_at then
    return jsonb_build_object('status', 'late');
  end if;

  select * into v_session from public.game_sessions where id = v_question.session_id;
  select * into v_key from public.session_answer_keys where session_question_id = v_question.id;
  v_correct := v_key.correct_option_id = p_option_id;
  -- Fraction of the answering window left; the window starts at starts_at, not at delivery.
  v_fraction := greatest(0, least(1, extract(epoch from (v_question.deadline_at - v_now)) / v_question.time_limit_seconds));
  v_points := case
    when not v_correct then 0
    when v_session.speed_scoring then round(v_question.points * (0.5 + 0.5 * v_fraction))::integer
    else v_question.points
  end;

  insert into public.answers (session_question_id, participant_id, option_id, answered_at, response_ms, is_correct, points_awarded)
  values (v_question.id, v_me.id, p_option_id, v_now,
          greatest(0, (extract(epoch from (v_now - v_question.starts_at)) * 1000)::integer), v_correct, v_points)
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Snapshot for (re)connection: the shared payload plus the caller's own data.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_game_state(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := private.session_role(p_session_id);
  v_payload jsonb;
  v_pin text;
  v_me public.participants;
  v_score public.participant_scores;
  v_my_answer public.answers;
  v_question_id uuid;
  v_closed boolean;
  v_me_json jsonb := null;
begin
  if v_role is null then
    -- Removed / left players may still read the final state of their own game.
    if exists (select 1 from public.participants where session_id = p_session_id and user_id = auth.uid()) then
      v_role := 'player';
    else
      raise exception 'Session not found.' using errcode = 'P0002';
    end if;
  end if;

  v_payload := private.game_payload(p_session_id);
  v_question_id := nullif(v_payload #>> '{question,id}', '')::uuid;
  v_closed := coalesce((v_payload #>> '{question,status}') = 'closed', false);

  if v_role in ('host', 'presenter') then
    select pin into v_pin from public.game_sessions where id = p_session_id;
    v_payload := jsonb_set(v_payload, '{session,pin}', to_jsonb(v_pin));
  end if;

  if v_role = 'player' then
    select * into v_me from public.participants where session_id = p_session_id and user_id = auth.uid();
    select * into v_score from public.participant_scores where participant_id = v_me.id;
    if v_question_id is not null then
      select * into v_my_answer from public.answers where participant_id = v_me.id and session_question_id = v_question_id;
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

  return v_payload || jsonb_build_object('role', v_role, 'me', v_me_json);
end;
$$;
