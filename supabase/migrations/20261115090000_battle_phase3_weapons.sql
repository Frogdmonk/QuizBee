-- ═════════════════════════════════════════════════════════════════════════════
-- Boss battle, phase 3: weapon unlock and class voting.
--
--   * Unlock: when at least unlock_pct (90) % of the question's eligible snapshot
--     answered correctly, the class unlocks a weapon vote. Not on the last
--     question, not once the monster is defeated, and not within unlock_cooldown
--     (2) questions of the previous unlock. Decided inside the exactly-once
--     question resolution, so duplicate answers or nudges can never unlock twice.
--   * The vote (battle_votes, one per question): 3 weapons from the catalogue
--     (not the one already equipped), opening when the attack reveal is over
--     (closed_at + reveal_ms) for vote_ms (10 s). Voters = the players active
--     when the question closed. One ballot per voter per round, never changed
--     (battle_ballots primary key). Everyone voted → it closes at once.
--   * Result: most votes wins. A tie → a runoff round (runoff_ms, 5 s) between the
--     tied weapons; a tie again, or nobody voting → the teacher decides
--     (decide_weapon_vote). Never random. The teacher can also pick or cancel at
--     any time. While a vote is unresolved the game does not move on.
--   * The winner is equipped for the whole class (one weapon at a time; a new one
--     replaces the old). Passive effects apply to every question; the weapon's
--     special has charges and a cooldown and is used when the teacher chooses
--     (use_weapon_special), for the current open question or the next one.
--   * All damage, heals, votes and charges are worked out here; screens animate.
--   * Live tallies go to the host topic only (host + projector), not to phones.
-- ═════════════════════════════════════════════════════════════════════════════

create table public.battle_weapons (
  key text primary key check (key ~ '^[a-z]{2,20}$'),
  name text not null,
  rarity text not null check (rarity in ('rare', 'epic', 'legendary')),
  description text not null,
  passive text not null,
  special_name text not null,
  special text not null,
  -- Numbers used by private.resolve_battle (meaning depends on the weapon; see the seed below).
  passive_value integer not null default 0,
  special_value integer not null default 0,
  charges integer not null default 2 check (charges between 0 and 10),
  cooldown integer not null default 1 check (cooldown between 0 and 10),
  available boolean not null default true,
  sort integer not null default 0
);
alter table public.battle_weapons enable row level security;

insert into public.battle_weapons (key, name, rarity, description, passive, special_name, special, passive_value, special_value, charges, cooldown, available, sort) values
  ('thunder', 'Thunder Blade', 'legendary', 'A sword that crackles with lightning.',
   'Every hit deals +1 damage.', 'Thunderclap', 'Doubles every hit for one question.', 1, 2, 2, 1, true, 1),
  ('inferno', 'Inferno Staff', 'epic', 'A staff topped with a fire that never goes out.',
   'Sets the monster burning: 1% of its HP every question.', 'Ignite', 'Burns five times as hard for one question.', 1, 5, 2, 1, true, 2),
  ('frost', 'Frost Hammer', 'rare', 'A hammer of ice that numbs whatever it strikes.',
   'Halves the monster''s healing from counter-attacks.', 'Deep Freeze', 'Freezes the monster''s special attack for one question.', 50, 0, 2, 1, true, 3),
  ('shadow', 'Shadow Bow', 'epic', 'A bow that finds the cracks in any armour.',
   'Every hit deals +2 damage while the monster is in Rage or Enraged.', 'Weak Spot', 'Every hit deals +3 more for one question.', 2, 3, 2, 1, true, 4),
  ('crystal', 'Crystal Spear', 'rare', 'A spear of living crystal that pierces armour.',
   'Every hit deals +2 damage while the monster''s armour is whole (Normal).', 'Shatter', 'One strike for 10% of the monster''s HP.', 2, 10, 1, 0, true, 5),
  -- Team energy arrives in phase 5; the wand is offered from then on.
  ('healing', 'Healing Wand', 'rare', 'A wand that mends the team.',
   'Restores shared team energy.', 'Renewal', 'Restores a lot of team energy at once.', 0, 0, 2, 1, false, 6);

alter table public.session_battles
  add column weapons_enabled boolean not null default true,
  add column unlock_pct integer not null default 90 check (unlock_pct between 50 and 100),
  add column unlock_cooldown integer not null default 2 check (unlock_cooldown between 0 and 10),
  add column vote_ms integer not null default 10000 check (vote_ms between 5000 and 30000),
  add column runoff_ms integer not null default 5000 check (runoff_ms between 3000 and 15000),
  add column last_unlock_position integer,
  add column weapon text references public.battle_weapons (key),
  add column weapon_charges integer not null default 0 check (weapon_charges >= 0),
  -- The special can be used from this question position on (cooldown).
  add column weapon_ready_at integer,
  -- The question position the special is armed for.
  add column weapon_armed_at integer;

alter table public.battle_events
  add column unlocked boolean not null default false,
  add column weapon text,
  add column per_hit integer,
  add column weapon_bonus integer not null default 0,
  add column burn integer not null default 0,
  add column special text,
  add column frozen boolean not null default false;

create table public.battle_votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  session_question_id uuid not null unique references public.session_questions (id) on delete cascade,
  position integer not null,
  round smallint not null default 1 check (round in (1, 2)),
  -- The three weapons offered, and the ones still in play this round.
  offered text[] not null,
  options text[] not null,
  status text not null default 'open' check (status in ('open', 'teacher', 'done', 'cancelled')),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  voters uuid[] not null default '{}',
  round1_counts jsonb,
  counts jsonb,
  winner text references public.battle_weapons (key),
  decided_by text check (decided_by in ('vote', 'runoff', 'teacher', 'cancelled')),
  resolved_at timestamptz
);
create index battle_votes_session on public.battle_votes (session_id);

create table public.battle_ballots (
  vote_id uuid not null references public.battle_votes (id) on delete cascade,
  round smallint not null,
  participant_id uuid not null references public.participants (id) on delete cascade,
  choice text not null references public.battle_weapons (key),
  created_at timestamptz not null default clock_timestamp(),
  primary key (vote_id, round, participant_id)
);

alter table public.battle_votes enable row level security;
alter table public.battle_ballots enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Resolving a question: hits (+ weapon), the special attack (phase 2), and the unlock.
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
  v_special boolean := false;
  v_per_hit integer;
  v_flat integer := 0;
  v_burn integer := 0;
  v_damage integer;
  v_after integer;
  v_frozen boolean := false;
  v_target_count integer;
  v_defended boolean;
  v_heal integer := 0;
  v_heal_pct integer;
  v_unlocked boolean := false;
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

  select coalesce(array_agg(a.participant_id order by a.answered_at, a.participant_id), '{}')
    into v_attackers
    from public.answers a
    join public.participants p on p.id = a.participant_id and p.status <> 'removed'
   where a.session_question_id = new.id and a.is_correct;

  select count(*) into v_correct_eligible
    from public.answers a
   where a.session_question_id = new.id and a.is_correct and a.participant_id = any (coalesce(new.eligible_ids, '{}'));

  -- 1. Every correct answer hits; the weapon changes how hard.
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
  if w.key = 'inferno' and b.hp > 0 then
    v_burn := greatest(1, round(b.max_hp * w.passive_value / 100.0)::integer) * case when v_special then w.special_value else 1 end;
  end if;
  v_damage := cardinality(v_attackers) * v_per_hit + v_flat + v_burn;
  v_after := greatest(0, b.hp - v_damage);

  -- 2. The special attack: interrupted (or frozen), or a counter-attack that heals the monster.
  if new.battle_mode in ('normal', 'rage', 'enraged') and new.battle_target is not null and v_eligible > 0 then
    v_target_count := ceil(v_eligible * new.battle_target / 100.0)::integer;
    v_defended := v_frozen or v_correct_eligible >= v_target_count;
    if not v_defended and v_after > 0 then
      v_heal_pct := case new.battle_mode when 'normal' then b.heal_normal when 'rage' then b.heal_rage else b.heal_enraged end;
      v_heal := round(b.max_hp * v_heal_pct / 100.0)::integer;
      if w.key = 'frost' then
        v_heal := (v_heal * (100 - w.passive_value)) / 100;
      end if;
      v_heal := least(b.max_hp - v_after, v_heal);
      v_after := v_after + v_heal;
    end if;
  end if;

  -- 3. Teamwork unlocks a weapon vote.
  v_unlocked := b.weapons_enabled
    and v_eligible > 0
    and v_correct_eligible * 100 >= b.unlock_pct * v_eligible
    and v_after > 0
    and new.position < s.question_count - 1
    and (b.last_unlock_position is null or new.position - b.last_unlock_position > b.unlock_cooldown)
    and exists (select 1 from public.battle_weapons x where x.available and x.key is distinct from b.weapon);

  insert into public.battle_events (session_id, session_question_id, position, eligible, correct_eligible, accuracy,
                                    attackers, damage, hp_before, hp_after, mode, target_pct, target_count, defended, heal,
                                    unlocked, weapon, per_hit, weapon_bonus, burn, special, frozen)
  values (new.session_id, new.id, new.position, v_eligible, v_correct_eligible,
          case when v_eligible = 0 then 0 else round(v_correct_eligible * 100.0 / v_eligible, 2) end,
          v_attackers, v_damage, b.hp, v_after, new.battle_mode, new.battle_target, v_target_count, v_defended, v_heal,
          v_unlocked, b.weapon, v_per_hit, v_damage - cardinality(v_attackers) * b.base_damage, v_burn,
          case when v_special then b.weapon end, v_frozen)
  on conflict (session_question_id) do nothing
  returning id into v_event;

  if v_event is null then
    return new;
  end if;
  update public.session_battles
     set hp = v_after,
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
        -- Three different weapons each time (not the one already equipped), in a fixed order per question.
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
-- When the reveal hands over to the leaderboard: after the attack, or after the
-- vote's result has been on screen for 4.5 s. Null while a vote is unresolved.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.board_due_at(p_session_id uuid, p_question_id uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when q.closed_at is null then null
    when v.id is null then q.closed_at + make_interval(secs => s.reveal_ms / 1000.0)
    when v.status in ('done', 'cancelled') then greatest(q.closed_at + make_interval(secs => s.reveal_ms / 1000.0),
                                                          v.resolved_at + interval '4.5 seconds')
    else null
  end
    from public.session_questions q
    join public.game_sessions s on s.id = q.session_id
    left join public.battle_votes v on v.session_question_id = q.id
   where q.id = p_question_id and s.id = p_session_id;
$$;

-- Equip a weapon for the class: full charges, the special usable from the next question.
create or replace function private.equip_weapon(p_session_id uuid, p_weapon text, p_position integer)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.session_battles b
     set weapon = w.key, weapon_charges = w.charges, weapon_ready_at = p_position + 1, weapon_armed_at = null
    from public.battle_weapons w
   where b.session_id = p_session_id and w.key = p_weapon;
$$;

-- Counts the current round and decides: a winner, a runoff, or the teacher. Caller holds the vote row lock.
create or replace function private.resolve_vote(p_vote_id uuid)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v public.battle_votes;
  v_counts jsonb;
  v_max integer;
  v_leaders text[];
  v_session public.game_sessions;
  v_runoff_ms integer;
begin
  select * into v from public.battle_votes where id = p_vote_id;
  if v.status <> 'open' then
    return;
  end if;
  select coalesce(jsonb_object_agg(o.key, (select count(*) from public.battle_ballots bb
                                            where bb.vote_id = v.id and bb.round = v.round and bb.choice = o.key)), '{}'::jsonb)
    into v_counts
    from unnest(v.options) as o(key);
  select max((value)::integer) into v_max from jsonb_each_text(v_counts);
  select array_agg(key order by key) into v_leaders from jsonb_each_text(v_counts) where (value)::integer = v_max;

  if coalesce(v_max, 0) = 0 then
    -- Nobody voted: the teacher decides between all the weapons still in play.
    update public.battle_votes set status = 'teacher', counts = v_counts,
           round1_counts = coalesce(round1_counts, v_counts) where id = v.id;
  elsif cardinality(v_leaders) = 1 then
    update public.battle_votes
       set status = 'done', counts = v_counts, round1_counts = coalesce(round1_counts, v_counts), winner = v_leaders[1],
           decided_by = case when v.round = 1 then 'vote' else 'runoff' end, resolved_at = clock_timestamp()
     where id = v.id;
    perform private.equip_weapon(v.session_id, v_leaders[1], v.position);
  elsif v.round = 1 then
    select runoff_ms into v_runoff_ms from public.session_battles where session_id = v.session_id;
    update public.battle_votes
       set round = 2, options = v_leaders, round1_counts = v_counts, counts = null,
           opens_at = clock_timestamp(), closes_at = clock_timestamp() + make_interval(secs => v_runoff_ms / 1000.0)
     where id = v.id;
  else
    update public.battle_votes set status = 'teacher', options = v_leaders, counts = v_counts where id = v.id;
  end if;

  update public.game_sessions set state_version = state_version + 1
   where id = v.session_id returning * into v_session;
  perform private.broadcast_state(v_session);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- advance_if_due: closes due questions (as before); in the reveal, closes a due
-- vote round, and moves on to the leaderboard only when board_due_at has passed.
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
  v_vote public.battle_votes;
  v_answered integer;
  v_active integer;
  v_due timestamptz;
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
    select * into v_vote from public.battle_votes where session_question_id = v_question.id for update;
    if found and v_vote.status = 'open' and clock_timestamp() >= v_vote.closes_at then
      perform private.resolve_vote(v_vote.id);
      return (select state_version from public.game_sessions where id = p_session_id);
    end if;
    v_due := private.board_due_at(p_session_id, v_question.id);
    if v_due is not null and clock_timestamp() >= v_due then
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

-- The host's own "leaderboard" / "next" buttons wait for an unresolved vote too.
create or replace function private.assert_no_open_vote(p_session public.game_sessions)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.battle_votes v
      join public.session_questions q on q.id = v.session_question_id
     where v.session_id = p_session.id and q.position = p_session.current_position and v.status in ('open', 'teacher')
  ) then
    raise exception 'Finish the weapon vote first: choose a weapon or cancel the vote.' using errcode = 'P0001';
  end if;
end;
$$;

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
  perform private.assert_no_open_vote(v_session);
  update public.game_sessions set phase = 'leaderboard', state_version = state_version + 1
   where id = p_session_id returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session.state_version;
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
begin
  if v_session.id is null then
    return (select state_version from public.game_sessions where id = p_session_id);
  end if;
  if v_session.status <> 'in_progress' or v_session.phase not in ('reveal', 'leaderboard') then
    return v_session.state_version;
  end if;
  perform private.assert_no_open_vote(v_session);
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Voting.
-- Returns { status: 'accepted' | 'duplicate' | 'early' | 'closed' | 'not_eligible' }.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.cast_weapon_vote(p_vote_id uuid, p_weapon text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.battle_votes;
  v_me public.participants;
  v_inserted text;
  v_counts jsonb;
  v_total integer;
begin
  select * into v from public.battle_votes where id = p_vote_id for update;
  if not found then
    raise exception 'Vote not found.' using errcode = 'P0002';
  end if;
  select * into v_me from public.participants
   where session_id = v.session_id and user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'You are not in this game.' using errcode = 'P0002';
  end if;
  if p_weapon is null or not (p_weapon = any (v.options)) then
    raise exception 'That weapon is not in this vote.' using errcode = 'P0001';
  end if;
  if not (v_me.id = any (v.voters)) then
    return jsonb_build_object('status', 'not_eligible');
  end if;
  if v.status <> 'open' or clock_timestamp() > v.closes_at then
    return jsonb_build_object('status', 'closed');
  end if;
  if clock_timestamp() < v.opens_at then
    return jsonb_build_object('status', 'early');
  end if;

  insert into public.battle_ballots (vote_id, round, participant_id, choice)
  values (v.id, v.round, v_me.id, p_weapon)
  on conflict (vote_id, round, participant_id) do nothing
  returning choice into v_inserted;
  if v_inserted is null then
    return jsonb_build_object('status', 'duplicate');
  end if;

  select coalesce(jsonb_object_agg(o.key, (select count(*) from public.battle_ballots bb
                                            where bb.vote_id = v.id and bb.round = v.round and bb.choice = o.key)), '{}'::jsonb),
         (select count(*) from public.battle_ballots bb where bb.vote_id = v.id and bb.round = v.round)
    into v_counts, v_total
    from unnest(v.options) as o(key);
  -- Live tallies for the teacher and the projector only.
  perform private.broadcast(v.session_id, 'host', 'vote_tally',
    jsonb_build_object('vote_id', v.id, 'round', v.round, 'counts', v_counts, 'total', v_total));

  -- Everyone has voted: no need to wait for the timer.
  if v_total >= cardinality(v.voters) then
    perform private.resolve_vote(v.id);
  end if;
  return jsonb_build_object('status', 'accepted');
end;
$$;

-- Host: pick the weapon for the class (any of the three offered), or cancel the vote (p_weapon null).
create or replace function public.decide_weapon_vote(p_session_id uuid, p_weapon text)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions := private.host_session_for_update(p_session_id);
  v public.battle_votes;
begin
  select bv.* into v from public.battle_votes bv
    join public.session_questions q on q.id = bv.session_question_id
   where bv.session_id = p_session_id and q.position = v_session.current_position
     for update of bv;
  if not found or v.status not in ('open', 'teacher') then
    return v_session.state_version;
  end if;
  if p_weapon is null then
    update public.battle_votes set status = 'cancelled', decided_by = 'cancelled', resolved_at = clock_timestamp() where id = v.id;
  elsif p_weapon = any (v.offered) then
    update public.battle_votes set status = 'done', decided_by = 'teacher', winner = p_weapon, resolved_at = clock_timestamp() where id = v.id;
    perform private.equip_weapon(p_session_id, p_weapon, v.position);
  else
    raise exception 'That weapon is not in this vote.' using errcode = 'P0001';
  end if;
  update public.game_sessions set state_version = state_version + 1
   where id = p_session_id returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session.state_version;
end;
$$;

-- Host: use the equipped weapon's special, for the open question or (between questions) the next one.
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
  if v_session.phase = 'question' and exists (
    select 1 from public.session_questions q
     where q.session_id = p_session_id and q.position = v_session.current_position and q.status = 'open'
  ) then
    v_target := v_session.current_position;
  elsif v_session.phase in ('reveal', 'leaderboard') and v_session.current_position + 1 < v_session.question_count then
    v_target := v_session.current_position + 1;
  else
    raise exception 'Use it during a question or before the next one.' using errcode = 'P0001';
  end if;
  if b.weapon_armed_at = v_target then
    return v_session.state_version; -- already armed for that question
  end if;
  if b.weapon_charges <= 0 then
    raise exception 'The % has no charges left.', w.name using errcode = 'P0001';
  end if;
  if v_target < coalesce(b.weapon_ready_at, 0) then
    raise exception 'The % is recharging: ready from question %.', w.name, b.weapon_ready_at + 1 using errcode = 'P0001';
  end if;
  update public.session_battles
     set weapon_charges = weapon_charges - 1, weapon_armed_at = v_target, weapon_ready_at = v_target + 1 + w.cooldown
   where session_id = p_session_id;
  update public.game_sessions set state_version = state_version + 1
   where id = p_session_id returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session.state_version;
end;
$$;

-- Host, lobby only: weapon settings.
-- p_settings: { weapons_enabled?: boolean, unlock_pct?: 50–100, unlock_cooldown?: 0–10,
--               vote_seconds?: 5–30, runoff_seconds?: 3–15 }
create or replace function public.set_weapon_settings(p_session_id uuid, p_settings jsonb)
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
begin
  if v_session.status <> 'lobby' then
    raise exception 'Battle settings can only be changed before the game starts.' using errcode = 'P0001';
  end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'Choose the weapon settings.' using errcode = 'P0001';
  end if;
  insert into public.session_battles (session_id) values (p_session_id) on conflict do nothing;
  select * into b from public.session_battles where session_id = p_session_id for update;
  n := b;
  if p_settings ? 'weapons_enabled' then
    if jsonb_typeof(p_settings -> 'weapons_enabled') <> 'boolean' then
      raise exception 'Choose on or off for weapons.' using errcode = 'P0001';
    end if;
    n.weapons_enabled := (p_settings ->> 'weapons_enabled')::boolean;
  end if;
  if p_settings ? 'unlock_pct' then
    n.unlock_pct := private.setting_int(p_settings -> 'unlock_pct', 50, 100, 'The unlock needs 50% to 100% correct.');
  end if;
  if p_settings ? 'unlock_cooldown' then
    n.unlock_cooldown := private.setting_int(p_settings -> 'unlock_cooldown', 0, 10, 'Questions between unlocks: 0 to 10.');
  end if;
  if p_settings ? 'vote_seconds' then
    n.vote_ms := private.setting_int(p_settings -> 'vote_seconds', 5, 30, 'Voting time: 5 to 30 seconds.') * 1000;
  end if;
  if p_settings ? 'runoff_seconds' then
    n.runoff_ms := private.setting_int(p_settings -> 'runoff_seconds', 3, 15, 'Runoff time: 3 to 15 seconds.') * 1000;
  end if;
  if row(n.*) is not distinct from row(b.*) then
    return v_session.state_version;
  end if;
  update public.session_battles
     set weapons_enabled = n.weapons_enabled, unlock_pct = n.unlock_pct, unlock_cooldown = n.unlock_cooldown,
         vote_ms = n.vote_ms, runoff_ms = n.runoff_ms
   where session_id = p_session_id;
  update public.game_sessions set state_version = state_version + 1
   where id = p_session_id returning * into v_session;
  perform private.broadcast_state(v_session);
  return v_session.state_version;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- What screens see.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.weapon_json(p_key text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('key', w.key, 'name', w.name, 'rarity', w.rarity, 'description', w.description,
                            'passive', w.passive, 'special_name', w.special_name, 'special', w.special,
                            'charges', w.charges, 'cooldown', w.cooldown)
    from public.battle_weapons w where w.key = p_key;
$$;

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
      'timers', jsonb_build_object('normal', b.timer_normal, 'rage', b.timer_rage, 'enraged', b.timer_enraged),
      'weapons_enabled', b.weapons_enabled,
      'unlock_pct', b.unlock_pct,
      'unlock_cooldown', b.unlock_cooldown,
      'vote_ms', b.vote_ms,
      'runoff_ms', b.runoff_ms
    ),
    'weapon', case when b.weapon is not null then
      private.weapon_json(b.weapon) || jsonb_build_object('charges_left', b.weapon_charges, 'ready_at', b.weapon_ready_at,
                                                         'armed_at', b.weapon_armed_at)
    end,
    'current', (
      select jsonb_build_object('question_id', q.id, 'mode', q.battle_mode, 'target_pct', q.battle_target,
                                'target_count', case when q.battle_target is null or q.eligible_ids is null then null
                                                     else ceil(cardinality(q.eligible_ids) * q.battle_target / 100.0)::integer end,
                                'announce', q.battle_announce)
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
        -- Counts are only in the shared state once a round is over (live tallies go to the host topic).
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
        'frozen', e.frozen
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

-- game_payload: as in the phase 1 battle migration, with board_at from private.board_due_at.
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

-- get_game_state: as in the synchronised-start migration, plus me.vote (my ballot in the current round).
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
      'vote', v_my_vote
    );
  end if;

  return v_payload || jsonb_build_object('role', v_role, 'me', v_me_json);
end;
$$;

revoke all on function public.cast_weapon_vote(uuid, text) from public, anon;
revoke all on function public.decide_weapon_vote(uuid, text) from public, anon;
revoke all on function public.use_weapon_special(uuid) from public, anon;
revoke all on function public.set_weapon_settings(uuid, jsonb) from public, anon;
grant execute on function public.cast_weapon_vote(uuid, text) to authenticated;
grant execute on function public.decide_weapon_vote(uuid, text) to authenticated;
grant execute on function public.use_weapon_special(uuid) to authenticated;
grant execute on function public.set_weapon_settings(uuid, jsonb) to authenticated;
