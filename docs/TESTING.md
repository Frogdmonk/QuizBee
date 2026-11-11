# Testing

## Automated tests

```bash
npm test            # everything
npm run test:unit   # Vitest + Testing Library (jsdom)
npm run test:db     # migrations + RLS in PGlite
npm run typecheck
npm run lint
npm run build
```

### Database tests (`tests/integration/db`)

These run the **real migration files** in [PGlite](https://pglite.dev), which is PostgreSQL compiled to
WebAssembly. No Docker or Supabase account is needed. `harness.ts` reproduces the Supabase pieces our SQL depends
on:

* the `anon`, `authenticated`, `service_role` and `supabase_auth_admin` roles,
* Supabase's default privileges (which our migration deliberately revokes),
* `auth.users`, `auth.uid()` and `auth.jwt()` driven by `request.jwt.claims`.

`as(db, actor, fn)` runs queries as a specific API role with matching JWT claims, which is exactly how RLS sees
a PostgREST request.

**What they do not cover:** GoTrue (real sign-up emails), PostgREST HTTP behaviour, Realtime and Storage. Those
are covered by the manual checklist below now, and by Playwright and k6 against a real project in Phase 6.

### Phase 1 coverage

| Area | Tests |
|---|---|
| Profile trigger | name from metadata, email fallback, truncation, no profile for anonymous users |
| RLS | own-row read and update; cross-tenant update matches 0 rows; protected columns; no insert/delete; anon denied; anonymous students see nothing |
| RPC | `ensure_teacher_profile` creates missing profiles idempotently; refuses anonymous sessions and the anon role |
| Secure defaults | new tables and functions are **not** accessible to API roles unless granted |
| Frontend | env parsing and **service-role key refusal**; open-redirect guard; Zod schemas; error mapping; route guards |

### Phase 2a coverage (quizzes)

| Area | Tests |
|---|---|
| `save_quiz` | create with ordered questions and options; full replace on update; incomplete drafts allowed; 10 invalid-input cases (title, type, time, points, lengths, >4 answers, two correct answers, bad image paths); atomic rollback |
| Publishing | blocks empty and incomplete quizzes with precise messages; type-specific rules (true/false, picture answers); published quizzes must stay complete; archive and restore |
| `duplicate_quiz` | independent draft copy with all questions and options |
| Access control | other teachers see and change nothing; owner cannot write tables directly (RPC only); students and the anon role have no access; delete cascades |
| Storage | public bucket with a 2 MB image-only limit; teachers write only to their own folder; students cannot upload; no cross-teacher deletes |
| Frontend | publish rules mirror the SQL; editor reducer (reorder, one correct answer, 2–4 answers, true/false locked, duplicate, insert position, **edits made during a save stay unsaved**); image sizing; relative time |

### Phase 2c coverage (workspaces and sharing)

| Area | Tests |
|---|---|
| Workspaces | owner membership on create; name validation; 20-workspace cap; member names visible to members only; only the owner renames, removes and deletes; owner cannot leave; no direct table writes |
| Invite links | 43-character token returned once, only its hash stored and the hash column not selectable; owner-only creation; preview; idempotent join counted once; revoked, expired and made-up tokens rejected; 7-day expiry; 10 active links cap; students and anon refused |
| Sharing | private by default; open to everyone with view; chosen members only; highest grant wins; view cannot edit, copy or publish; copy creates an independent draft and logs it; edit saves for everyone with `updated_by`, `revision` and the activity log; stale revision rejected (hint `quiz_revision_conflict`), missing revision still accepted; publish permission only with edit; editors never archive; settings validation; clearing makes it private; removal, leaving, workspace and quiz deletion revoke access; grantees cannot delete, duplicate or re-share; grant visibility; students and anon refused |
| Frontend | access ordering and effective access; share-dialog draft round-trip, publish flag dropped below edit, order-independent change detection; invite URLs; name validation; revision excluded from the payload and fingerprint and advanced after save; conflict detection |

### Phase 3 coverage (live sessions)

| Area | Tests |
|---|---|
| `create_session` | 6-digit PIN, player limit validation (2–100), published quizzes only, owner or **edit** grantee only (view refused), 5 open sessions per host, stale lobbies (12 h) cancelled and their PIN freed, students and anon refused |
| Joining | lookup by PIN; join is idempotent per device and can change nickname and avatar; duplicate nicknames ignore case, spacing and punctuation; 9 invalid-nickname cases (length, symbols, invisible characters, blocked words with look-alikes and repeated letters); other scripts and innocent words accepted; avatar code validation; lock and player limit (existing players can still update); teachers and anon cannot join; ended sessions; **wrong-PIN throttle** (10 per 10 minutes); leave and rejoin |
| Host controls | remove (idempotent, cannot rejoin from the same device, nickname freed); only the host can lock, remove, close, read the lobby or create projector links; closing ends the session for everyone |
| Table access | hosts read their own sessions and rosters but not `presenter_key_hash` or `user_id`; other teachers, students and anon read nothing; nobody writes tables directly |
| Projector | 43-character key, wrong key refused, claim is idempotent, presenter is read-only, a new link disconnects old projectors |
| Realtime | the exact broadcasts per action and topic; the lobby count is throttled; the game topic never carries user ids; receive authorised per role (host: all; player: game and lobby; projector: host and game; removed players, strangers and other teachers: none); unknown topics refused; **nobody can send** |
| Frontend | avatar codes match the DB pattern, presets valid and unique, random always valid; nickname rules mirror the SQL cases; PIN helpers; host-event reducer (dedupe, update, remove, stale versions ignored) |

### Phase 4 coverage (game engine and leaderboard)

| Area | Tests |
|---|---|
| Database (`phase4-game.test.ts`) | snapshot at start (editing the quiz mid-game changes nothing); needs a player; host only; stale versions are no-ops; correctness, distribution and explanation hidden until close; no table access for anyone; accepted / duplicate / late / closed; wrong-question options, outsiders and removed players refused; speed scoring (1000 at full time, 750 at half, 0 wrong) and flat scoring; shared ranks, previous rank, streaks; full game to podium; `advance_if_due` only when due; double close; end game; state broadcasts carry no answer key; late join ranked from the next close; locked game refuses late joins |
| Engine (`leaderboard-engine.test.ts`) | every movement band and configurable thresholds; 20 themes (8/7/5); every tier has ≥2 themes; category and intensity respected; last 3 themes avoided; fallback when themes fail; 10th→1st legendary comeback and takeover; champion defence; near miss, rivalry, streak only from real gaps; 10 students planned with 80–120 ms stagger; 1st→10th fall; all 10 holding; engine never mutates scores; duplicate / stale / newer updates; rapid updates without repeats |
| Component (`leaderboard-component.test.tsx`) | previous standings first then server order; interruption by a newer update; late older update ignored; no duplicate rows through rapid updates; shared ranks on equal scores; reduced motion shows the final board at once with no props; all 10 students animate together |

### Synchronised start coverage

| Area | Tests |
|---|---|
| Database | start is scheduled ~2 s ahead and the deadline is a full time limit after it; answers before the start are refused (`early`) and accepted after; two players answering at the same offset from the start score identically (points do not depend on delivery); the open broadcast carries the whole question with no answer key, scores or pin; the close broadcast carries the correct option, counts, top-10 and a rank row per player; broadcast and `get_game_state` agree |
| Sync logic (`game-sync.test.tsx`) | broadcasts apply only when newer (duplicates / late ones return the same state); the player's pick resets per question and survives the reveal; own rank and result come from the rank rows, and results show only after a close; late joiners keep their numbers; clock offset uses the median of the fastest round trips; a phone that receives the question late still unlocks at the same instant; the unlock fires at the exact moment, not the next tick; a phone with a wrong clock agrees once its offset is applied |
| Screens (`game-screens.test.tsx`) | projector and phone show "Get ready" with no question text until the start; phone answers are unavailable then enabled; an answer is sent once and remembered; "too early" is not locked in; the teacher's projector shows the controls and Space sends one version-guarded command; a projector-link projector shows none; Space never ends a running question |

### Phase 5 coverage (leaderboard after every question, reactions, playground)

| Area | Tests |
|---|---|
| Database (`phase5-reactions.test.ts`) | the reveal carries `board_at` = close + 5 s; `advance_if_due` moves a finished reveal to the leaderboard and not before, only once, also after the last question; outsiders cannot nudge; lobby reactions broadcast with name and avatar; unlisted reactions are refused; during a question only after answering; reveal allowed; 5 per 8 s with a retry time; the teacher switch works and is broadcast; players cannot change it; removed players cannot react; nobody can read the rate-limit table |
| Playground (`playground-sim.test.ts`) | two screens agree exactly whenever they opened and whatever order they list players; different sessions differ; characters stay in bounds and never overlap; they never all walk in lockstep; collisions trigger several reaction kinds with faces and bubbles; repeated collisions usually mean anger; size scales with the crowd; reduced-motion layout; 100 players under 8 ms per frame |
| Reactions (`reactions.test.tsx`) | valid reactions map to emotes; unknown, malformed and delayed events are dropped; client list equals the server list; the projector lane shows the newest 14 with names |

### Boss battle phase 1 coverage

| Area | Tests |
|---|---|
| Database (`battle-phase1.test.ts`) | every new session has a battle (on, automatic HP, damage 3); the start fixes HP to the class size; teacher HP/damage/off settings, validated, broadcast, host only, lobby only; damage = correct × base, HP falls, attackers in answer order; one result per question however often it is closed or nudged; joins/leaves during a question don't change the denominator (a late joiner's correct answer still hits); removed players don't attack; HP stops at 0 and later questions still resolve; battle off = nothing recorded, scoring unchanged; 100 players answering one after another → exactly one result, 270 damage, payload under 20 KB |
| Logic and screens (`battle.test.tsx`) | the formation fits 1–100 students without overlap; attack timing is identical on every screen, varies per student and per question, caps projectiles at 40 while counting every hit; stage and hit thresholds; the lobby HP estimate equals the server formula; payload parsing; only a started battle is active and only the current question's attack plays; the arena shows monster, health and every student without names; the phone card says whether my answer hit |

Machine check in Chromium (mocked server, not real devices): 30 students: 27 attack, 3 cheer, the monster
flinches during the hits and staggers at the end, HP lands on the server's figure; 100 students: 60 fps median
on a desktop during the attack (not measured on a low-end projector PC); no horizontal overflow at 1440×900,
1024×768 and 390×844.

### Boss battle phase 2 coverage (modes)

| Area | Tests |
|---|---|
| Database (`battle-phase2.test.ts`) | first question Normal, announced, starts ~5 s ahead, target as a head count; reveal 7 s; mode follows HP at open (70 % → Rage), announced only on change, Enraged at 30 %; Rage 6/10 stops it (no heal), 5/10 misses it (hits count, +5 % HP); 30 students: 18 is exactly the target; heal capped at max HP, none when the hits reach 0, no special attack once defeated or with nobody eligible; battle timers off by default, on = Rage 10 s with the deadline following; presets, custom thresholds, validation |
| Logic and screens (`battle.test.tsx`) | custom thresholds; payload parsing of config / current / outcome; the question's rules, HUD note and timer; reveal "stopped" banner with HP only falling; reveal "missed": hits first, then the class braces, then the heal; phone wording; the announcement text |

Machine check in Chromium (mocked server): announcement, Rage question with the charging note, "stopped"
reveal (stunned monster), counter-attack sequence (400 → 364 → shock wave → 396), phone announcement /
question / outcome, advanced settings validation; no horizontal overflow.

### Boss battle phase 3 coverage (weapons and voting)

| Area | Tests |
|---|---|
| Database (`battle-phase3.test.ts`) | 9/10 unlocks a vote of 3 (never the Healing Wand), 8/10 does not; the game waits for the vote; never on the last question, not within the 2-question cooldown, only once per question; one vote per student, early / duplicate / not-eligible / not-offered refused, tallies on the host topic only; most votes wins when time is up, the weapon is equipped and the leaderboard follows; everyone voted closes at once; tie → runoff → teacher, host commands blocked meanwhile; no votes → teacher; cancel; players cannot decide; each weapon's passive and special (Thunder, Frost, Inferno, Crystal incl. charges, Shadow in Rage), cooldown and charges; weapon settings validated, lobby only |
| Logic and screens (`battle-weapons.test.tsx`) | payload parsing; the vote belongs to the current question; when the special can be used; weapon projectiles; projector vote screen (message, counts, countdown, no controls on a projector link); teacher tie-break and cancel; phone: one tap, then only the choice; reload shows the server's record; runoff offers the tied weapons; teacher / result wording; avatars hold the weapon; effect and unlock banners |

Machine check in Chromium (mocked server): unlock banner after the attack, vote screen with the teacher's
controls, read-only projector without them, tie for the teacher, equipped screen (30 avatars get the weapon),
Thunderclap reveal, phone vote / voted / equipped, teacher vote panel and special button; no overflow.

### Learning progression coverage (battle plan phase 4)

| Area | Tests |
|---|---|
| Database (`learning.test.ts`) | saving levels, objectives, kinds, misconception notes and recovery questions; duplicates keep them; bad metadata refused; unfinished recovery blocks publishing; snapshot: recovery held back at 1000+, level starts; reveal names the most common mix-up with counts (no names) and the mastery result; below 75 % "next" plays the recovery question after an 8 s review, then continues; 75 % passes; no recovery written moves on; the teacher's skip (players can't); weak objectives at the final challenge; learning report at the podium; a recovery question plays once; mastery off; settings validated, lobby only; recovery questions attack but never unlock a weapon |
| Logic and screens (`learning.test.tsx`, `quiz-editor.test.ts`) | recovery completeness; save payload; suggested timer and "add a recovery question" in the editor; payload parsing with old-server defaults; review screen; mix-up note only when meaningful; mastery banner wording and the skip button; final-challenge weak objectives; the learning report |

Machine check in Chromium (mocked server): review before a recovery question (projector, phone), final-challenge
announcement, reveal with the mix-up, leaderboard with the mastery check and the teacher's skip button, teacher
podium report, lobby learning settings, the editor's Learning section (suggested timer, misconception fields,
recovery question); no overflow.

### Power-ups and team energy coverage (battle plan phase 5)

| Area | Tests |
|---|---|
| Database (`powerups.test.ts`) | energy for mastery / defending / participation with reasons, capped at 100; team abilities need energy, teacher only; Team Shield blocks the heal, Group Lightning 8 %; Knowledge Reveal hides a wrong answer once; Final Rally only in the final challenge; the draft before the first final question (3 different offers, 15 s, one pick, "already"), auto-pick at close, no second draft, quiz without levels; Thunder Strike, Comeback Charge (needs an earlier miss), Revival Crystal (one change, half points), X-Ray hint (no answer, only for me), Time Warp (+5 s, max 10, not wasted), Weakness Scanner, Guardian Shield, Team Heal; Healing Wand passive and Renewal |
| Logic and screens (`powerups.test.tsx`) | parsing; ability rules mirror; draft pick; Revival waits for an answer; X-Ray hint; energy meter; team ability buttons; removed answer label; reveal team line |

Machine check in Chromium (mocked server): projector draft, final question with energy, Time Warp, weakness and
a removed answer, teacher's ability buttons, reveal with Final Rally / Lightning / strikes / energy; phone
draft, X-Ray hint with the removed answer disabled, held power-up; host abilities; no overflow.

### Question import from ChatGPT JSON coverage

| Area | Tests |
|---|---|
| Logic and dialog (`quiz-import.test.tsx`) | the prompt (count, mix, students, grounding and JSON-only rules, schema); the sample converts to native multiple-choice and true/false questions that pass the publish rules and save payload; True listed first whatever ChatGPT's order; per-question errors with number and field (wrong correct answer, missing explanation, unsupported type, answer given as text, empty, duplicate, not True/False, 5 options, bad difficulty), nothing dropped; broken / cut-off / curly-quote / empty / list / too-long input; code fence and chat text removed with a note; questions already in the quiz; the 100-question limit; review checks after edits; the reducer replaces the blank starter question, fills an empty title and ignores a repeated import; the dialog flow from prompt to "Add"; no network or AI calls in the feature's code |

Machine check in Chromium (mocked server): prompt step, partly broken JSON with per-question errors and "Review the 1
valid question only", sample validated, review and edit, questions added to a new quiz (title filled, Publish READY),
phone width without overflow; the only outside requests were the app's usual teacher-profile reads.

## Manual checklist: importing questions from ChatGPT

1. Open **My Quizzes → New quiz** and press **Import using ChatGPT** under the question list.
2. Choose the number of questions and the mix, press **Copy ChatGPT prompt**, and paste it into ChatGPT with a PPTX.
3. Paste ChatGPT's answer and press **Validate JSON**. Every question is listed with a tick or its problems.
4. **Review questions**: edit a question, change the correct answer, delete one, move one. **Add N questions to the quiz**.
5. Save the quiz and publish it, then host it: the imported questions time, score and show on the leaderboard like any other.
6. Open the import again and paste the same JSON: each question is reported as "already in your quiz".

## Manual checklist: power-ups and team energy (projector + 3 phones)

Run `20261117090000_powerups_energy.sql` after the learning migration. Use a quiz with a final-challenge question.

| # | Step | Expected |
|---|---|---|
| 1 | Play a question where everyone answers and 2 of 3 are right | The reveal says "+N team energy (mastery, defended, everyone joined in)"; the energy bar fills |
| 2 | Host: Team Shield during a question, then let the class miss the target | "… blocked by a shield!", no healing |
| 3 | Reach the final challenge | Projector: "Choose your power-up!"; phones: three choices; one phone doesn't choose → it gets its first option |
| 4 | Phone with X-Ray: Use | A hint about the objective (not the answer) on that phone only |
| 5 | Phone with Time Warp: Use | Everyone's timer gains 5 s |
| 6 | Phone with Revival: answer, Use, answer again | The second answer counts, for half points; a third tap does nothing |
| 7 | Host: Knowledge Reveal | One wrong answer greys out on every screen |

## Manual checklist: learning progression (projector + 3 phones)

Run `20261116090000_learning_progression.sql` after the battle migrations.

| # | Step | Expected |
|---|---|---|
| 1 | Edit a quiz: give questions levels 1, 2, 3 and Final; objectives; misconception notes; a recovery question on Q1; set a kind and press "Use N s" | Saves; publishing refuses an unfinished recovery question |
| 2 | Start; Q1 | "Level 1 · Foundations" before Q1 (on the projector and phones) |
| 3 | Only 1 of 3 phones answers Q1 correctly | Reveal: "Common mix-up: …" with the note; leaderboard: "Mastery check: 33% (75% needed). A recovery question … comes next" |
| 4 | Next | "Let's fix this together": the most common pick, its note, the right answer, then the recovery question (header "Recovery · Q1") |
| 5 | Next after the recovery question | Q2 (not Q1 again) |
| 6 | Fail a question with a recovery question; on the host page press "Skip the recovery question"; Next | The next core question comes |
| 7 | Reach the final challenge after missing an objective | "Final challenge · Everything together" names that objective |
| 8 | End | The host page shows "What the class learned" per objective |

## Manual checklist: boss battle phase 3 (projector + 3 phones)

Run `20261115090000_battle_phase3_weapons.sql` after the phase 2 migration. With 3 players, 90 % means all 3.

| # | Step | Expected |
|---|---|---|
| 1 | All 3 phones answer a question correctly | After the attack: "100% correct: weapon unlocked!", then the vote screen on the projector and phones |
| 2 | Phones vote 2 for one weapon, 1 for another | Live counts on the projector and host page; the vote closes at once when all 3 voted; "… equipped!", every avatar gets the weapon; leaderboard ~4.5 s later |
| 3 | Next unlock (after the cooldown): two phones vote different weapons, the third doesn't vote | A runoff between the two; if it ties again, "Your teacher chooses"; pick one on the host page |
| 4 | Tap a weapon twice / reload a phone during the vote | Only one vote counts; after the reload the phone shows "You voted …" |
| 5 | Host: press the weapon's special during a question | The button shows "armed"; the reveal names the effect (e.g. "Thunderclap! Every hit doubled"); a charge is used and the button says when it is ready again |
| 6 | Host: Cancel vote | "No new weapon this time", the game moves on |

## Manual checklist: boss battle phase 2 (projector + 3 phones)

Run `20261114090000_battle_phase2_modes.sql` after the phase 1 migration.

| # | Step | Expected |
|---|---|---|
| 1 | Host lobby: Battle intensity Standard, Battle timers on; set HP to 60, damage 10 | The description lists 50/60/70 % and 3/5/8 % |
| 2 | Start | Projector and phones: "Gloomjaw appears!" with the rule for 3 phones (2 of 3 needed), a 5 s count, then the question |
| 3 | 1 of 3 answers correctly | Reveal: the hit, then "Tail Swipe!", the class braces, the monster heals; phones say the same |
| 4 | Next question (HP now ≤ 70 %) | "Gloomjaw is in a RAGE!", 10 seconds per question; the HUD says "Riddle Roar charging · 2 of 3 correct needed" |
| 5 | All 3 answer correctly | "Riddle Roar stopped!", stunned monster, no healing |
| 6 | Reload a phone during a Rage question | Same mode, note and timer come back |

## Manual checklist: boss battle phase 1 (projector + 3 phones)

Run the migration `20261113090000_battle_phase1_arena.sql` first.

| # | Step | Expected |
|---|---|---|
| 1 | Host lobby → "Boss battle" | On by default, Automatic HP with an estimate, damage 3; switching or saving updates without reload |
| 2 | Start, then play a question where 2 of 3 phones answer correctly | Projector reveal: the right answer on top, the arena below; 2 avatars attack, 1 cheers; HP drops by 6 |
| 3 | Look at the phones during that reveal | Correct phones: "Your attack hit Gloomjaw! −3"; the other: "Your class hit Gloomjaw…"; same HP on all |
| 4 | Reload the projector during a reveal | The same HP and result come back |
| 5 | Set HP to 50 and damage to 10, play until HP reaches 0 | The monster is defeated (grey, X eye), victory fanfare; the remaining questions still play; the podium says "Gloomjaw is defeated!" |
| 6 | Switch the battle off in the lobby | The game is exactly the old quiz |

## Manual checklist: Phase 5 (projector + 3 phones)

| # | Step | Expected |
|---|---|---|
| 1 | Open the projector (teacher browser) and 3 phones; join | Characters walk around the projector lobby, bump, react; the same scene on the host page |
| 2 | Tap emotes on a phone in the lobby | The character acts it out with the emoji above it on the projector and host page; other phones show it in the small row |
| 3 | Tap 6 emotes quickly | The 6th says "Wait Ns"; nothing more appears |
| 4 | Turn reactions off on the projector or host page | Phones show "Reactions are turned off"; nothing appears on the projector |
| 5 | During a question, before answering | No emote tray on the phone; after answering, the tray appears and reactions float up the right lane of the projector without covering answers |
| 6 | Three phones send 🎉 together | A burst of 🎉 with "3 players" at the top of the projector |
| 7 | Let a question close | Reveal for about 5 s with "Leaderboard in N", then the leaderboard on every screen without pressing anything |
| 8 | Projector speakers on; open the projector | The header shows "Click for music"; one click anywhere starts the lobby music; a chime when someone joins, a pop per emote, a soft "boing" when characters bump |
| 9 | Play a question through | Ticks on the get-ready countdown and a "go" hit; tense music that speeds up with ticks in the last 5 s; a buzzer only if time runs out; a "ta-da" on the reveal; drumroll then groove on the leaderboard; fanfare on the podium |
| 10 | Music button off, reload | Silent, and it stays off after the reload; the volume slider changes the level |

### Music checks done by machine

`tests/unit/music.test.tsx` checks every track's patterns and that each phase has music. In Chromium every
track and effect was rendered offline and measured: no errors, no silent gaps, peaks under 0.94 even at full
volume (limiter), and the live projector page picked the right track for lobby, get ready, question, hot
question, reveal, leaderboard and podium. Nobody has listened to it by ear yet: step 8–9 above does that.

## Manual checklist: synchronised start (3+ devices, one on slow mobile data)

| # | Step | Expected |
|---|---|---|
| 1 | Open the projector (teacher browser) and 3 phones, one on poor mobile data. Press **Start game** on the projector | Everything shows "Get ready" with the same countdown number |
| 2 | Watch all screens at the 0 | The question appears on every screen within about a fifth of a second, the slow phone included |
| 3 | The slow phone answers 3 s after the start, a fast phone does the same | Both earn the same points |
| 4 | Projector: Space (reveal → leaderboard → next question) | Each step happens on all screens together |

## Manual checklist: Phase 4 (a game with 3 devices)

| # | Step | Expected |
|---|---|---|
| 1 | Host a quiz, two phones join, click **Start game** | Phones and projector show question 1 with the same countdown |
| 2 | One phone answers | It locks in; host and projector answer counts go up; nothing says right or wrong yet |
| 3 | Second phone answers | The question closes by itself (everyone answered) |
| 4 | Reveal | Projector marks the correct tile and shows counts; phones show Correct +points / Not this time |
| 5 | Host: **Leaderboard** | Projector plays the animated top 10; phones show their rank card and the compact board |
| 6 | Host: **Next question**, let the timer run out | The question closes at 0 even with no answers |
| 7 | A third phone joins mid-game | It gets the current question and appears on the board after the next close |
| 8 | Reload a phone mid-question | It comes back to the same question with its answer locked |
| 9 | Last question → **Final results** | Podium on the projector; final rank on phones |
| 10 | OS reduce-motion on | Leaderboard updates without character animations |

## Manual checklist: Phase 3 (live sessions, needs 2 devices)

Before you start: apply the Phase 3 migration and turn **anonymous sign-ins on**.

| # | Step | Expected |
|---|---|---|
| 1 | Live Sessions → Host a published quiz | Host lobby with PIN, QR code and "Waiting for players…" |
| 2 | Click "Open projector view" | New tab, full-screen-ready night screen with the same PIN and QR |
| 3 | Phone: scan the QR code | `/join/<pin>` skips straight to "Who's playing?" |
| 4 | Pick a nickname and build an avatar (every tab), join | Phone shows "You're in!"; the player pops in on the host and projector screens within a second |
| 5 | Second phone: same nickname with different case or spaces | "Someone in this game already uses that nickname" |
| 6 | Phone: Change look | The new avatar appears on the host and projector screens |
| 7 | Host: Lock lobby; third device tries to join | "The host has locked this game"; projector shows "Lobby locked"; phones in the lobby see the lock note |
| 8 | Host: remove a player | Their phone shows "You were removed"; they cannot rejoin with the same PIN |
| 9 | Phone: Leave, then Rejoin | Player disappears, then reappears |
| 10 | Host: Create projector link, open it in a private window | Projector screen without signing in; creating a new link disconnects it |
| 11 | Turn a phone's Wi-Fi off and on | Pill shows "Reconnecting…", then "Live", and the lobby state is correct |
| 12 | Host: Close lobby | Phones and projector show "This session has ended"; the PIN no longer works |
| 13 | Enter a wrong PIN 11 times | "Too many wrong PINs" |

## Manual checklist: Phase 2c (workspaces and sharing)

Use two teacher accounts (A and B), ideally in two different browsers.

| # | Step | Expected |
|---|---|---|
| 1 | A: Workspaces → New workspace | Lands on the workspace page as Owner |
| 2 | A: Create invite link, copy it | Link shown once; appears under Active links |
| 3 | B (signed out): open the link | Sign-in page; after signing in (or registering) the invite page opens |
| 4 | B: Join workspace | Workspace page; both members listed by name |
| 5 | A: My Quizzes → quiz menu → Share → open to everyone, View | B sees it under Shared with Me with "Can view"; opening it shows the preview, no Edit |
| 6 | A: switch everyone to Copy | B can "Copy to My Quizzes"; the copy is a draft in B's library; A's quiz is unchanged |
| 7 | A: give B "Can edit" (no publish) | B can edit and save; A sees "Last edited by B" and the Activity entry; B has no Publish button |
| 8 | A: tick "Can publish and unpublish" for B | B can publish and move back to drafts, but not archive |
| 9 | A and B edit the same quiz; A saves, then B saves | B gets "Someone else saved this quiz" with a reload option; nothing is overwritten |
| 10 | A: revoke the link; a new teacher opens it | "Invite link not valid" |
| 11 | A: remove B (or B: Leave) | B immediately loses the shared quizzes |
| 12 | Phone width | Workspaces, the share dialog and Shared with Me work with no sideways scrolling |

## Manual checklist: Phase 2a (quizzes)

| # | Step | Expected |
|---|---|---|
| 1 | My Quizzes with no quizzes | "Create your first quiz" empty state |
| 2 | New quiz, try to save without a title | "Cannot save yet" toast; Quiz details selected |
| 3 | Add title, questions of all three types, save | "Quiz saved"; URL changes to `/teacher/quizzes/<id>/edit` |
| 4 | Upload a large photo as a question image | Uploads compressed (WebP ≤ 1280 px), preview shows it |
| 5 | Publish with an incomplete question | Dialog lists exactly what is missing; clicking an item jumps to it |
| 6 | Complete it, publish | "Quiz published"; badge turns green |
| 7 | Edit a published quiz to blank a question, save | Rejected with "published, so every question must be complete" |
| 8 | Edit, then click Back without saving | "Leave without saving?" dialog; Stay keeps the edits |
| 9 | Ctrl+S | Saves |
| 10 | Library: duplicate, archive, restore, delete (confirm) | Each works and the list updates |
| 11 | Preview | Full-screen; ←/→ move between questions; Space reveals the answer |
| 12 | Phone width | Editor usable; no sideways scrolling |

## Manual checklist: Phase 1 (against your Supabase project)

| # | Step | Expected |
|---|---|---|
| 1 | Start with no `.env.local` | "Setup needed" screen listing the missing variables |
| 2 | Put an `sb_secret_…` key in `VITE_SUPABASE_PUBLISHABLE_KEY` | App refuses to start and tells you to rotate the key |
| 3 | Register with valid details | Dashboard (confirm off) or "Check your inbox" (confirm on) |
| 4 | Register with a mismatched confirmation | Inline field error, no request sent |
| 5 | Sign in with a wrong password | "That email and password combination is not correct." |
| 6 | Visit `/teacher/profile` while signed out | Redirected to `/login?next=%2Fteacher%2Fprofile`; after sign-in you land on Profile |
| 7 | Edit display name and school | Toast "Profile saved"; value persists after reload |
| 8 | Change password on Profile | Toast; sign out, then sign in with the new password |
| 9 | Forgot password → email link (needs SMTP) | `/reset-password` form, then dashboard |
| 10 | Open an old or used reset link | "Reset link not valid" with a button to request a new one |
| 11 | Sign out | Redirected to `/login`; back button does not reveal the dashboard |
| 12 | Mobile width (≈360 px) | Teacher menu opens as a drawer; forms are usable |
| 13 | OS "reduce motion" on | Page transitions become instant |

## Later phases

* **Phase 4:** PGlite tests for scoring, deadlines, duplicate and late answers, concurrent close and advance.
* **Phase 6:** Playwright e2e (teacher + 3 students + projector) and **k6** load tests
  (`tests/load/`): 100 joins, 100 answers in a short burst, a reconnection storm, and 1 host + 1 projector. Results
  will be recorded in `docs/LOAD_TEST_RESULTS.md`. No capacity claims are made before then.
