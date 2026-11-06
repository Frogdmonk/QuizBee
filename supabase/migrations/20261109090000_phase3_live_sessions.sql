-- ═════════════════════════════════════════════════════════════════════════════
-- Phase 3 — Live sessions: PIN, anonymous join, waiting room, projector lobby
--   * game_sessions     one hosted run of a quiz, found by a 6-digit PIN
--   * participants      anonymous students (Supabase anonymous users)
--   * session_viewers   projector devices that claimed a presenter link
--   * pin_attempts      throttles wrong-PIN guesses per user
--   * Realtime: private topics  session:{id}:host  session:{id}:game  session:{id}:lobby
--     Clients may only RECEIVE (RLS on realtime.messages); every broadcast is
--     sent by the RPCs below with realtime.send().
--
-- Question snapshots, answers and scoring arrive in Phase 4. The status/phase
-- columns already exist so Phase 4 is additive.
-- ═════════════════════════════════════════════════════════════════════════════

create type public.session_status as enum ('lobby', 'in_progress', 'ended', 'cancelled');
create type public.session_phase as enum ('lobby', 'question', 'reveal', 'leaderboard', 'podium');
create type public.participant_status as enum ('active', 'left', 'removed');

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users (id) on delete cascade,
  quiz_id uuid references public.quizzes (id) on delete set null,
  quiz_title text not null,
  question_count integer not null,
  pin text not null check (pin ~ '^[0-9]{6}$'),
  status public.session_status not null default 'lobby',
  phase public.session_phase not null default 'lobby',
  state_version integer not null default 1,
  is_locked boolean not null default false,
  max_participants integer not null default 100 check (max_participants between 2 and 100),
  participant_count integer not null default 0 check (participant_count >= 0),
  presenter_key_hash bytea,
  lobby_broadcast_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

-- A PIN is unique only among sessions people can still join.
create unique index game_sessions_open_pin on public.game_sessions (pin) where status in ('lobby', 'in_progress');
create index game_sessions_host on public.game_sessions (host_id, created_at desc);
create index game_sessions_stale_lobbies on public.game_sessions (created_at) where status = 'lobby';
create index game_sessions_quiz on public.game_sessions (quiz_id);

create trigger game_sessions_set_updated_at
  before update on public.game_sessions
  for each row execute function private.set_updated_at();

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 16),
  nickname_key text not null,
  avatar text not null check (avatar ~ '^[0-7][0-9][0-7][0-5][0-5][0-5][0-9][0-5][0-7]$'),
  status public.participant_status not null default 'active',
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (session_id, user_id)
);

-- Two active players in one session cannot share a nickname (case and spacing ignored).
create unique index participants_active_nickname on public.participants (session_id, nickname_key) where status = 'active';
create index participants_user on public.participants (user_id);

create table public.session_viewers (
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index session_viewers_user on public.session_viewers (user_id);

create table public.pin_attempts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_start timestamptz not null default now(),
  failures integer not null default 0
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row level security
-- Hosts may read their own sessions and rosters. Students and projectors read
-- everything through RPCs. Nobody writes these tables directly.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.game_sessions enable row level security;
alter table public.participants enable row level security;
alter table public.session_viewers enable row level security;
alter table public.pin_attempts enable row level security;

-- presenter_key_hash and lobby_broadcast_at are deliberately not readable.
grant select (id, host_id, quiz_id, quiz_title, question_count, pin, status, phase, state_version, is_locked,
              max_participants, participant_count, created_at, updated_at, started_at, ended_at)
  on table public.game_sessions to authenticated;
-- user_id is deliberately not readable.
grant select (id, session_id, nickname, avatar, status, joined_at, last_seen_at, removed_at)
  on table public.participants to authenticated;

create policy "Hosts can read their sessions"
  on public.game_sessions for select to authenticated
  using (host_id = (select auth.uid()) and not private.is_anonymous_session());

create policy "Hosts can read their participants"
  on public.participants for select to authenticated
  using (
    exists (
      select 1 from public.game_sessions s
       where s.id = participants.session_id
         and s.host_id = (select auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────────

-- Words rejected anywhere inside a nickname, after normalising look-alike
-- characters and collapsing repeated letters. Mirrored in src/lib/nickname-rules.ts.
create or replace function private.nickname_blocked(p_key text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1
      from unnest(array[
        'fuck', 'shit', 'cunt', 'bitch', 'niga', 'niger', 'fagot', 'slut', 'whore', 'pusy', 'porn', 'nazi',
        'hitler', 'bastard', 'wank', 'twat', 'retard', 'rapist', 'dildo', 'penis', 'vagina', 'ashole'
      ]) as w(word)
     where strpos(
             regexp_replace(translate(p_key, '0134578@$', 'oieastbas'), '(.)\1+', '\1', 'g'),
             w.word
           ) > 0
  );
$$;

-- Cleans a nickname and returns {nickname, key}, or raises a friendly error.
-- Rules (mirrored in src/lib/nickname-rules.ts):
--   * NFKC-normalised, whitespace collapsed, trimmed
--   * 2–16 characters
--   * no control or invisible characters, and none of  < > { } [ ] \ / @ # $ % ^ & * = + | ~ ` "
--   * must contain something other than spaces and punctuation
--   * not on the blocked-word list
create or replace function private.clean_nickname(p_nickname text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(normalize(coalesce(p_nickname, ''), NFKC), '\s+', ' ', 'g'));
  v_key text;
begin
  if char_length(v_name) < 2 then
    raise exception 'Nicknames need at least 2 characters.' using errcode = 'P0001';
  end if;
  if char_length(v_name) > 16 then
    raise exception 'Nicknames can be up to 16 characters.' using errcode = 'P0001';
  end if;
  if v_name ~ '[[:cntrl:]\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]'
     or v_name ~ '[<>{}\[\]\\/@#$%^&*=+|~`"]' then
    raise exception 'Use letters, numbers and simple punctuation only.' using errcode = 'P0001';
  end if;
  v_key := lower(regexp_replace(v_name, '[\s._''!?,():;-]', '', 'g'));
  if v_key = '' then
    raise exception 'Nicknames need at least one letter or number.' using errcode = 'P0001';
  end if;
  if private.nickname_blocked(v_key) then
    raise exception 'Please choose a different nickname.' using errcode = 'P0001';
  end if;
  return jsonb_build_object('nickname', v_name, 'key', v_key);
end;
$$;

-- Avatar codes are 9 digits, one per part (see src/lib/avatar.ts).
create or replace function private.clean_avatar(p_avatar text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_avatar is null or p_avatar !~ '^[0-7][0-9][0-7][0-5][0-5][0-5][0-9][0-5][0-7]$' then
    raise exception 'Pick an avatar.' using errcode = 'P0001';
  end if;
  return p_avatar;
end;
$$;

create or replace function private.participant_json(p public.participants)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'nickname', p.nickname,
    'avatar', p.avatar,
    'status', p.status,
    'joined_at', p.joined_at,
    'last_seen_at', p.last_seen_at
  );
$$;

-- Sends a broadcast on one of the session's private topics. Delivered after commit.
create or replace function private.broadcast(p_session_id uuid, p_kind text, p_event text, p_payload jsonb)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  perform realtime.send(p_payload, p_event, 'session:' || p_session_id::text || ':' || p_kind, true);
end;
$$;

-- Session status broadcast to the host, projector and players.
create or replace function private.broadcast_session(s public.game_sessions)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_payload jsonb := jsonb_build_object(
    'status', s.status,
    'phase', s.phase,
    'is_locked', s.is_locked,
    'state_version', s.state_version,
    'participant_count', s.participant_count
  );
begin
  perform private.broadcast(s.id, 'host', 'session', v_payload);
  perform private.broadcast(s.id, 'game', 'session', v_payload);
end;
$$;

-- Tells waiting players how many have joined, at most once every 5 seconds per
-- session (players also reconcile through get_player_state every ~12 s).
create or replace function private.maybe_broadcast_lobby_count(p_session_id uuid)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.game_sessions
     set lobby_broadcast_at = now()
   where id = p_session_id
     and (lobby_broadcast_at is null or lobby_broadcast_at < now() - interval '5 seconds')
  returning participant_count into v_count;
  if found then
    perform private.broadcast(p_session_id, 'lobby', 'count', jsonb_build_object('participant_count', v_count));
  end if;
end;
$$;

-- Locks and returns a session the caller hosts, or raises "not found".
create or replace function private.host_session_for_update(p_session_id uuid)
returns public.game_sessions
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_session public.game_sessions;
begin
  select * into v_session
    from public.game_sessions
   where id = p_session_id and host_id = auth.uid()
     for update;
  if not found or private.is_anonymous_session() then
    raise exception 'Session not found.' using errcode = 'P0002';
  end if;
  return v_session;
end;
$$;

-- Lobbies nobody started within 12 hours are cancelled so their PINs are freed.
create or replace function private.expire_stale_lobbies()
returns void
language sql
volatile
set search_path = ''
as $$
  update public.game_sessions
     set status = 'cancelled', ended_at = now(), state_version = state_version + 1
   where status = 'lobby'
     and created_at < now() - interval '12 hours';
$$;

create or replace function private.new_pin()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_pin text;
begin
  for i in 1..50 loop
    v_pin := (100000 + floor(random() * 900000))::integer::text;
    if not exists (
      select 1 from public.game_sessions where pin = v_pin and status in ('lobby', 'in_progress')
    ) then
      return v_pin;
    end if;
  end loop;
  raise exception 'Could not create a game PIN. Please try again.' using errcode = 'P0001';
end;
$$;

-- Lobby view shared by the host and projector screens.
create or replace function private.lobby_json(p_session_id uuid, p_role text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'role', p_role,
    'quiz_id', s.quiz_id,
    'quiz_title', s.quiz_title,
    'question_count', s.question_count,
    'pin', s.pin,
    'status', s.status,
    'phase', s.phase,
    'state_version', s.state_version,
    'is_locked', s.is_locked,
    'max_participants', s.max_participants,
    'participant_count', s.participant_count,
    'has_presenter_link', s.presenter_key_hash is not null,
    'created_at', s.created_at,
    'participants', coalesce((
      select jsonb_agg(private.participant_json(p) order by p.joined_at, p.id)
        from public.participants p
       where p.session_id = s.id and p.status = 'active'
    ), '[]'::jsonb)
  )
  from public.game_sessions s
  where s.id = p_session_id;
$$;

-- Realtime authorisation. Called by the RLS policy on realtime.messages when a
-- client joins a private channel.
--   host topic:  the host and claimed projectors
--   game topic:  the host, projectors and active players
--   lobby topic: the host and active players
create or replace function private.can_receive_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match text[];
  v_session uuid;
  v_kind text;
begin
  if v_uid is null or p_topic is null then
    return false;
  end if;
  v_match := regexp_match(p_topic, '^session:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(host|game|lobby)$');
  if v_match is null then
    return false;
  end if;
  v_session := v_match[1]::uuid;
  v_kind := v_match[2];

  if exists (
    select 1 from public.game_sessions s
     where s.id = v_session and s.host_id = v_uid and not private.is_anonymous_session()
  ) then
    return true;
  end if;
  if v_kind in ('host', 'game') and exists (
    select 1 from public.session_viewers v where v.session_id = v_session and v.user_id = v_uid
  ) then
    return true;
  end if;
  if v_kind in ('game', 'lobby') and exists (
    select 1 from public.participants p
     where p.session_id = v_session and p.user_id = v_uid and p.status = 'active'
  ) then
    return true;
  end if;
  return false;
end;
$$;

grant execute on function private.can_receive_topic(text) to authenticated, service_role;

-- Receive-only: there is deliberately no INSERT policy, so clients can never
-- send (or use Presence) on these channels.
create policy "Session members can receive session broadcasts"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and private.can_receive_topic((select realtime.topic()))
  );

-- ═════════════════════════════════════════════════════════════════════════════
-- RPCs: host
-- ═════════════════════════════════════════════════════════════════════════════

-- Creates a lobby for a published quiz the caller owns or may edit.
-- p_settings: { max_participants?: 2–100 }. Returns the session id.
create or replace function public.create_session(p_quiz_id uuid, p_settings jsonb default '{}'::jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_teacher();
  v_quiz public.quizzes;
  v_max integer;
  v_id uuid;
begin
  select * into v_quiz from public.quizzes where id = p_quiz_id;
  if not found
     or (v_quiz.owner_id <> v_uid and coalesce(private.quiz_access_of(p_quiz_id, v_uid) = 'edit', false) = false) then
    raise exception 'Quiz not found.' using errcode = 'P0002';
  end if;
  if v_quiz.status <> 'published' then
    raise exception 'Publish the quiz before hosting it.' using errcode = 'P0001';
  end if;
  if v_quiz.question_count = 0 or cardinality(private.quiz_issues(p_quiz_id)) > 0 then
    raise exception 'This quiz has unfinished questions. Fix them before hosting.' using errcode = 'P0001';
  end if;

  begin
    v_max := coalesce((p_settings ->> 'max_participants')::integer, 100);
  exception when others then
    raise exception 'Player limit must be a whole number.' using errcode = 'P0001';
  end;
  if v_max not between 2 and 100 then
    raise exception 'Player limit must be between 2 and 100.' using errcode = 'P0001';
  end if;

  perform private.expire_stale_lobbies();

  if (select count(*) from public.game_sessions
       where host_id = v_uid and status in ('lobby', 'in_progress')) >= 5 then
    raise exception 'You already have 5 open sessions. End one before hosting another.' using errcode = 'P0001';
  end if;

  insert into public.game_sessions (host_id, quiz_id, quiz_title, question_count, pin, max_participants)
  values (v_uid, v_quiz.id, v_quiz.title, v_quiz.question_count, private.new_pin(), v_max)
  returning id into v_id;
  return v_id;
end;
$$;

-- Host or claimed projector: the lobby with its active players.
create or replace function public.get_session_lobby(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then
    raise exception 'Session not found.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.game_sessions
              where id = p_session_id and host_id = v_uid and not private.is_anonymous_session()) then
    v_role := 'host';
  elsif exists (select 1 from public.session_viewers where session_id = p_session_id and user_id = v_uid) then
    v_role := 'presenter';
  else
    raise exception 'Session not found.' using errcode = 'P0002';
  end if;
  return private.lobby_json(p_session_id, v_role);
end;
$$;

create or replace function public.set_session_locked(p_session_id uuid, p_locked boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_for_update(p_session_id);
begin
  if v_session.status not in ('lobby', 'in_progress') then
    raise exception 'This session has already ended.' using errcode = 'P0001';
  end if;
  if v_session.is_locked is distinct from coalesce(p_locked, false) then
    update public.game_sessions
       set is_locked = coalesce(p_locked, false), state_version = state_version + 1
     where id = p_session_id
    returning * into v_session;
    perform private.broadcast_session(v_session);
  end if;
  return v_session.is_locked;
end;
$$;

-- Removes a player. They cannot rejoin this session from the same device.
create or replace function public.remove_participant(p_session_id uuid, p_participant_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_for_update(p_session_id);
  v_previous public.participant_status;
begin
  select status into v_previous
    from public.participants
   where id = p_participant_id and session_id = p_session_id
     for update;
  if not found then
    raise exception 'That player is no longer in this session.' using errcode = 'P0002';
  end if;
  if v_previous = 'removed' then
    return;
  end if;

  update public.participants set status = 'removed', removed_at = now() where id = p_participant_id;
  if v_previous = 'active' then
    update public.game_sessions set participant_count = participant_count - 1
     where id = p_session_id
    returning * into v_session;
  end if;

  perform private.broadcast(p_session_id, 'host', 'participant_removed',
    jsonb_build_object('id', p_participant_id, 'participant_count', v_session.participant_count));
  perform private.broadcast(p_session_id, 'game', 'removed', jsonb_build_object('participant_id', p_participant_id));
  perform private.maybe_broadcast_lobby_count(p_session_id);
end;
$$;

-- Ends a session that has not finished yet. Players are told immediately.
create or replace function public.cancel_session(p_session_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_for_update(p_session_id);
begin
  if v_session.status not in ('lobby', 'in_progress') then
    return;
  end if;
  update public.game_sessions
     set status = 'cancelled', ended_at = now(), state_version = state_version + 1
   where id = p_session_id
  returning * into v_session;
  perform private.broadcast_session(v_session);
end;
$$;

-- Creates (or replaces) the projector link key. Returns the raw key once; only
-- its SHA-256 is stored. Replacing it disconnects previously linked projectors.
create or replace function public.create_presenter_link(p_session_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_for_update(p_session_id);
  v_key text := private.new_token();
begin
  if v_session.status not in ('lobby', 'in_progress') then
    raise exception 'This session has already ended.' using errcode = 'P0001';
  end if;
  update public.game_sessions set presenter_key_hash = private.token_hash(v_key) where id = p_session_id;
  delete from public.session_viewers where session_id = p_session_id;
  return v_key;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- RPCs: projector on another device
-- ═════════════════════════════════════════════════════════════════════════════

-- Any signed-in user (usually an anonymous projector device) with the key
-- becomes a read-only viewer. Viewers can call get_session_lobby and receive
-- host/game broadcasts; no host operation accepts them.
create or replace function public.claim_presenter(p_session_id uuid, p_key text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign-in required.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.game_sessions
     where id = p_session_id
       and status in ('lobby', 'in_progress')
       and presenter_key_hash is not null
       and presenter_key_hash = private.token_hash(p_key)
  ) then
    raise exception 'This projector link is not valid any more. Copy a new one from the host screen.'
      using errcode = 'P0002';
  end if;
  insert into public.session_viewers (session_id, user_id) values (p_session_id, v_uid)
  on conflict do nothing;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- RPCs: players (anonymous students)
-- ═════════════════════════════════════════════════════════════════════════════

-- Finds an open session by PIN. Wrong PINs are counted per user: 10 misses in
-- 10 minutes blocks further lookups until the window passes. Returns
-- { found: false } instead of raising so the counter is committed.
-- { found: true, session_id, quiz_title, status, is_locked, is_full,
--   me: { id, nickname, avatar, status } | null }
create or replace function public.lookup_session(p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt public.pin_attempts;
  v_session public.game_sessions;
  v_me public.participants;
begin
  if v_uid is null then
    raise exception 'Sign-in required.' using errcode = '42501';
  end if;

  select * into v_attempt from public.pin_attempts where user_id = v_uid for update;
  if found and v_attempt.window_start > now() - interval '10 minutes' and v_attempt.failures >= 10 then
    raise exception 'Too many wrong PINs. Wait a few minutes and try again.' using errcode = 'P0001';
  end if;

  if coalesce(p_pin, '') ~ '^[0-9]{6}$' then
    select * into v_session
      from public.game_sessions
     where pin = p_pin
       and status in ('lobby', 'in_progress')
       and not (status = 'lobby' and created_at < now() - interval '12 hours');
  end if;

  if v_session.id is null then
    insert into public.pin_attempts as a (user_id, window_start, failures)
    values (v_uid, now(), 1)
    on conflict (user_id) do update
      set failures = case when a.window_start > now() - interval '10 minutes' then a.failures + 1 else 1 end,
          window_start = case when a.window_start > now() - interval '10 minutes' then a.window_start else now() end;
    return jsonb_build_object('found', false);
  end if;

  select * into v_me from public.participants where session_id = v_session.id and user_id = v_uid;

  return jsonb_build_object(
    'found', true,
    'session_id', v_session.id,
    'quiz_title', v_session.quiz_title,
    'status', v_session.status,
    'is_locked', v_session.is_locked,
    'is_full', v_session.participant_count >= v_session.max_participants,
    'me', case when v_me.id is null then null else jsonb_build_object(
      'id', v_me.id, 'nickname', v_me.nickname, 'avatar', v_me.avatar, 'status', v_me.status) end
  );
end;
$$;

-- Joins a lobby as an anonymous student, or updates the caller's nickname and
-- avatar when they are already in it. Idempotent per auth.uid().
-- Returns { id, nickname, avatar, status, joined_at, last_seen_at }.
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

  -- Serialises joins per session so the player limit and nickname checks hold.
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
    if v_session.status <> 'lobby' then
      raise exception 'This game has already started.' using errcode = 'P0001';
    end if;
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

create or replace function public.leave_session(p_session_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.game_sessions;
  v_me public.participants;
begin
  select * into v_session from public.game_sessions where id = p_session_id for update;
  if not found then
    return;
  end if;
  select * into v_me from public.participants
   where session_id = p_session_id and user_id = v_uid and status = 'active'
     for update;
  if not found then
    return;
  end if;

  update public.participants set status = 'left' where id = v_me.id;
  update public.game_sessions set participant_count = participant_count - 1
   where id = p_session_id
  returning * into v_session;
  perform private.broadcast(p_session_id, 'host', 'participant_left',
    jsonb_build_object('id', v_me.id, 'participant_count', v_session.participant_count));
  perform private.maybe_broadcast_lobby_count(p_session_id);
end;
$$;

-- What a player's screen needs. Doubles as the heartbeat (last_seen_at is
-- written at most every 10 s). Raises "not found" for non-participants.
-- { session: { id, quiz_title, status, phase, is_locked, participant_count, state_version },
--   me: { id, nickname, avatar, status, ... } }
create or replace function public.get_player_state(p_session_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.game_sessions;
  v_me public.participants;
begin
  select * into v_me from public.participants where session_id = p_session_id and user_id = v_uid;
  if not found then
    raise exception 'You are not in this game.' using errcode = 'P0002';
  end if;
  if v_me.status = 'active' and v_me.last_seen_at < now() - interval '10 seconds' then
    update public.participants set last_seen_at = now() where id = v_me.id returning * into v_me;
  end if;
  select * into v_session from public.game_sessions where id = p_session_id;

  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', v_session.id,
      'quiz_title', v_session.quiz_title,
      'status', v_session.status,
      'phase', v_session.phase,
      'is_locked', v_session.is_locked,
      'participant_count', v_session.participant_count,
      'state_version', v_session.state_version
    ),
    'me', private.participant_json(v_me)
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Function privileges
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.create_session(uuid, jsonb) from public, anon;
revoke all on function public.get_session_lobby(uuid) from public, anon;
revoke all on function public.set_session_locked(uuid, boolean) from public, anon;
revoke all on function public.remove_participant(uuid, uuid) from public, anon;
revoke all on function public.cancel_session(uuid) from public, anon;
revoke all on function public.create_presenter_link(uuid) from public, anon;
revoke all on function public.claim_presenter(uuid, text) from public, anon;
revoke all on function public.lookup_session(text) from public, anon;
revoke all on function public.join_session(uuid, text, text) from public, anon;
revoke all on function public.leave_session(uuid) from public, anon;
revoke all on function public.get_player_state(uuid) from public, anon;

grant execute on function public.create_session(uuid, jsonb) to authenticated;
grant execute on function public.get_session_lobby(uuid) to authenticated;
grant execute on function public.set_session_locked(uuid, boolean) to authenticated;
grant execute on function public.remove_participant(uuid, uuid) to authenticated;
grant execute on function public.cancel_session(uuid) to authenticated;
grant execute on function public.create_presenter_link(uuid) to authenticated;
grant execute on function public.claim_presenter(uuid, text) to authenticated;
grant execute on function public.lookup_session(text) to authenticated;
grant execute on function public.join_session(uuid, text, text) to authenticated;
grant execute on function public.leave_session(uuid) to authenticated;
grant execute on function public.get_player_state(uuid) to authenticated;
