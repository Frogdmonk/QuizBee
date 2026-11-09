# Boss battle upgrade: audit and plan

This is a plan for turning Rally's live quiz into a cooperative boss battle. It was written after reading
the code and migrations as they are on `main` (commit `2a3726c`). Every table and function named below
exists today unless it is marked **new**.

## 1. What exists today

### Architecture

* **Front end:** React 19, Vite, TypeScript, Tailwind 4 and Motion. It is hosted on Vercel.
* **Back end:** Supabase only, with no separate server.
  * Postgres functions run as SECURITY DEFINER with an empty `search_path` and do all game logic.
  * RLS is on for every table, and students never write to tables directly.
  * Supabase Realtime broadcast carries the live updates (sent from Postgres through `realtime.send`).
* **Live screens:**
  * `/presenter/:id` is the projector. It shows the lobby playground and `PresenterGame`.
  * `/teacher/sessions/:id` is the teacher's laptop. It shows `HostLobbyPage` and `HostGame`.
  * `/game/:id` is the phone. It shows `PlayerLobbyPage` and `PlayerGame`.

### Game flow (server-driven, `game_sessions.phase`)

```
lobby ─start_game→ question ─(deadline or everyone answered: advance_if_due / close_question)→ reveal
      ─(reveal_ms, default 5 s: advance_if_due)→ leaderboard ─next_question→ question … → podium
```

* `start_game` copies the quiz into `session_questions`, `session_question_options` and
  `session_answer_keys`, creates `participant_scores` rows, and calls `private.open_question`.
* `open_question` sets `starts_at = now + start_lead_ms` (2 s) and `deadline_at = starts_at + time limit`.
* `submit_answer` scores on the server.
  * It is idempotent because `answers` is unique on (participant, question) and a repeat returns `duplicate`.
  * An answer that arrives too early or too late is refused.
* `private.close_current_question` closes a question exactly once, because it locks the question row and checks
  `status = 'open'`. It then adds the answers into `participant_scores` (score, streak, rank, previous rank)
  and moves the session to `reveal`.
* Every transition increments `state_version` and makes one full-state broadcast, `state`, built by
  `private.game_payload`. Clients apply it if it is newer and refetch with `get_game_state` if they
  missed a message.
* Answer counts go to the host topic only.
* Time is server time throughout. `useServerClock` measures the device's clock offset, and
  `useCountdown` uses it.

### Database (live game)

| Table | Purpose |
|---|---|
| `game_sessions` | phase, status, `state_version`, `current_position`, `participant_count` (max 100), `reveal_ms`, `reactions_enabled`, `start_lead_ms` |
| `participants` | nickname, avatar code, status `active / left / removed`, `joined_at` |
| `session_questions` (+ options, answer keys) | the quiz snapshot: type, prompt, `time_limit_seconds` (5–120), points, `starts_at` / `deadline_at` / `closed_at` |
| `answers` | one per player per question, `is_correct`, `points_awarded`, `response_ms` |
| `participant_scores` | score, `correct_count`, streak, `best_streak`, rank, `previous_rank`, `last_correct` |
| `reaction_limits` | emote rate limit |

Quiz authoring is in `quizzes`, `quiz_questions` and `question_options`. A question has a type (multiple
choice, true/false, image), a prompt, an image, a time limit, points and an explanation. There is **no**
difficulty, learning objective, topic, level, parallel question or per-option misconception note.

### Realtime events today

* Topic `session:{id}:game`:
  * `state` carries the whole payload.
  * `reaction` carries an emote.
* Topic `session:{id}:host`:
  * `state` is a marker.
  * `answer_count` updates the live count.
* Topic `session:{id}:lobby` carries roster changes.

### Animation pieces that can be reused

* **`lib/playground/sim.ts` and `Playground.tsx`:** a deterministic lobby simulation from the shared clock.
  It sends no positions over the network, and one requestAnimationFrame loop writes directly to the DOM.
* **`lib/leaderboard/*` and `Leaderboard.tsx`:** movement themes, events and an animated top 10.
* **`Avatar.tsx`:** avatars are built from a 9-digit code and support moods (happy, laugh, surprised,
  angry, dizzy, sad, confused).
* **`ReactionLayer` and `useReactions`:** emotes shown on the projector.
* **`lib/audio/*`:** the synthesised music and sound effects, which a battle can extend.

## 2. What to reuse, change and add

| Need | Decision |
|---|---|
| Scoring, ranks, leaderboard, reactions, timers, sync | **Keep as is.** The battle is calculated next to the existing scoring and never replaces it. |
| Exactly-once close | **Reuse.** The battle resolves inside the same transaction that closes the question. |
| Eligible-player snapshot | **New**: `session_questions.eligible_count` and `eligible_cutoff`, set when a question opens. Players who join or leave during a question don't change the denominator. |
| Monster HP and the outcome of each question | **New** tables `session_battles` (settings plus current HP) and `battle_events` (one row per question, unique on the question, so it can never be applied twice). |
| Sending the outcome to screens | **Reuse the `state` broadcast.** The payload gains a `battle` object (HP, mode, the last attack and who attacked). There are no extra event streams, and no per-frame or per-projectile traffic. |
| Battle visuals | **New** components under `components/battle/`. Animations play locally from the event data, the same way the playground and leaderboard do. |
| Teacher settings | **New** RPC `set_battle_settings`, plus a "Boss battle" panel in the host lobby with sensible defaults. |
| Question metadata (level, objective, difficulty, misconceptions, parallel questions) | **Change** the quiz editor and `save_quiz` in Phase 4. These need content written by the teacher; the app can't invent it. |
| Weapon vote phase | Phase 3. A small `battle_votes` table plus a vote step that runs between reveal and leaderboard. |

## 3. Risks and how each one is handled

* **The denominator changes mid-question:** the snapshot is taken when the question opens.
  Unanswered questions and players who left count as incorrect.
* **Duplicate processing:** `battle_events` is unique on `session_question_id`, and resolution happens
  inside `close_current_question`, which already runs once under a row lock.
* **Broadcast size:**
  * With 100 players, the list of who attacked adds about 4 KB to the `state` message on the reveal only.
  * Supabase allows messages of a few hundred KB.
* **Projector performance:**
  * Every avatar's attack is drawn with CSS animation.
  * When more than 40 players attack, the number of projectiles drawn is capped. Every attacker still
    swings, but some projectiles merge into a volley.
  * There is no JavaScript per frame.
* **Privacy:**
  * Arena avatars don't show names.
  * Players who missed the question stand guard or cheer instead of looking sad.
  * The answer data was already on the network (`ranks[].last_correct`), so nothing new is exposed.
* **Class size:**
  * Sessions are capped at 100 players. That cap is existing behaviour, not something tested.
  * DB tests can simulate 100 players answering one after another in a single process. That proves the
    result is computed exactly once. It is **not** a load test of 100 real devices, and nobody should claim
    100-student support until a real load test has been run.
* **Fixed boss timers vs the teacher's timers:**
  * In Phase 2, mode timers apply only when the teacher turns "Battle timers" on.
  * Otherwise each question keeps its own time limit.

## 4. Phases

Status: **phases 1–5 built** (migrations `20261113090000_battle_phase1_arena.sql`,
`20261114090000_battle_phase2_modes.sql`, `20261115090000_battle_phase3_weapons.sql`,
`20261116090000_learning_progression.sql` and `20261117090000_powerups_energy.sql`); phase 6 (polish and scale
testing) not started. Team abilities are the teacher's to trigger; class votes on abilities are not built. The Healing Wand is in the weapon table but switched off until team energy exists (phase 5). Question timers were already per question
(5–120 s, set in the quiz editor); phase 2 adds the optional mode timers on top. Difficulty / question-kind
metadata with suggested timers comes with the learning metadata in phase 4.

Each phase ships with its migration, unit and DB tests, a browser check of the projector, phone and host
screens, and docs. Every phase works on its own.

1. **Persistent boss arena.**
   * The monster is created at the start, and its HP is set automatically for the class size or by the
     teacher.
   * After every question, each correct student's avatar attacks.
   * Damage is the number of correct answers times the base damage (3 by default), worked out on the server.
   * The HP bar drops and the monster reacts (hit, stagger, low-HP cracks, defeat).
   * A slim HP strip shows during questions, with the arena on the reveal, a result on the podium and the
     teacher settings in the lobby.
2. **Adaptive battle.**
   * Three modes by HP: Normal, Rage and Enraged.
   * Each mode has a class-accuracy target (50%, 60% and 70%) and optional mode timers.
   * The monster makes special attacks and counter-attacks when the class misses the target, with a
     configurable consequence. Individual damage always counts.
3. **Weapon unlock and voting.**
   * The vote unlocks at 90% accuracy of the eligible snapshot.
   * Each player gets one vote, which is server-validated, with a 10 s countdown.
   * A tie triggers a 5 s runoff, and if that ties too the teacher picks.
   * The teacher can override or cancel the vote.
   * Six weapons with different tactical effects, plus charges and cooldowns.
4. **Learning progression.**
   * Question metadata, three levels and a final challenge.
   * A 75% mastery gate. When the class misses it, the screen shows the answer distribution, the
     misconception note the teacher wrote for the most-picked wrong option, and a parallel question.
   * The teacher can override the gate.
5. **Power-ups and team energy.**
   * Power-ups are earned through participation and improvement.
   * At the end of level 3, each student chooses one of three power-ups.
   * Team abilities are paid for from shared energy, and the server validates every effect.
6. **Polish and scale.**
   * Animation polish and mobile/projector layout passes.
   * Simulated classes of 30, 60 and 100 players.
   * Reconnection and duplicate tests.
