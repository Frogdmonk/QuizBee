-- ═════════════════════════════════════════════════════════════════════════════
-- Phase 5 — Leaderboard after every question, and student reactions
--
--   * AUTO LEADERBOARD: after a question closes the reveal stays up for
--     reveal_ms (default 5 s), then advance_if_due() moves the game to the
--     leaderboard. The host and projector nudge at that moment (phones are a
--     jittered backup), so every screen changes together. The teacher can still
--     show it sooner; "Next question" stays a teacher decision.
--   * REACTIONS: send_reaction() lets an active player send one emote from a
--     fixed list, only in the lobby or after answering the current question
--     (and during reveal / leaderboard / podium). Max 5 per 8 s per player.
--     It broadcasts a small 'reaction' event on the game topic, so the
--     projector, the host and every phone see it. No free text, no images.
--     Teachers can switch reactions off: set_reactions_enabled().
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.game_sessions
  add column reveal_ms integer not null default 5000 check (reveal_ms between 0 and 30000),
  add column reactions_enabled boolean not null default true;

-- Rate-limit window per player. Private bookkeeping: RLS on, no grants.
create table public.reaction_limits (
  participant_id uuid primary key references public.participants (id) on delete cascade,
  window_started_at timestamptz not null,
  sent integer not null default 0
);
alter table public.reaction_limits enable row level security;
revoke all on table public.reaction_limits from public, anon, authenticated;

-- The only reactions that exist. Keep in sync with src/lib/emotes.ts.
create or replace function private.emote_keys()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'laugh', 'fire', 'heart', 'eyes', 'cool', 'party', 'skull', 'mindblown', 'clap', 'hundred',
    'shocked', 'confused', 'angry', 'cry', 'thinking', 'celebrate',
    'wave', 'dance', 'hype', 'gg'
  ]::text[];
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Shared payload: adds reactions_enabled, reveal_ms, closed_at and board_at.
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
      'closed_at', q.closed_at,
      -- When the reveal hands over to the leaderboard (server time).
      'board_at', case when v_closed and q.closed_at is not null
                       then q.closed_at + make_interval(secs => s.reveal_ms / 1000.0) end,
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
      'speed_scoring', s.speed_scoring,
      'reactions_enabled', s.reactions_enabled,
      'reveal_ms', s.reveal_ms
    ),
    'question', v_question,
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

-- ─────────────────────────────────────────────────────────────────────────────
-- advance_if_due: closes a due question (as before) AND moves a reveal whose
-- time is up to the leaderboard.
-- ─────────────────────────────────────────────────────────────────────────────
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
  if v_session.status <> 'in_progress' or v_session.phase not in ('question', 'reveal') then
    return v_session.state_version;
  end if;
  select * into v_question from public.session_questions
   where session_id = p_session_id and position = v_session.current_position;

  if v_session.phase = 'reveal' then
    if v_question.closed_at is not null
       and clock_timestamp() >= v_question.closed_at + make_interval(secs => v_session.reveal_ms / 1000.0) then
      update public.game_sessions set phase = 'leaderboard', state_version = state_version + 1
       where id = p_session_id returning * into v_session;
      perform private.broadcast_state(v_session);
    end if;
    return v_session.state_version;
  end if;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- Reactions
-- Returns { status: 'sent' | 'rate_limited' | 'not_now' | 'disabled', retry_ms? }.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.send_reaction(p_session_id uuid, p_emote text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me public.participants;
  v_session public.game_sessions;
  v_question_id uuid;
  v_now timestamptz := clock_timestamp();
  v_window constant interval := interval '8 seconds';
  v_limit constant integer := 5;
  v_sent integer;
  v_started timestamptz;
begin
  if p_emote is null or not (p_emote = any (private.emote_keys())) then
    raise exception 'That reaction is not available.' using errcode = 'P0001';
  end if;
  select * into v_me from public.participants
   where session_id = p_session_id and user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'You are not in this game.' using errcode = 'P0002';
  end if;
  select * into v_session from public.game_sessions where id = p_session_id;
  if not v_session.reactions_enabled then
    return jsonb_build_object('status', 'disabled');
  end if;

  -- Lobby: always. During a question: only after this player has answered it.
  -- Reveal, leaderboard and the final podium: yes.
  if v_session.status = 'lobby' then
    null;
  elsif v_session.status = 'in_progress' and v_session.phase in ('reveal', 'leaderboard') then
    null;
  elsif v_session.status = 'ended' and v_session.phase = 'podium' then
    null;
  elsif v_session.status = 'in_progress' and v_session.phase = 'question' then
    select id into v_question_id from public.session_questions
     where session_id = p_session_id and position = v_session.current_position;
    if not exists (select 1 from public.answers where session_question_id = v_question_id and participant_id = v_me.id) then
      return jsonb_build_object('status', 'not_now');
    end if;
  else
    return jsonb_build_object('status', 'not_now');
  end if;

  insert into public.reaction_limits as rl (participant_id, window_started_at, sent)
  values (v_me.id, v_now, 1)
  on conflict (participant_id) do update
     set window_started_at = case when rl.window_started_at <= v_now - v_window then v_now else rl.window_started_at end,
         sent = case when rl.window_started_at <= v_now - v_window then 1 else rl.sent + 1 end
  returning sent, window_started_at into v_sent, v_started;
  if v_sent > v_limit then
    return jsonb_build_object('status', 'rate_limited',
      'retry_ms', greatest(0, ceil(extract(epoch from (v_started + v_window - v_now)) * 1000))::integer);
  end if;

  perform private.broadcast(p_session_id, 'game', 'reaction', jsonb_build_object(
    'id', gen_random_uuid(),
    'pid', v_me.id,
    'n', v_me.nickname,
    'a', v_me.avatar,
    'e', p_emote,
    'at', v_now
  ));
  return jsonb_build_object('status', 'sent');
end;
$$;

-- Host only. Bumps the version so every screen gets the change in the next 'state' broadcast.
create or replace function public.set_reactions_enabled(p_session_id uuid, p_enabled boolean)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_for_update(p_session_id);
begin
  if p_enabled is null then
    raise exception 'Choose on or off.' using errcode = 'P0001';
  end if;
  if v_session.reactions_enabled = p_enabled or v_session.status not in ('lobby', 'in_progress') then
    return v_session.state_version;
  end if;
  update public.game_sessions set reactions_enabled = p_enabled, state_version = state_version + 1
   where id = p_session_id returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session.state_version;
end;
$$;

grant execute on function private.emote_keys() to authenticated, service_role;
revoke all on function public.send_reaction(uuid, text) from public, anon;
revoke all on function public.set_reactions_enabled(uuid, boolean) from public, anon;
grant execute on function public.send_reaction(uuid, text) to authenticated;
grant execute on function public.set_reactions_enabled(uuid, boolean) to authenticated;
