-- ═════════════════════════════════════════════════════════════════════════════
-- Boss battle, phase 1: a persistent monster the class fights across the quiz.
--
--   * session_battles (one per session): settings and the monster's current HP.
--     Created for every new session (on by default); the teacher can switch it
--     off or change HP / damage in the lobby with set_battle_settings.
--   * Eligibility snapshot: when a question opens, the ids of the active players
--     are stored on the question. Players who join or leave during the question
--     do not change its denominator; unanswered = incorrect.
--   * battle_events (one per question, UNIQUE): the outcome of each question:
--     who attacked, accuracy, damage, HP before/after. Written in the same
--     transaction that closes the question (which already runs exactly once), so
--     the monster can never be hit twice for one question.
--   * game_payload gains a `battle` object; screens animate from it locally. No
--     new broadcast streams and no per-frame traffic.
--
-- Damage = correct answers × base damage (default 3), worked out here only.
-- ═════════════════════════════════════════════════════════════════════════════

create table public.session_battles (
  session_id uuid primary key references public.game_sessions (id) on delete cascade,
  enabled boolean not null default true,
  monster text not null default 'gloomjaw' check (monster ~ '^[a-z]{2,20}$'),
  -- Teacher's HP choice; null = automatic (fits the class size and quiz length at the start).
  hp_setting integer check (hp_setting between 50 and 100000),
  base_damage integer not null default 3 check (base_damage between 1 and 100),
  max_hp integer check (max_hp between 1 and 100000),
  hp integer check (hp >= 0),
  started_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.battle_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  session_question_id uuid not null unique references public.session_questions (id) on delete cascade,
  position integer not null,
  eligible integer not null check (eligible >= 0),
  -- Correct answers among the eligible snapshot (for class accuracy).
  correct_eligible integer not null check (correct_eligible >= 0),
  accuracy numeric(5, 2) not null check (accuracy between 0 and 100),
  -- Every correct, non-removed player attacks (a late joiner's correct answer still hits).
  attackers uuid[] not null default '{}',
  damage integer not null check (damage >= 0),
  hp_before integer not null,
  hp_after integer not null,
  created_at timestamptz not null default clock_timestamp()
);
create index battle_events_session on public.battle_events (session_id, position desc);

alter table public.session_questions
  add column eligible_ids uuid[];

-- Nobody reads or writes these directly; everything goes through the payload / RPCs.
alter table public.session_battles enable row level security;
alter table public.battle_events enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Every new session gets a battle row (on by default).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.create_session_battle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.session_battles (session_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger game_sessions_create_battle
  after insert on public.game_sessions
  for each row execute function private.create_session_battle();

-- Automatic HP: a class answering about 70% correctly defeats the monster on the last questions.
create or replace function private.auto_monster_hp(p_players integer, p_questions integer, p_base_damage integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select least(100000, greatest(50, (round(greatest(p_players, 1) * greatest(p_questions, 1) * p_base_damage * 0.7 / 10.0) * 10)::integer));
$$;

-- At the start: fix the monster's HP.
create or replace function private.start_session_battle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  b public.session_battles;
  v_hp integer;
begin
  select * into b from public.session_battles where session_id = new.id for update;
  if not found or not b.enabled or b.started_at is not null then
    return new;
  end if;
  v_hp := coalesce(b.hp_setting, private.auto_monster_hp(new.participant_count, new.question_count, b.base_damage));
  update public.session_battles set max_hp = v_hp, hp = v_hp, started_at = now() where session_id = new.id;
  return new;
end;
$$;

create trigger game_sessions_start_battle
  before update of status on public.game_sessions
  for each row
  when (old.status = 'lobby' and new.status = 'in_progress')
  execute function private.start_session_battle();

-- ─────────────────────────────────────────────────────────────────────────────
-- Eligibility snapshot when a question opens.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.snapshot_eligible()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.eligible_ids := coalesce((
    select array_agg(p.id order by p.id) from public.participants p
     where p.session_id = new.session_id and p.status = 'active'
  ), '{}');
  return new;
end;
$$;

create trigger session_questions_snapshot_eligible
  before update of status on public.session_questions
  for each row
  when (old.status = 'pending' and new.status = 'open')
  execute function private.snapshot_eligible();

-- ─────────────────────────────────────────────────────────────────────────────
-- Resolving the attack when a question closes (exactly once per question).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.resolve_battle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  b public.session_battles;
  v_attackers uuid[];
  v_eligible integer := coalesce(cardinality(new.eligible_ids), 0);
  v_correct_eligible integer;
  v_damage integer;
  v_after integer;
  v_event uuid;
begin
  select * into b from public.session_battles where session_id = new.session_id for update;
  if not found or not b.enabled or b.hp is null then
    return new;
  end if;

  -- Attack order = the order the correct answers came in.
  select coalesce(array_agg(a.participant_id order by a.answered_at, a.participant_id), '{}')
    into v_attackers
    from public.answers a
    join public.participants p on p.id = a.participant_id and p.status <> 'removed'
   where a.session_question_id = new.id and a.is_correct;

  select count(*) into v_correct_eligible
    from public.answers a
   where a.session_question_id = new.id and a.is_correct and a.participant_id = any (coalesce(new.eligible_ids, '{}'));

  v_damage := cardinality(v_attackers) * b.base_damage;
  v_after := greatest(0, b.hp - v_damage);

  insert into public.battle_events (session_id, session_question_id, position, eligible, correct_eligible, accuracy,
                                    attackers, damage, hp_before, hp_after)
  values (new.session_id, new.id, new.position, v_eligible, v_correct_eligible,
          case when v_eligible = 0 then 0 else round(v_correct_eligible * 100.0 / v_eligible, 2) end,
          v_attackers, v_damage, b.hp, v_after)
  on conflict (session_question_id) do nothing
  returning id into v_event;

  if v_event is not null then
    update public.session_battles set hp = v_after where session_id = new.session_id;
  end if;
  return new;
end;
$$;

create trigger session_questions_resolve_battle
  after update of status on public.session_questions
  for each row
  when (old.status = 'open' and new.status = 'closed')
  execute function private.resolve_battle();

-- ─────────────────────────────────────────────────────────────────────────────
-- The battle as screens see it.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.battle_json(p_session_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'enabled', b.enabled,
    'monster', b.monster,
    'hp_setting', b.hp_setting,
    'base_damage', b.base_damage,
    'max_hp', b.max_hp,
    'hp', b.hp,
    'last', (
      select jsonb_build_object(
        'question_id', e.session_question_id,
        'position', e.position,
        'eligible', e.eligible,
        'correct', e.correct_eligible,
        'accuracy', e.accuracy,
        'attackers', to_jsonb(e.attackers),
        'damage', e.damage,
        'hp_before', e.hp_before,
        'hp_after', e.hp_after
      )
        from public.battle_events e
       where e.session_id = p_session_id
       order by e.position desc, e.created_at desc
       limit 1
    )
  )
    from public.session_battles b
   where b.session_id = p_session_id;
$$;

-- game_payload: as in the Phase 5 migration, plus `battle`.
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
      'board_at', case when v_closed and q.closed_at is not null
                       then q.closed_at + make_interval(secs => s.reveal_ms / 1000.0) end,
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Teacher settings (lobby only).
-- p_settings: { enabled?: boolean, hp?: 50–100000 | null (automatic), base_damage?: 1–100 }
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_battle_settings(p_session_id uuid, p_settings jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_for_update(p_session_id);
  b public.session_battles;
  v_enabled boolean;
  v_hp integer;
  v_damage integer;
begin
  if v_session.status <> 'lobby' then
    raise exception 'Battle settings can only be changed before the game starts.' using errcode = 'P0001';
  end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'Choose the battle settings.' using errcode = 'P0001';
  end if;
  insert into public.session_battles (session_id) values (p_session_id) on conflict do nothing;
  select * into b from public.session_battles where session_id = p_session_id for update;

  v_enabled := b.enabled;
  if p_settings ? 'enabled' then
    if jsonb_typeof(p_settings -> 'enabled') <> 'boolean' then
      raise exception 'Choose on or off for the boss battle.' using errcode = 'P0001';
    end if;
    v_enabled := (p_settings ->> 'enabled')::boolean;
  end if;

  v_hp := b.hp_setting;
  if p_settings ? 'hp' then
    if jsonb_typeof(p_settings -> 'hp') = 'null' then
      v_hp := null;
    elsif jsonb_typeof(p_settings -> 'hp') = 'number' and (p_settings ->> 'hp')::numeric between 50 and 100000
          and (p_settings ->> 'hp')::numeric = trunc((p_settings ->> 'hp')::numeric) then
      v_hp := (p_settings ->> 'hp')::integer;
    else
      raise exception 'Monster HP must be a whole number from 50 to 100000.' using errcode = 'P0001';
    end if;
  end if;

  v_damage := b.base_damage;
  if p_settings ? 'base_damage' then
    if jsonb_typeof(p_settings -> 'base_damage') = 'number' and (p_settings ->> 'base_damage')::numeric between 1 and 100
       and (p_settings ->> 'base_damage')::numeric = trunc((p_settings ->> 'base_damage')::numeric) then
      v_damage := (p_settings ->> 'base_damage')::integer;
    else
      raise exception 'Damage per correct answer must be a whole number from 1 to 100.' using errcode = 'P0001';
    end if;
  end if;

  if v_enabled is not distinct from b.enabled and v_hp is not distinct from b.hp_setting and v_damage = b.base_damage then
    return v_session.state_version;
  end if;
  update public.session_battles set enabled = v_enabled, hp_setting = v_hp, base_damage = v_damage
   where session_id = p_session_id;
  update public.game_sessions set state_version = state_version + 1
   where id = p_session_id returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session.state_version;
end;
$$;

revoke all on function public.set_battle_settings(uuid, jsonb) from public, anon;
grant execute on function public.set_battle_settings(uuid, jsonb) to authenticated;
revoke all on function private.auto_monster_hp(integer, integer, integer) from public;
grant execute on function private.auto_monster_hp(integer, integer, integer) to authenticated, service_role;
grant execute on function private.battle_json(uuid) to authenticated, service_role;
