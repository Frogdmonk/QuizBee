-- ═════════════════════════════════════════════════════════════════════════════
-- Power-ups and shared team energy (boss battle plan, phase 5).
--
-- Team energy (session_battles.energy, 0–100) is earned by the class, worked out
-- inside the exactly-once question resolution:
--   +10 the class reached the mastery bar on a question
--   +15 the class reached it on a recovery question (recovered from a misconception)
--   +10 the class stopped the monster's special attack
--   +5  at least 90 % of the eligible class answered (participation)
--   +5  a weapon was unlocked (teamwork)
--   +1 per 2 correct answers on a final-challenge question (max +10)
--   +5  per question while the Healing Wand is equipped (now available)
-- The teacher spends it on team abilities (use_team_ability):
--   team_shield 30 (blocks one counter-attack heal), group_lightning 40 (8 % of max HP),
--   knowledge_reveal 25 (hides one wrong answer of the open question),
--   final_rally 60 (every hit doubled; final challenge only).
--
-- Power-ups: before the first final-challenge question (or, without levels, the
-- last question of a quiz with 3+ questions) every eligible student is dealt 3
-- applicable power-ups from battle_powerups and picks one (choose_powerup) while
-- that question is held back (draft_ms, 15 s) or open. Anyone who has not picked
-- by the time it closes gets their first option, so every student has the same
-- chance. Each power-up is used once (use_powerup), from then on, and the server
-- validates and applies every effect. None of them reveals the answer.
-- ═════════════════════════════════════════════════════════════════════════════

create table public.battle_powerups (
  key text primary key check (key ~ '^[a-z_]{2,30}$'),
  name text not null,
  description text not null,
  -- 'objective': only offered when a remaining question has a learning objective.
  needs text not null default 'none' check (needs in ('none', 'objective')),
  sort integer not null default 0
);
alter table public.battle_powerups enable row level security;

insert into public.battle_powerups (key, name, description, needs, sort) values
  ('thunder_strike', 'Thunder Strike', 'Your correct answer on this question hits twice as hard.', 'none', 1),
  ('guardian_shield', 'Guardian Shield', 'Blocks the monster''s healing from this question''s counter-attack.', 'none', 2),
  ('xray', 'X-Ray Vision', 'Shows a hint about what this question tests (never the answer).', 'objective', 3),
  ('time_warp', 'Time Warp', 'Adds 5 seconds to this question for everyone.', 'none', 4),
  ('revival', 'Revival Crystal', 'Change your answer once; a correct second try earns half points.', 'none', 5),
  ('scanner', 'Weakness Scanner', 'Reveals the topic and makes every class hit +1 on this question.', 'none', 6),
  ('team_heal', 'Team Heal', 'Restores 20 team energy.', 'none', 7),
  ('comeback', 'Comeback Charge', 'If you missed this idea earlier, your correct answer hits three times as hard.', 'objective', 8);

-- The Healing Wand needed team energy; now it has it.
update public.battle_weapons
   set available = true, passive = 'The class gains 5 team energy every question.',
       special_name = 'Renewal', special = 'Restores 30 team energy at once.', passive_value = 5, special_value = 30
 where key = 'healing';

alter table public.session_battles
  add column energy integer not null default 0 check (energy between 0 and 100),
  add column powerups_enabled boolean not null default true,
  add column draft_ms integer not null default 15000 check (draft_ms between 5000 and 30000),
  add column draft_position integer,
  add column shield_at integer,
  add column lightning_at integer,
  add column rally_at integer,
  add column scan_at integer;

alter table public.session_questions
  add column powerup_draft boolean not null default false,
  add column hidden_option_id uuid references public.session_question_options (id) on delete set null,
  add column time_warp_s integer not null default 0 check (time_warp_s between 0 and 10);

alter table public.battle_events
  add column energy_gain integer not null default 0,
  add column energy_reasons text[] not null default '{}',
  add column shielded boolean not null default false,
  add column lightning integer not null default 0,
  add column rally boolean not null default false,
  add column scan boolean not null default false,
  add column boosted integer not null default 0;

create table public.participant_powerups (
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  offered text[] not null,
  chosen text references public.battle_powerups (key),
  -- offered → held (picked, or auto-picked when the draft question closes) → armed (waiting for this question) → used
  state text not null default 'offered' check (state in ('offered', 'held', 'armed', 'used')),
  draft_question_id uuid not null references public.session_questions (id) on delete cascade,
  armed_question_id uuid references public.session_questions (id) on delete set null,
  hint text,
  used_at timestamptz,
  primary key (session_id, participant_id)
);
alter table public.participant_powerups enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.add_energy(p_session_id uuid, p_amount integer)
returns integer
language sql
volatile
set search_path = ''
as $$
  update public.session_battles set energy = least(100, greatest(0, energy + p_amount))
   where session_id = p_session_id
  returning energy;
$$;

-- The question a team ability / weapon special used now applies to: the open question, or the next one
-- the game will actually play (a recovery question when the mastery gate sends the class there).
create or replace function private.ability_target(p_session public.game_sessions)
returns integer
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_session.status <> 'in_progress' then
    return null;
  end if;
  if p_session.phase = 'question' and exists (
    select 1 from public.session_questions q
     where q.session_id = p_session.id and q.position = p_session.current_position and q.status = 'open'
  ) then
    return p_session.current_position;
  end if;
  if p_session.phase in ('reveal', 'leaderboard') then
    return private.next_position(p_session);
  end if;
  return null;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Opening a question: eligibility, battle mode, holds (phase 4) and the power-up draft.
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
  v_has_final boolean;
  v_has_objective boolean;
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

    -- The power-up draft: before the first final-challenge question (or the last question without levels).
    if b.powerups_enabled and b.draft_position is null and new.role = 'core' and new.battle_mode <> 'defeated' then
      v_has_final := exists (select 1 from public.session_questions q where q.session_id = new.session_id and q.role = 'core' and q.level = 4);
      if (v_has_final and new.level = 4) or (not v_has_final and s.question_count >= 3 and new.position = s.question_count - 1) then
        new.powerup_draft := true;
        update public.session_battles set draft_position = new.position where session_id = new.session_id;
        v_has_objective := exists (select 1 from public.session_questions q
                                    where q.session_id = new.session_id and q.position >= new.position and q.objective <> '');
        insert into public.participant_powerups (session_id, participant_id, offered, draft_question_id)
        select new.session_id, pid,
               (select array_agg(k.key order by md5(pid::text || k.key))
                  from (select bp.key from public.battle_powerups bp
                         where bp.needs = 'none' or (bp.needs = 'objective' and v_has_objective)
                         order by md5(pid::text || bp.key) limit 3) k),
               new.id
          from unnest(new.eligible_ids) as pid
        on conflict (session_id, participant_id) do nothing;
      end if;
    end if;
  end if;

  if new.role = 'recovery' then
    v_extra_ms := s.review_ms;
  elsif new.battle_announce is not null or new.level_start then
    v_extra_ms := 3000;
  end if;
  if new.powerup_draft then
    v_extra_ms := greatest(v_extra_ms, b.draft_ms);
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
-- Resolving a question (phases 1–3) plus team abilities, power-ups and energy.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.resolve_battle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  b public.session_battles;
  w public.battle_weapons;
  s public.game_sessions;
  v_attackers uuid[];
  v_eligible integer := coalesce(cardinality(new.eligible_ids), 0);
  v_correct_eligible integer;
  v_answered_eligible integer;
  v_special boolean := false;
  v_rally boolean;
  v_scan boolean;
  v_shield boolean;
  v_per_hit integer;
  v_boost_extra integer := 0;
  v_boosted integer := 0;
  v_flat integer := 0;
  v_burn integer := 0;
  v_lightning integer := 0;
  v_damage integer;
  v_after integer;
  v_frozen boolean := false;
  v_shielded boolean := false;
  v_target_count integer;
  v_defended boolean;
  v_heal integer := 0;
  v_heal_pct integer;
  v_unlocked boolean := false;
  v_accuracy numeric;
  v_gain integer := 0;
  v_reasons text[] := '{}';
  v_event uuid;
begin
  select * into b from public.session_battles where session_id = new.session_id for update;
  if not found or not b.enabled or b.hp is null then
    return new;
  end if;
  select * into s from public.game_sessions where id = new.session_id;
  if b.weapon is not null then
    select * into w from public.battle_weapons where key = b.weapon;
    v_special := coalesce(b.weapon_armed_at = new.position, false);
  end if;
  v_rally := coalesce(b.rally_at = new.position, false);
  v_scan := coalesce(b.scan_at = new.position, false);
  v_shield := coalesce(b.shield_at = new.position, false);

  select coalesce(array_agg(a.participant_id order by a.answered_at, a.participant_id), '{}')
    into v_attackers
    from public.answers a
    join public.participants p on p.id = a.participant_id and p.status <> 'removed'
   where a.session_question_id = new.id and a.is_correct;

  select count(*) filter (where a.is_correct), count(*)
    into v_correct_eligible, v_answered_eligible
    from public.answers a
   where a.session_question_id = new.id and a.participant_id = any (coalesce(new.eligible_ids, '{}'));

  -- 1. Every correct answer hits; the weapon, the Weakness Scanner and Final Rally change how hard.
  v_per_hit := b.base_damage;
  if w.key = 'thunder' then
    v_per_hit := v_per_hit + w.passive_value;
  elsif w.key = 'crystal' and new.battle_mode = 'normal' then
    v_per_hit := v_per_hit + w.passive_value;
  elsif w.key = 'shadow' and new.battle_mode in ('rage', 'enraged') then
    v_per_hit := v_per_hit + w.passive_value;
  end if;
  if v_special and w.key = 'thunder' then
    v_per_hit := v_per_hit * w.special_value;
  elsif v_special and w.key = 'shadow' then
    v_per_hit := v_per_hit + w.special_value;
  elsif v_special and w.key = 'crystal' then
    v_flat := round(b.max_hp * w.special_value / 100.0)::integer;
  elsif v_special and w.key = 'frost' then
    v_frozen := true;
  end if;
  if v_scan then
    v_per_hit := v_per_hit + 1;
  end if;
  if v_rally then
    v_per_hit := v_per_hit * 2;
  end if;
  if w.key = 'inferno' and b.hp > 0 then
    v_burn := greatest(1, round(b.max_hp * w.passive_value / 100.0)::integer) * case when v_special then w.special_value else 1 end;
  end if;
  if coalesce(b.lightning_at = new.position, false) then
    v_lightning := round(b.max_hp * 0.08)::integer;
  end if;

  -- Personal power-ups armed for this question: Thunder Strike ×2, Comeback Charge ×3 (correct answers only).
  select coalesce(sum(case pp.chosen when 'thunder_strike' then v_per_hit when 'comeback' then 2 * v_per_hit end), 0),
         count(*)
    into v_boost_extra, v_boosted
    from public.participant_powerups pp
   where pp.session_id = new.session_id and pp.state = 'armed' and pp.armed_question_id = new.id
     and pp.chosen in ('thunder_strike', 'comeback')
     and pp.participant_id = any (v_attackers);
  -- Everything armed for this question is spent now (including a revival that was not used to change an answer).
  update public.participant_powerups set state = 'used', used_at = coalesce(used_at, clock_timestamp())
   where session_id = new.session_id and state = 'armed' and armed_question_id = new.id;
  -- The draft question closes: anyone who did not pick gets their first option.
  if new.powerup_draft then
    update public.participant_powerups set chosen = offered[1], state = 'held'
     where session_id = new.session_id and state = 'offered';
  end if;

  v_damage := cardinality(v_attackers) * v_per_hit + v_boost_extra + v_flat + v_burn + v_lightning;
  v_after := greatest(0, b.hp - v_damage);

  -- 2. The special attack: stopped, frozen, shielded, or a counter-attack that heals the monster.
  if new.battle_mode in ('normal', 'rage', 'enraged') and new.battle_target is not null and v_eligible > 0 then
    v_target_count := ceil(v_eligible * new.battle_target / 100.0)::integer;
    v_defended := v_frozen or v_correct_eligible >= v_target_count;
    if not v_defended and v_after > 0 then
      if v_shield then
        v_shielded := true;
      else
        v_heal_pct := case new.battle_mode when 'normal' then b.heal_normal when 'rage' then b.heal_rage else b.heal_enraged end;
        v_heal := round(b.max_hp * v_heal_pct / 100.0)::integer;
        if w.key = 'frost' then
          v_heal := (v_heal * (100 - w.passive_value)) / 100;
        end if;
        v_heal := least(b.max_hp - v_after, v_heal);
        v_after := v_after + v_heal;
      end if;
    end if;
  end if;

  -- 3. Teamwork unlocks a weapon vote (never on a recovery question: its position is beyond the last).
  v_unlocked := b.weapons_enabled
    and v_eligible > 0
    and v_correct_eligible * 100 >= b.unlock_pct * v_eligible
    and v_after > 0
    and new.position < s.question_count - 1
    and (b.last_unlock_position is null or new.position - b.last_unlock_position > b.unlock_cooldown)
    and exists (select 1 from public.battle_weapons x where x.available and x.key is distinct from b.weapon);

  -- 4. Team energy.
  v_accuracy := case when v_eligible = 0 then null else v_correct_eligible * 100.0 / v_eligible end;
  if v_accuracy is not null and v_accuracy >= s.mastery_pct then
    if new.role = 'recovery' then
      v_gain := v_gain + 15; v_reasons := v_reasons || 'recovered'::text;
    else
      v_gain := v_gain + 10; v_reasons := v_reasons || 'mastery'::text;
    end if;
  end if;
  if v_defended then
    v_gain := v_gain + 10; v_reasons := v_reasons || 'defended'::text;
  end if;
  if v_eligible > 0 and v_answered_eligible * 100 >= 90 * v_eligible then
    v_gain := v_gain + 5; v_reasons := v_reasons || 'participation'::text;
  end if;
  if v_unlocked then
    v_gain := v_gain + 5; v_reasons := v_reasons || 'teamwork'::text;
  end if;
  if new.level = 4 and v_correct_eligible >= 2 then
    v_gain := v_gain + least(10, v_correct_eligible / 2); v_reasons := v_reasons || 'final'::text;
  end if;
  if w.key = 'healing' then
    v_gain := v_gain + w.passive_value; v_reasons := v_reasons || 'wand'::text;
  end if;

  insert into public.battle_events (session_id, session_question_id, position, eligible, correct_eligible, accuracy,
                                    attackers, damage, hp_before, hp_after, mode, target_pct, target_count, defended, heal,
                                    unlocked, weapon, per_hit, weapon_bonus, burn, special, frozen,
                                    energy_gain, energy_reasons, shielded, lightning, rally, scan, boosted)
  values (new.session_id, new.id, new.position, v_eligible, v_correct_eligible,
          case when v_eligible = 0 then 0 else round(v_correct_eligible * 100.0 / v_eligible, 2) end,
          v_attackers, v_damage, b.hp, v_after, new.battle_mode, new.battle_target, v_target_count, v_defended, v_heal,
          v_unlocked, b.weapon, v_per_hit, v_damage - cardinality(v_attackers) * b.base_damage - v_lightning, v_burn,
          case when v_special then b.weapon end, v_frozen,
          least(v_gain, 100 - b.energy), v_reasons, v_shielded, v_lightning, v_rally, v_scan, v_boosted)
  on conflict (session_question_id) do nothing
  returning id into v_event;

  if v_event is null then
    return new;
  end if;
  update public.session_battles
     set hp = v_after,
         energy = least(100, energy + v_gain),
         last_unlock_position = case when v_unlocked then new.position else last_unlock_position end
   where session_id = new.session_id;

  if v_unlocked then
    insert into public.battle_votes (session_id, session_question_id, position, offered, options, opens_at, closes_at, voters)
    select new.session_id, new.id, new.position, picks, picks,
           new.closed_at + make_interval(secs => s.reveal_ms / 1000.0),
           new.closed_at + make_interval(secs => (s.reveal_ms + b.vote_ms) / 1000.0),
           coalesce((select array_agg(p.id order by p.id) from public.participants p
                      where p.session_id = new.session_id and p.status = 'active'), '{}')
      from (
        select array_agg(x.key order by md5(new.id::text || x.key)) as picks
          from (select key from public.battle_weapons
                 where available and key is distinct from b.weapon
                 order by md5(new.id::text || key) limit 3) x
      ) o;
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- submit_answer (synchronised-start version) plus the Revival Crystal: one
-- changed answer on the question it was armed for; a correct change earns half.
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
    -- A Revival Crystal armed for this question allows one changed answer, for half points.
    update public.participant_powerups
       set state = 'used', used_at = v_now
     where session_id = v_question.session_id and participant_id = v_me.id
       and chosen = 'revival' and state = 'armed' and armed_question_id = v_question.id;
    if found then
      update public.answers
         set option_id = p_option_id, answered_at = v_now, is_correct = v_correct, points_awarded = v_points / 2,
             response_ms = greatest(0, (extract(epoch from (v_now - v_question.starts_at)) * 1000)::integer)
       where participant_id = v_me.id and session_question_id = v_question.id;
      return jsonb_build_object('status', 'accepted', 'revived', true);
    end if;
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
-- Power-ups (students).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.my_powerup_row(p_session_id uuid)
returns public.participant_powerups
language sql
stable
set search_path = ''
as $$
  select pp.* from public.participant_powerups pp
    join public.participants p on p.id = pp.participant_id
   where pp.session_id = p_session_id and p.user_id = auth.uid() and p.status = 'active';
$$;

-- Pick one of the three offered power-ups, while the draft question is held back or open.
create or replace function public.choose_powerup(p_session_id uuid, p_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  pp public.participant_powerups := private.my_powerup_row(p_session_id);
  q public.session_questions;
begin
  if pp.participant_id is null then
    raise exception 'You have no power-ups to choose.' using errcode = 'P0001';
  end if;
  if not (p_key = any (pp.offered)) then
    raise exception 'That power-up was not offered to you.' using errcode = 'P0001';
  end if;
  if pp.state <> 'offered' then
    return jsonb_build_object('status', 'already', 'chosen', pp.chosen);
  end if;
  select * into q from public.session_questions where id = pp.draft_question_id;
  if q.status <> 'open' then
    return jsonb_build_object('status', 'closed');
  end if;
  update public.participant_powerups set chosen = p_key, state = 'held'
   where session_id = p_session_id and participant_id = pp.participant_id and state = 'offered';
  return jsonb_build_object('status', 'chosen', 'chosen', p_key);
end;
$$;

-- Use my power-up on the open question. Returns { status: 'used' | 'armed', hint? }.
create or replace function public.use_powerup(p_session_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  pp public.participant_powerups := private.my_powerup_row(p_session_id);
  v_session public.game_sessions;
  b public.session_battles;
  q public.session_questions;
  v_hint text;
  v_note text;
begin
  if pp.participant_id is null or pp.state = 'offered' then
    raise exception 'Choose a power-up first.' using errcode = 'P0001';
  end if;
  if pp.state in ('armed', 'used') then
    raise exception 'You have already used your power-up.' using errcode = 'P0001';
  end if;
  select * into v_session from public.game_sessions where id = p_session_id for update;
  select * into q from public.session_questions where session_id = p_session_id and position = v_session.current_position;
  if v_session.status <> 'in_progress' or v_session.phase <> 'question' or q.status <> 'open'
     or clock_timestamp() < q.starts_at or clock_timestamp() > q.deadline_at then
    raise exception 'Use it while a question is running.' using errcode = 'P0001';
  end if;
  select * into b from public.session_battles where session_id = p_session_id for update;

  case pp.chosen
    when 'thunder_strike' then
      update public.participant_powerups set state = 'armed', armed_question_id = q.id
       where session_id = p_session_id and participant_id = pp.participant_id;
      return jsonb_build_object('status', 'armed');
    when 'comeback' then
      if q.objective = '' or not exists (
        select 1 from public.session_questions e
         where e.session_id = p_session_id and e.status = 'closed' and e.objective = q.objective
           and not exists (select 1 from public.answers a where a.session_question_id = e.id and a.participant_id = pp.participant_id and a.is_correct)
      ) then
        raise exception 'You have not missed this idea before: save it for a question you found hard.' using errcode = 'P0001';
      end if;
      update public.participant_powerups set state = 'armed', armed_question_id = q.id
       where session_id = p_session_id and participant_id = pp.participant_id;
      return jsonb_build_object('status', 'armed');
    when 'revival' then
      if not exists (select 1 from public.answers a where a.session_question_id = q.id and a.participant_id = pp.participant_id) then
        raise exception 'Answer first; the crystal lets you change it once.' using errcode = 'P0001';
      end if;
      update public.participant_powerups set state = 'armed', armed_question_id = q.id
       where session_id = p_session_id and participant_id = pp.participant_id;
      return jsonb_build_object('status', 'armed');
    when 'xray' then
      select nullif(o.misconception, '') into v_note
        from public.session_question_options o where o.session_question_id = q.id and o.misconception <> ''
       order by md5(q.id::text || o.id::text) limit 1;
      if q.objective = '' and v_note is null then
        raise exception 'No hint was written for this question: save it for another one.' using errcode = 'P0001';
      end if;
      v_hint := concat_ws(' ',
        case when q.objective <> '' then format('This question tests: %s.', q.objective) end,
        case when v_note is not null then format('Careful, a common trap: %s', v_note) end);
      update public.participant_powerups set state = 'used', used_at = clock_timestamp(), hint = v_hint, armed_question_id = q.id
       where session_id = p_session_id and participant_id = pp.participant_id;
      return jsonb_build_object('status', 'used', 'hint', v_hint);
    when 'guardian_shield' then
      if b.shield_at = q.position then
        raise exception 'A shield is already up for this question: save yours.' using errcode = 'P0001';
      end if;
      update public.session_battles set shield_at = q.position where session_id = p_session_id;
    when 'scanner' then
      if b.scan_at = q.position then
        raise exception 'The weakness is already found for this question: save yours.' using errcode = 'P0001';
      end if;
      update public.session_battles set scan_at = q.position where session_id = p_session_id;
    when 'time_warp' then
      if q.time_warp_s >= 10 then
        raise exception 'This question already has 10 extra seconds: save yours.' using errcode = 'P0001';
      end if;
      update public.session_questions
         set time_warp_s = time_warp_s + 5, deadline_at = deadline_at + interval '5 seconds'
       where id = q.id;
    when 'team_heal' then
      perform private.add_energy(p_session_id, 20);
    else
      raise exception 'Unknown power-up.' using errcode = 'P0001';
  end case;

  update public.participant_powerups set state = 'used', used_at = clock_timestamp(), armed_question_id = q.id
   where session_id = p_session_id and participant_id = pp.participant_id;
  update public.game_sessions set state_version = state_version + 1
   where id = p_session_id returning * into v_session;
  perform private.broadcast_state(v_session);
  return jsonb_build_object('status', 'used');
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Team abilities (teacher, paid with team energy).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.use_team_ability(p_session_id uuid, p_ability text)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_for_update(p_session_id);
  b public.session_battles;
  q public.session_questions;
  v_cost integer;
  v_target integer;
  v_hide uuid;
begin
  select * into b from public.session_battles where session_id = p_session_id for update;
  if not found or not b.enabled or b.hp is null then
    raise exception 'Team abilities need a running boss battle.' using errcode = 'P0001';
  end if;
  v_cost := case p_ability when 'team_shield' then 30 when 'group_lightning' then 40 when 'knowledge_reveal' then 25 when 'final_rally' then 60 end;
  if v_cost is null then
    raise exception 'Unknown team ability.' using errcode = 'P0001';
  end if;
  if b.energy < v_cost then
    raise exception 'Not enough team energy (% of % needed).', b.energy, v_cost using errcode = 'P0001';
  end if;
  v_target := private.ability_target(v_session);
  if v_target is null then
    raise exception 'Use it during a question or before the next one.' using errcode = 'P0001';
  end if;
  select * into q from public.session_questions where session_id = p_session_id and position = v_target;

  case p_ability
    when 'team_shield' then
      if b.shield_at = v_target then raise exception 'A shield is already up for that question.' using errcode = 'P0001'; end if;
      update public.session_battles set shield_at = v_target where session_id = p_session_id;
    when 'group_lightning' then
      if b.lightning_at = v_target then raise exception 'Group Lightning is already charged for that question.' using errcode = 'P0001'; end if;
      update public.session_battles set lightning_at = v_target where session_id = p_session_id;
    when 'knowledge_reveal' then
      if v_target <> v_session.current_position or q.status <> 'open' then
        raise exception 'Knowledge Reveal works on the question that is running.' using errcode = 'P0001';
      end if;
      if q.hidden_option_id is not null then raise exception 'One answer is already hidden.' using errcode = 'P0001'; end if;
      select o.id into v_hide
        from public.session_question_options o
        join public.session_answer_keys k on k.session_question_id = o.session_question_id
       where o.session_question_id = q.id and o.id <> k.correct_option_id
       order by md5(q.id::text || o.id::text) limit 1;
      if v_hide is null or (select count(*) from public.session_question_options where session_question_id = q.id) < 3 then
        raise exception 'This question has too few answers to hide one.' using errcode = 'P0001';
      end if;
      update public.session_questions set hidden_option_id = v_hide where id = q.id;
    when 'final_rally' then
      if b.draft_position is null or v_target < b.draft_position then
        raise exception 'Final Rally is for the final challenge.' using errcode = 'P0001';
      end if;
      if b.rally_at = v_target then raise exception 'Final Rally is already called for that question.' using errcode = 'P0001'; end if;
      update public.session_battles set rally_at = v_target where session_id = p_session_id;
  end case;

  update public.session_battles set energy = energy - v_cost where session_id = p_session_id;
  update public.game_sessions set state_version = state_version + 1
   where id = p_session_id returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session.state_version;
end;
$$;

-- Weapon specials (phase 3) now target the question the game will really play next (a recovery
-- question included), and the Healing Wand's Renewal restores energy at once.
create or replace function public.use_weapon_special(p_session_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_for_update(p_session_id);
  b public.session_battles;
  w public.battle_weapons;
  v_target integer;
begin
  select * into b from public.session_battles where session_id = p_session_id for update;
  if not found or b.weapon is null then
    raise exception 'The class has no weapon yet.' using errcode = 'P0001';
  end if;
  select * into w from public.battle_weapons where key = b.weapon;
  if v_session.status <> 'in_progress' then
    raise exception 'The game is not running.' using errcode = 'P0001';
  end if;
  v_target := private.ability_target(v_session);
  if v_target is null then
    raise exception 'Use it during a question or before the next one.' using errcode = 'P0001';
  end if;
  if b.weapon_armed_at = v_target then
    return v_session.state_version;
  end if;
  if b.weapon_charges <= 0 then
    raise exception 'The % has no charges left.', w.name using errcode = 'P0001';
  end if;
  -- Cooldowns count questions played; a recovery question (1000+) counts as its core question.
  if (case when v_target >= 1000 then v_target - 1000 else v_target end) < coalesce(b.weapon_ready_at, 0) then
    raise exception 'The % is recharging: ready from question %.', w.name, b.weapon_ready_at + 1 using errcode = 'P0001';
  end if;
  update public.session_battles
     set weapon_charges = weapon_charges - 1,
         weapon_armed_at = case when w.key = 'healing' then weapon_armed_at else v_target end,
         weapon_ready_at = (case when v_target >= 1000 then v_target - 1000 else v_target end) + 1 + w.cooldown,
         energy = case when w.key = 'healing' then least(100, energy + w.special_value) else energy end
   where session_id = p_session_id;
  update public.game_sessions set state_version = state_version + 1
   where id = p_session_id returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session.state_version;
end;
$$;

-- Host, lobby only. p_settings: { powerups_enabled?: boolean, draft_seconds?: 5–30 }
create or replace function public.set_powerup_settings(p_session_id uuid, p_settings jsonb)
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
  v_draft integer;
begin
  if v_session.status <> 'lobby' then
    raise exception 'Battle settings can only be changed before the game starts.' using errcode = 'P0001';
  end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'Choose the power-up settings.' using errcode = 'P0001';
  end if;
  insert into public.session_battles (session_id) values (p_session_id) on conflict do nothing;
  select * into b from public.session_battles where session_id = p_session_id for update;
  v_enabled := b.powerups_enabled;
  v_draft := b.draft_ms;
  if p_settings ? 'powerups_enabled' then
    if jsonb_typeof(p_settings -> 'powerups_enabled') <> 'boolean' then
      raise exception 'Choose on or off for power-ups.' using errcode = 'P0001';
    end if;
    v_enabled := (p_settings ->> 'powerups_enabled')::boolean;
  end if;
  if p_settings ? 'draft_seconds' then
    v_draft := private.setting_int(p_settings -> 'draft_seconds', 5, 30, 'Choosing time: 5 to 30 seconds.') * 1000;
  end if;
  if v_enabled = b.powerups_enabled and v_draft = b.draft_ms then
    return v_session.state_version;
  end if;
  update public.session_battles set powerups_enabled = v_enabled, draft_ms = v_draft where session_id = p_session_id;
  update public.game_sessions set state_version = state_version + 1
   where id = p_session_id returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session.state_version;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- What screens see.
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

-- get_game_state (weapons version) plus me.powerup.
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
  v_my_vote jsonb := null;
  v_powerup jsonb := null;
begin
  if v_role is null then
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
      select jsonb_build_object('vote_id', bb.vote_id, 'round', bb.round, 'choice', bb.choice) into v_my_vote
        from public.battle_votes v
        join public.battle_ballots bb on bb.vote_id = v.id and bb.round = v.round and bb.participant_id = v_me.id
       where v.session_question_id = v_question_id;
    end if;
    select jsonb_build_object(
             'state', pp.state,
             'offered', (select jsonb_agg(jsonb_build_object('key', bp.key, 'name', bp.name, 'description', bp.description) order by ord)
                           from unnest(pp.offered) with ordinality as t(k, ord) join public.battle_powerups bp on bp.key = t.k),
             'chosen', pp.chosen,
             'draft_question_id', pp.draft_question_id,
             'armed_question_id', pp.armed_question_id,
             'hint', case when pp.armed_question_id = v_question_id then pp.hint end)
      into v_powerup
      from public.participant_powerups pp
     where pp.session_id = p_session_id and pp.participant_id = v_me.id;
    v_me_json := jsonb_build_object(
      'participant_id', v_me.id,
      'nickname', v_me.nickname,
      'avatar', v_me.avatar,
      'status', v_me.status,
      'answer_option_id', v_my_answer.option_id,
      'last_correct', case when v_closed then v_score.last_correct end,
      'last_points', case when v_closed then v_score.last_points end,
      'score', coalesce(v_score.score, 0),
      'rank', v_score.rank,
      'previous_rank', v_score.previous_rank,
      'streak', coalesce(v_score.streak, 0),
      'correct_count', coalesce(v_score.correct_count, 0),
      'vote', v_my_vote,
      'powerup', v_powerup
    );
  end if;

  return v_payload || jsonb_build_object('role', v_role, 'me', v_me_json);
end;
$$;

revoke all on function public.choose_powerup(uuid, text) from public, anon;
revoke all on function public.use_powerup(uuid) from public, anon;
revoke all on function public.use_team_ability(uuid, text) from public, anon;
revoke all on function public.set_powerup_settings(uuid, jsonb) from public, anon;
grant execute on function public.choose_powerup(uuid, text) to authenticated;
grant execute on function public.use_powerup(uuid) to authenticated;
grant execute on function public.use_team_ability(uuid, text) to authenticated;
grant execute on function public.set_powerup_settings(uuid, jsonb) to authenticated;
