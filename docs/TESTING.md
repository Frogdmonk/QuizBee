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
