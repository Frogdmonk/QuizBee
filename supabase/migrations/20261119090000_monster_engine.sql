-- ═════════════════════════════════════════════════════════════════════════════
-- Monster Generation Engine, phases 1–2: the session's monster and its difficulty.
--
--   * monster_spec: the generated monster (name, archetype, element, look,
--     abilities, personality, weakness) as JSON, chosen in the lobby by the
--     teacher's screen and validated here. It is fixed once the game starts, so
--     a reload or reconnect always shows the same monster. Null = the default
--     monster named by `monster` (Gloomjaw).
--   * difficulty: auto | easy | medium | hard | epic, chosen by the teacher.
--     It belongs to the session, not to the monster: an impressive-looking
--     monster is never harder because of how it looks. Auto is resolved when
--     the game starts from the quiz (length and question difficulty); an
--     untagged quiz resolves to medium, which is exactly the old behaviour.
--     Difficulty sets the intensity preset (class targets and healing), the
--     rage thresholds (epic: earlier) and scales automatic HP.
--   * HP, damage, modes and every battle result stay on the server as before.
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.session_battles drop constraint if exists session_battles_monster_check;
alter table public.session_battles
  add constraint session_battles_monster_check check (monster ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  add column monster_spec jsonb check (monster_spec is null or (jsonb_typeof(monster_spec) = 'object' and octet_length(monster_spec::text) <= 4000)),
  add column difficulty text not null default 'auto' check (difficulty in ('auto', 'easy', 'medium', 'hard', 'epic')),
  add column difficulty_resolved text check (difficulty_resolved in ('easy', 'medium', 'hard', 'epic'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Validating a monster spec: shape, sizes and known values. Whether the parts fit
-- the archetype is checked by the app, which falls back to the default monster
-- if a stored spec is not one it can draw.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.clean_monster_spec(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' or octet_length(p::text) > 4000 then
    raise exception 'Choose a monster.' using errcode = 'P0001';
  end if;
  if (p ->> 'v') is distinct from '1'
     or coalesce(p ->> 'id', '') !~ '^[a-z0-9][a-z0-9-]{1,39}$'
     or coalesce(p ->> 'archetype', '') !~ '^[a-z][a-z-]{1,29}$'
     or coalesce(p ->> 'rig', '') not in ('blob', 'dragon', 'caster', 'golem', 'brute', 'undead', 'wraith', 'serpent', 'beast', 'phoenix')
     or coalesce(p ->> 'element', '') not in ('fire', 'ice', 'storm', 'shadow', 'poison', 'stone', 'arcane', 'nature', 'water', 'necrotic')
     or coalesce(p ->> 'rarity', '') not in ('common', 'rare', 'epic', 'legendary')
     or coalesce(p ->> 'source', '') not in ('catalogue', 'random', 'surprise')
     or char_length(coalesce(p ->> 'name', '')) not between 1 and 40
     or char_length(coalesce(p ->> 'title', '')) > 60
     or jsonb_typeof(p -> 'palette') is distinct from 'object'
     or jsonb_typeof(p -> 'abilities') is distinct from 'object'
     or jsonb_typeof(p -> 'abilities' -> 'specials') is distinct from 'object'
     or jsonb_typeof(p -> 'parts') is distinct from 'object'
     or jsonb_typeof(p -> 'weakness') is distinct from 'object' then
    raise exception 'That monster could not be used. Pick another one.' using errcode = 'P0001';
  end if;
  foreach v_key in array array['main', 'secondary', 'accent', 'eye'] loop
    if coalesce(p -> 'palette' ->> v_key, '') !~ '^#[0-9a-f]{6}$' then
      raise exception 'That monster could not be used. Pick another one.' using errcode = 'P0001';
    end if;
  end loop;
  if char_length(coalesce(p -> 'abilities' ->> 'primary', '')) not between 1 and 40
     or char_length(coalesce(p -> 'abilities' ->> 'defense', '')) not between 1 and 40
     or char_length(coalesce(p -> 'abilities' -> 'specials' ->> 'normal', '')) not between 1 and 40
     or char_length(coalesce(p -> 'abilities' -> 'specials' ->> 'rage', '')) not between 1 and 40
     or char_length(coalesce(p -> 'abilities' -> 'specials' ->> 'enraged', '')) not between 1 and 40
     or char_length(coalesce(p -> 'weakness' ->> 'topic', '')) > 60 then
    raise exception 'That monster could not be used. Pick another one.' using errcode = 'P0001';
  end if;
  if (select count(*) from jsonb_object_keys(p -> 'parts')) > 8 then
    raise exception 'That monster could not be used. Pick another one.' using errcode = 'P0001';
  end if;
  for v_key, v_value in select key, value from jsonb_each(p -> 'parts') loop
    if jsonb_typeof(v_value) <> 'string' or v_key !~ '^[a-z]{1,20}$' or (v_value #>> '{}') !~ '^[a-z0-9][a-z0-9-]{0,19}$' then
      raise exception 'That monster could not be used. Pick another one.' using errcode = 'P0001';
    end if;
  end loop;
  return p;
end;
$$;

-- The teacher picks or regenerates the monster in the lobby. Null = back to the default.
create or replace function public.set_battle_monster(p_session_id uuid, p_spec jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_for_update(p_session_id);
  v_spec jsonb;
begin
  if v_session.status <> 'lobby' then
    raise exception 'The monster is locked once the game starts.' using errcode = 'P0001';
  end if;
  v_spec := case when p_spec is null or jsonb_typeof(p_spec) = 'null' then null else private.clean_monster_spec(p_spec) end;
  insert into public.session_battles (session_id) values (p_session_id) on conflict do nothing;
  update public.session_battles
     set monster = coalesce(v_spec ->> 'id', 'gloomjaw'), monster_spec = v_spec
   where session_id = p_session_id;
  update public.game_sessions set state_version = state_version + 1
   where id = p_session_id returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session.state_version;
end;
$$;

-- Difficulty presets: class targets and healing per mode, and when Rage and Enraged begin.
create or replace function private.apply_difficulty_preset(p_session_id uuid, p_difficulty text)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.session_battles
     set intensity = case p_difficulty when 'easy' then 'gentle' when 'medium' then 'standard' else 'fierce' end,
         target_normal = case p_difficulty when 'easy' then 40 when 'medium' then 50 else 60 end,
         target_rage = case p_difficulty when 'easy' then 50 when 'medium' then 60 else 70 end,
         target_enraged = case p_difficulty when 'easy' then 60 when 'medium' then 70 else 80 end,
         heal_normal = case p_difficulty when 'easy' then 0 when 'medium' then 3 else 5 end,
         heal_rage = case p_difficulty when 'easy' then 3 when 'medium' then 5 else 8 end,
         heal_enraged = case p_difficulty when 'easy' then 5 when 'medium' then 8 else 12 end,
         rage_at = case p_difficulty when 'epic' then 75 else 70 end,
         enraged_at = case p_difficulty when 'epic' then 40 else 30 end
   where session_id = p_session_id;
$$;

-- The teacher's difficulty. A fixed choice applies its preset at once (still editable under
-- Advanced); auto is resolved when the game starts.
create or replace function public.set_battle_difficulty(p_session_id uuid, p_difficulty text)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_for_update(p_session_id);
begin
  if v_session.status <> 'lobby' then
    raise exception 'Difficulty can only be changed before the game starts.' using errcode = 'P0001';
  end if;
  if p_difficulty is null or p_difficulty not in ('auto', 'easy', 'medium', 'hard', 'epic') then
    raise exception 'Choose automatic, easy, medium, hard or epic.' using errcode = 'P0001';
  end if;
  insert into public.session_battles (session_id) values (p_session_id) on conflict do nothing;
  update public.session_battles set difficulty = p_difficulty where session_id = p_session_id;
  if p_difficulty <> 'auto' then
    perform private.apply_difficulty_preset(p_session_id, p_difficulty);
  end if;
  update public.game_sessions set state_version = state_version + 1
   where id = p_session_id returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session.state_version;
end;
$$;

-- Automatic difficulty from the quiz: a quiz of mostly hard questions gets an easier monster;
-- a long quiz of mostly easy questions a harder one. Untagged quizzes are medium.
create or replace function private.auto_difficulty(p_session_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when tagged >= 4 and hard * 2 >= tagged then 'easy'
    when tagged >= 4 and total >= 10 and easy * 10 >= tagged * 6 then 'hard'
    else 'medium'
  end
  from (
    select count(*) as total,
           count(difficulty) as tagged,
           count(*) filter (where difficulty = 'hard') as hard,
           count(*) filter (where difficulty = 'easy') as easy
      from public.session_questions
     where session_id = p_session_id and role = 'core'
  ) q;
$$;

-- At the start: resolve the difficulty and fix the monster's HP (automatic HP scales with it).
create or replace function private.start_session_battle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  b public.session_battles;
  v_difficulty text;
  v_hp integer;
begin
  select * into b from public.session_battles where session_id = new.id for update;
  if not found or not b.enabled or b.started_at is not null then
    return new;
  end if;
  v_difficulty := case when b.difficulty = 'auto' then private.auto_difficulty(new.id) else b.difficulty end;
  -- Auto applies its preset now, unless the teacher tuned the battle by hand.
  if b.difficulty = 'auto' and b.intensity <> 'custom' then
    perform private.apply_difficulty_preset(new.id, v_difficulty);
  end if;
  v_hp := coalesce(
    b.hp_setting,
    least(100000, greatest(50, (round(
      private.auto_monster_hp(new.participant_count, new.question_count, b.base_damage)
      * case v_difficulty when 'easy' then 0.85 when 'hard' then 1.15 when 'epic' then 1.3 else 1 end / 10.0) * 10)::integer))
  );
  update public.session_battles
     set max_hp = v_hp, hp = v_hp, started_at = now(), difficulty_resolved = v_difficulty
   where session_id = new.id;
  new.reveal_ms := greatest(new.reveal_ms, 7000);
  return new;
end;
$$;

-- battle_json: as in the power-ups migration, plus the monster's identity and difficulty.
create or replace function private.battle_json(p_session_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'enabled', b.enabled,
    'monster', b.monster,
    'monster_spec', b.monster_spec,
    'difficulty', b.difficulty,
    'difficulty_resolved', b.difficulty_resolved,
    'hp_setting', b.hp_setting,
    'base_damage', b.base_damage,
    'max_hp', b.max_hp,
    'hp', b.hp,
    'energy', b.energy,
    'armed', jsonb_build_object('shield', b.shield_at, 'lightning', b.lightning_at, 'rally', b.rally_at, 'scan', b.scan_at),
    'draft_position', b.draft_position,
    'config', jsonb_build_object(
      'intensity', b.intensity,
      'mode_timers', b.mode_timers,
      'rage_at', b.rage_at,
      'enraged_at', b.enraged_at,
      'targets', jsonb_build_object('normal', b.target_normal, 'rage', b.target_rage, 'enraged', b.target_enraged),
      'heal', jsonb_build_object('normal', b.heal_normal, 'rage', b.heal_rage, 'enraged', b.heal_enraged),
      'timers', jsonb_build_object('normal', b.timer_normal, 'rage', b.timer_rage, 'enraged', b.timer_enraged),
      'weapons_enabled', b.weapons_enabled,
      'unlock_pct', b.unlock_pct,
      'unlock_cooldown', b.unlock_cooldown,
      'vote_ms', b.vote_ms,
      'runoff_ms', b.runoff_ms,
      'powerups_enabled', b.powerups_enabled,
      'draft_ms', b.draft_ms
    ),
    'weapon', case when b.weapon is not null then
      private.weapon_json(b.weapon) || jsonb_build_object('charges_left', b.weapon_charges, 'ready_at', b.weapon_ready_at,
                                                         'armed_at', b.weapon_armed_at)
    end,
    'current', (
      select jsonb_build_object('question_id', q.id, 'mode', q.battle_mode, 'target_pct', q.battle_target,
                                'target_count', case when q.battle_target is null or q.eligible_ids is null then null
                                                     else ceil(cardinality(q.eligible_ids) * q.battle_target / 100.0)::integer end,
                                'announce', q.battle_announce,
                                'draft', q.powerup_draft,
                                'hidden_option_id', q.hidden_option_id,
                                'time_warp_s', q.time_warp_s,
                                'powerups_used', (select count(*) from public.participant_powerups pp
                                                   where pp.session_id = s.id and pp.armed_question_id = q.id),
                                'topic', case when b.scan_at = q.position then nullif(coalesce(nullif(q.topic, ''), q.objective), '') end)
        from public.game_sessions s
        join public.session_questions q on q.session_id = s.id and q.position = s.current_position
       where s.id = p_session_id and q.battle_mode is not null
    ),
    'vote', (
      select jsonb_build_object(
        'id', v.id,
        'question_id', v.session_question_id,
        'round', v.round,
        'status', v.status,
        'offered', (select jsonb_agg(private.weapon_json(k) order by ord) from unnest(v.offered) with ordinality as t(k, ord)),
        'options', to_jsonb(v.options),
        'opens_at', v.opens_at,
        'closes_at', v.closes_at,
        'voters', cardinality(v.voters),
        'ballots', (select count(*) from public.battle_ballots bb where bb.vote_id = v.id and bb.round = v.round),
        'round1_counts', v.round1_counts,
        'counts', v.counts,
        'winner', v.winner,
        'decided_by', v.decided_by,
        'resolved_at', v.resolved_at
      )
        from public.game_sessions s
        join public.session_questions q on q.session_id = s.id and q.position = s.current_position
        join public.battle_votes v on v.session_question_id = q.id
       where s.id = p_session_id
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
        'heal', e.heal,
        'unlocked', e.unlocked,
        'weapon', e.weapon,
        'per_hit', e.per_hit,
        'weapon_bonus', e.weapon_bonus,
        'burn', e.burn,
        'special', e.special,
        'frozen', e.frozen,
        'energy_gain', e.energy_gain,
        'energy_reasons', to_jsonb(e.energy_reasons),
        'shielded', e.shielded,
        'lightning', e.lightning,
        'rally', e.rally,
        'scan', e.scan,
        'boosted', e.boosted
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

revoke all on function private.clean_monster_spec(jsonb) from public;
revoke all on function private.apply_difficulty_preset(uuid, text) from public;
revoke all on function private.auto_difficulty(uuid) from public;
grant execute on function private.apply_difficulty_preset(uuid, text) to authenticated, service_role;
grant execute on function private.auto_difficulty(uuid) to authenticated, service_role;
revoke all on function public.set_battle_monster(uuid, jsonb) from public, anon;
revoke all on function public.set_battle_difficulty(uuid, text) from public, anon;
grant execute on function public.set_battle_monster(uuid, jsonb) to authenticated;
grant execute on function public.set_battle_difficulty(uuid, text) to authenticated;
