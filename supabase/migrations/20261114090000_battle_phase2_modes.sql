-- ═════════════════════════════════════════════════════════════════════════════
-- Boss battle, phase 2: Normal, Rage and Enraged modes.
--
--   * The mode is fixed when a question opens, from the monster's HP then:
--     above rage_at % (70) Normal, above enraged_at % (30) Rage, otherwise Enraged.
--   * Each mode has a class-accuracy target (Standard: 50 / 60 / 70 %). The
--     monster charges a special attack during the question:
--       - target reached (correct among the eligible snapshot ≥ ceil(eligible × target %)):
--         the class interrupts it;
--       - target missed: the monster counter-attacks and regenerates heal_% of its
--         max HP (Standard: 3 / 5 / 8 %). Never above max HP, never once defeated.
--     Every correct answer still hits first, whatever the outcome.
--   * Optional battle timers (off by default): Rage / Enraged questions use the
--     mode's timer (10 s / 15 s) instead of the question's own; Normal keeps the
--     question's own unless the teacher sets one. Difficulty and time stay separate.
--   * The first question and every change of mode are announced: that question
--     starts 3 s later so the projector and phones can show the new rules.
--   * Battle sessions give the reveal 7 s (attack + counter-attack); sessions
--     with the battle off keep 5 s.
--   * Teacher settings: intensity preset (gentle / standard / fierce) plus every
--     threshold individually (advanced), lobby only.
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.session_battles
  add column intensity text not null default 'standard' check (intensity in ('gentle', 'standard', 'fierce', 'custom')),
  add column mode_timers boolean not null default false,
  add column rage_at integer not null default 70 check (rage_at between 2 and 99),
  add column enraged_at integer not null default 30 check (enraged_at between 1 and 98),
  add column target_normal integer not null default 50 check (target_normal between 1 and 100),
  add column target_rage integer not null default 60 check (target_rage between 1 and 100),
  add column target_enraged integer not null default 70 check (target_enraged between 1 and 100),
  add column heal_normal integer not null default 3 check (heal_normal between 0 and 50),
  add column heal_rage integer not null default 5 check (heal_rage between 0 and 50),
  add column heal_enraged integer not null default 8 check (heal_enraged between 0 and 50),
  -- null = the question's own time limit.
  add column timer_normal integer check (timer_normal between 5 and 120),
  add column timer_rage integer not null default 10 check (timer_rage between 5 and 120),
  add column timer_enraged integer not null default 15 check (timer_enraged between 5 and 120),
  add constraint session_battles_mode_order check (enraged_at < rage_at);

alter table public.session_questions
  add column battle_mode text check (battle_mode in ('normal', 'rage', 'enraged', 'defeated')),
  add column battle_target integer check (battle_target between 1 and 100),
  -- 'intro' (first question), or the new mode when it changed since the previous question.
  add column battle_announce text check (battle_announce in ('intro', 'normal', 'rage', 'enraged'));

alter table public.battle_events
  add column mode text,
  add column target_pct integer,
  add column target_count integer,
  -- null when the question had no special attack (no mode, nobody eligible, monster already defeated).
  add column defended boolean,
  add column heal integer not null default 0 check (heal >= 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- Mode for an HP level.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.battle_mode_for(b public.session_battles)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when b.hp is null or b.max_hp is null then null
    when b.hp <= 0 then 'defeated'
    when b.hp * 100.0 / b.max_hp > b.rage_at then 'normal'
    when b.hp * 100.0 / b.max_hp > b.enraged_at then 'rage'
    else 'enraged'
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Opening a question: eligibility snapshot (phase 1) + the mode, its target,
-- its timer and the announcement.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.snapshot_eligible()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  b public.session_battles;
  v_prev text;
  v_timer integer;
  v_announced boolean := false;
begin
  new.eligible_ids := coalesce((
    select array_agg(p.id order by p.id) from public.participants p
     where p.session_id = new.session_id and p.status = 'active'
  ), '{}');

  select * into b from public.session_battles where session_id = new.session_id;
  if not found or not b.enabled or b.hp is null then
    return new;
  end if;

  new.battle_mode := private.battle_mode_for(b);
  new.battle_target := case new.battle_mode
    when 'normal' then b.target_normal when 'rage' then b.target_rage when 'enraged' then b.target_enraged end;

  select q.battle_mode into v_prev
    from public.session_questions q
   where q.session_id = new.session_id and q.position < new.position and q.battle_mode is not null
   order by q.position desc limit 1;
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

  -- An announcement gets 3 extra seconds before the question appears.
  if new.battle_announce is not null and new.starts_at is not null then
    new.starts_at := new.starts_at + interval '3 seconds';
    new.opened_at := new.starts_at;
    v_announced := true;
  end if;
  if (v_announced or v_timer is not null) and new.starts_at is not null then
    new.deadline_at := new.starts_at + make_interval(secs => new.time_limit_seconds);
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Closing a question: the class attack (phase 1), then the special attack.
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
  v_target_count integer;
  v_defended boolean;
  v_heal integer := 0;
  v_heal_pct integer;
  v_event uuid;
begin
  select * into b from public.session_battles where session_id = new.session_id for update;
  if not found or not b.enabled or b.hp is null then
    return new;
  end if;

  select coalesce(array_agg(a.participant_id order by a.answered_at, a.participant_id), '{}')
    into v_attackers
    from public.answers a
    join public.participants p on p.id = a.participant_id and p.status <> 'removed'
   where a.session_question_id = new.id and a.is_correct;

  select count(*) into v_correct_eligible
    from public.answers a
   where a.session_question_id = new.id and a.is_correct and a.participant_id = any (coalesce(new.eligible_ids, '{}'));

  -- 1. Every correct answer hits.
  v_damage := cardinality(v_attackers) * b.base_damage;
  v_after := greatest(0, b.hp - v_damage);

  -- 2. The special attack: interrupted, or a counter-attack that heals the monster.
  if new.battle_mode in ('normal', 'rage', 'enraged') and new.battle_target is not null and v_eligible > 0 then
    v_target_count := ceil(v_eligible * new.battle_target / 100.0)::integer;
    v_defended := v_correct_eligible >= v_target_count;
    if not v_defended and v_after > 0 then
      v_heal_pct := case new.battle_mode when 'normal' then b.heal_normal when 'rage' then b.heal_rage else b.heal_enraged end;
      v_heal := least(b.max_hp - v_after, round(b.max_hp * v_heal_pct / 100.0)::integer);
      v_after := v_after + v_heal;
    end if;
  end if;

  insert into public.battle_events (session_id, session_question_id, position, eligible, correct_eligible, accuracy,
                                    attackers, damage, hp_before, hp_after, mode, target_pct, target_count, defended, heal)
  values (new.session_id, new.id, new.position, v_eligible, v_correct_eligible,
          case when v_eligible = 0 then 0 else round(v_correct_eligible * 100.0 / v_eligible, 2) end,
          v_attackers, v_damage, b.hp, v_after, new.battle_mode, new.battle_target, v_target_count, v_defended, v_heal)
  on conflict (session_question_id) do nothing
  returning id into v_event;

  if v_event is not null then
    update public.session_battles set hp = v_after where session_id = new.session_id;
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Start: HP (phase 1) and a longer reveal for battle sessions.
-- ─────────────────────────────────────────────────────────────────────────────
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
  new.reveal_ms := greatest(new.reveal_ms, 7000);
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- What screens see: settings, HP, the current question's mode and the last result.
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
    'config', jsonb_build_object(
      'intensity', b.intensity,
      'mode_timers', b.mode_timers,
      'rage_at', b.rage_at,
      'enraged_at', b.enraged_at,
      'targets', jsonb_build_object('normal', b.target_normal, 'rage', b.target_rage, 'enraged', b.target_enraged),
      'heal', jsonb_build_object('normal', b.heal_normal, 'rage', b.heal_rage, 'enraged', b.heal_enraged),
      'timers', jsonb_build_object('normal', b.timer_normal, 'rage', b.timer_rage, 'enraged', b.timer_enraged)
    ),
    'current', (
      select jsonb_build_object('question_id', q.id, 'mode', q.battle_mode, 'target_pct', q.battle_target,
                                'target_count', case when q.battle_target is null or q.eligible_ids is null then null
                                                     else ceil(cardinality(q.eligible_ids) * q.battle_target / 100.0)::integer end,
                                'announce', q.battle_announce)
        from public.game_sessions s
        join public.session_questions q on q.session_id = s.id and q.position = s.current_position
       where s.id = p_session_id and q.battle_mode is not null
    ),
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
        'hp_after', e.hp_after,
        'mode', e.mode,
        'target_pct', e.target_pct,
        'target_count', e.target_count,
        'defended', e.defended,
        'heal', e.heal
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Teacher settings (lobby only).
-- p_settings keys (all optional):
--   enabled boolean · hp 50–100000 | null · base_damage 1–100
--   intensity 'gentle' | 'standard' | 'fierce' (sets targets and heal)
--   mode_timers boolean · rage_at 2–99 · enraged_at 1–98 (below rage_at)
--   targets { normal, rage, enraged } 1–100 · heal { normal, rage, enraged } 0–50
--   timers { normal: 5–120 | null, rage: 5–120, enraged: 5–120 }
-- Changing a target or heal by hand makes the intensity 'custom'.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.setting_int(p_value jsonb, p_min integer, p_max integer, p_message text)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or jsonb_typeof(p_value) <> 'number'
     or (p_value #>> '{}')::numeric <> trunc((p_value #>> '{}')::numeric)
     or (p_value #>> '{}')::numeric not between p_min and p_max then
    raise exception '%', p_message using errcode = 'P0001';
  end if;
  return (p_value #>> '{}')::integer;
end;
$$;

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
  n public.session_battles;
  v_mode text;
begin
  if v_session.status <> 'lobby' then
    raise exception 'Battle settings can only be changed before the game starts.' using errcode = 'P0001';
  end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'Choose the battle settings.' using errcode = 'P0001';
  end if;
  insert into public.session_battles (session_id) values (p_session_id) on conflict do nothing;
  select * into b from public.session_battles where session_id = p_session_id for update;
  n := b;

  if p_settings ? 'enabled' then
    if jsonb_typeof(p_settings -> 'enabled') <> 'boolean' then
      raise exception 'Choose on or off for the boss battle.' using errcode = 'P0001';
    end if;
    n.enabled := (p_settings ->> 'enabled')::boolean;
  end if;
  if p_settings ? 'hp' then
    n.hp_setting := case when jsonb_typeof(p_settings -> 'hp') = 'null' then null
      else private.setting_int(p_settings -> 'hp', 50, 100000, 'Monster HP must be a whole number from 50 to 100000.') end;
  end if;
  if p_settings ? 'base_damage' then
    n.base_damage := private.setting_int(p_settings -> 'base_damage', 1, 100, 'Damage per correct answer must be a whole number from 1 to 100.');
  end if;
  if p_settings ? 'mode_timers' then
    if jsonb_typeof(p_settings -> 'mode_timers') <> 'boolean' then
      raise exception 'Choose on or off for battle timers.' using errcode = 'P0001';
    end if;
    n.mode_timers := (p_settings ->> 'mode_timers')::boolean;
  end if;

  if p_settings ? 'intensity' then
    case p_settings ->> 'intensity'
      when 'gentle' then
        n.intensity := 'gentle';
        n.target_normal := 40; n.target_rage := 50; n.target_enraged := 60;
        n.heal_normal := 0; n.heal_rage := 3; n.heal_enraged := 5;
      when 'standard' then
        n.intensity := 'standard';
        n.target_normal := 50; n.target_rage := 60; n.target_enraged := 70;
        n.heal_normal := 3; n.heal_rage := 5; n.heal_enraged := 8;
      when 'fierce' then
        n.intensity := 'fierce';
        n.target_normal := 60; n.target_rage := 70; n.target_enraged := 80;
        n.heal_normal := 5; n.heal_rage := 8; n.heal_enraged := 12;
      else
        raise exception 'Choose gentle, standard or fierce.' using errcode = 'P0001';
    end case;
  end if;

  if p_settings ? 'targets' then
    if jsonb_typeof(p_settings -> 'targets') <> 'object' then
      raise exception 'Class targets must be percentages from 1 to 100.' using errcode = 'P0001';
    end if;
    foreach v_mode in array array['normal', 'rage', 'enraged'] loop
      if (p_settings -> 'targets') ? v_mode then
        case v_mode
          when 'normal' then n.target_normal := private.setting_int(p_settings -> 'targets' -> v_mode, 1, 100, 'Class targets must be percentages from 1 to 100.');
          when 'rage' then n.target_rage := private.setting_int(p_settings -> 'targets' -> v_mode, 1, 100, 'Class targets must be percentages from 1 to 100.');
          else n.target_enraged := private.setting_int(p_settings -> 'targets' -> v_mode, 1, 100, 'Class targets must be percentages from 1 to 100.');
        end case;
        n.intensity := 'custom';
      end if;
    end loop;
  end if;
  if p_settings ? 'heal' then
    if jsonb_typeof(p_settings -> 'heal') <> 'object' then
      raise exception 'Monster healing must be a percentage from 0 to 50.' using errcode = 'P0001';
    end if;
    foreach v_mode in array array['normal', 'rage', 'enraged'] loop
      if (p_settings -> 'heal') ? v_mode then
        case v_mode
          when 'normal' then n.heal_normal := private.setting_int(p_settings -> 'heal' -> v_mode, 0, 50, 'Monster healing must be a percentage from 0 to 50.');
          when 'rage' then n.heal_rage := private.setting_int(p_settings -> 'heal' -> v_mode, 0, 50, 'Monster healing must be a percentage from 0 to 50.');
          else n.heal_enraged := private.setting_int(p_settings -> 'heal' -> v_mode, 0, 50, 'Monster healing must be a percentage from 0 to 50.');
        end case;
        n.intensity := 'custom';
      end if;
    end loop;
  end if;
  if p_settings ? 'timers' then
    if jsonb_typeof(p_settings -> 'timers') <> 'object' then
      raise exception 'Battle timers must be from 5 to 120 seconds.' using errcode = 'P0001';
    end if;
    if (p_settings -> 'timers') ? 'normal' then
      n.timer_normal := case when jsonb_typeof(p_settings -> 'timers' -> 'normal') = 'null' then null
        else private.setting_int(p_settings -> 'timers' -> 'normal', 5, 120, 'Battle timers must be from 5 to 120 seconds.') end;
    end if;
    if (p_settings -> 'timers') ? 'rage' then
      n.timer_rage := private.setting_int(p_settings -> 'timers' -> 'rage', 5, 120, 'Battle timers must be from 5 to 120 seconds.');
    end if;
    if (p_settings -> 'timers') ? 'enraged' then
      n.timer_enraged := private.setting_int(p_settings -> 'timers' -> 'enraged', 5, 120, 'Battle timers must be from 5 to 120 seconds.');
    end if;
  end if;
  if p_settings ? 'rage_at' then
    n.rage_at := private.setting_int(p_settings -> 'rage_at', 2, 99, 'Rage starts between 2% and 99% HP.');
  end if;
  if p_settings ? 'enraged_at' then
    n.enraged_at := private.setting_int(p_settings -> 'enraged_at', 1, 98, 'Enraged starts between 1% and 98% HP.');
  end if;
  if n.enraged_at >= n.rage_at then
    raise exception 'Enraged must start at a lower HP than Rage.' using errcode = 'P0001';
  end if;

  if row(n.*) is not distinct from row(b.*) then
    return v_session.state_version;
  end if;
  update public.session_battles
     set enabled = n.enabled, hp_setting = n.hp_setting, base_damage = n.base_damage, intensity = n.intensity,
         mode_timers = n.mode_timers, rage_at = n.rage_at, enraged_at = n.enraged_at,
         target_normal = n.target_normal, target_rage = n.target_rage, target_enraged = n.target_enraged,
         heal_normal = n.heal_normal, heal_rage = n.heal_rage, heal_enraged = n.heal_enraged,
         timer_normal = n.timer_normal, timer_rage = n.timer_rage, timer_enraged = n.timer_enraged
   where session_id = p_session_id;
  update public.game_sessions set state_version = state_version + 1
   where id = p_session_id returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session.state_version;
end;
$$;

revoke all on function public.set_battle_settings(uuid, jsonb) from public, anon;
grant execute on function public.set_battle_settings(uuid, jsonb) to authenticated;
