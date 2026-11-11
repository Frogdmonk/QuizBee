# Project Context: Rally (repo: QuizBee)

Handoff notes for anyone continuing work on this codebase. They cover what exists, why it is built this way, how
to run it, the rules the code follows, and what comes next. Read this first, then
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

---

## 1. What this is

A real-time multiplayer classroom quiz platform, similar in spirit to Kahoot but with its own branding and
design.

* **Teachers** sign up, build quizzes, and (from Phase 3 on) host live games.
* **Students** join from their phones with a 6-digit PIN or QR code. They pick a nickname and avatar and never
  create an account.
* **Projector view** (`/presenter/:sessionId`) shows questions, countdowns, answer distribution and an animated
  top-10 leaderboard.

The target is up to 100 students in one live session, running entirely on free tiers (Supabase Free and
Cloudflare Pages) with no paid APIs.

* **Product name in the UI:** "Rally". It is set in [src/lib/brand.ts](src/lib/brand.ts), the HTML title, the
  logo and the docs.
* **Repo name:** QuizBee (<https://github.com/Frogdmonk/QuizBee>). Renaming the product is undecided; if it
  happens, start with `brand.ts`.

The original product brief is long. Its key demands: server-authoritative scoring, never exposing correct
answers to students early, smooth animations on low-end Android phones, RLS on everything, and no fake data or
non-functional buttons.

---

## 2. Current status (as of 2026-11-09)

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation, design system, Supabase clients, teacher auth (register, login, logout, forgot and reset password, profile), protected routes | ✅ Done, commit `99ae282` |
| 2a | Quiz builder and library: create, edit, duplicate, publish, archive, delete; 3 question types; images; live preview; full-screen preview; dashboard stats | ✅ Done, commit `79dedb8` |
| 2b | Quiz sharing between teachers (share links, preview, "Add to My Library" copy, revoke), "Shared with Me" page. *Original plan, kept as is; see §10.* | Not started (can be done any time) |
| 2c | Workspaces and quiz sharing between teachers: workspaces, link invites, per-quiz sharing with a whole workspace or chosen members (view / copy / edit, plus a publish permission for editors), copy to library, concurrent-edit protection, activity log, real "Shared with Me" page. *Added on the owner's request; see §10.* | ✅ Done |
| 3 | Live sessions: PIN and QR, anonymous student join, nickname rules, layered SVG avatar builder (32 presets, 66 million combinations), waiting room, lock/unlock, remove, leave/rejoin, Realtime authorisation, projector lobby (same browser or projector link) | ✅ Done |
| 4 | Game engine: start, open question, submit answer, close and score, next, end, close-when-due, clock sync, reconnection, late join, game screens | ✅ Done (pause/resume not built) |
| 5 | Animated leaderboard (20 themes, special events), podium, final results ✅. Still planned: emoji reactions, confetti, session history (`/teacher/analytics` = "Quiz History") | Partly done |
| 6 | k6 load tests (100 players), Playwright e2e, performance tuning, production deploy, documented free-tier findings | Planned |

**Last verified (after Phase 3):** `npm run lint`, `npm run typecheck`, `npm test` (203 tests: 118 database +
85 unit) and `npm run build` all pass. The Phase 3 screens were checked in headless Chrome against a mocked API
(join, avatar builder, waiting room at 390 px; host lobby at 1440 and 390 px; projector at 1440 and 1024 px):
no app errors, no sideways scrolling. **Realtime has not yet run against the real project**: the mock had no
WebSocket server.

### Things to check before you start

* **Is the Phase 2a migration applied to the hosted Supabase project?** It must be applied by hand (see §5). If
  `/teacher/quizzes` says "Could not load your quizzes", it isn't.
* **Is the Phase 2c migration applied?** Apply it after 2a. If `/teacher/workspaces` says "Could not load your
  workspaces", or the editor says "Could not load this quiz" for every quiz, it isn't. (The editor now also calls
  `get_quiz_permissions`, so the **frontend needs the 2c migration**.)
* Workspaces and sharing have been tested in PGlite and with a mocked API only, **not yet against the real
  Supabase project** with two real teacher accounts. Use the Phase 2c manual checklist in docs/TESTING.md.
* Saving and uploading in the quiz editor have only been tested in automated DB tests and a headless browser
  with fake config, **not yet end-to-end against the real Supabase project.**
* **Is the Phase 3 migration applied?** Apply it after 2c. If Live Sessions says "Could not load your sessions",
  it isn't.
* The hosted project still has **anonymous sign-ins OFF** and **"Confirm email" ON** (see §8). **Students
  cannot join until anonymous sign-ins are ON.**
* Live sessions have been tested in PGlite and with a mocked API only. Run the Phase 3 manual checklist in
  docs/TESTING.md with a laptop and two phones.

---

## 3. Tech stack (strict, from the brief)

* React 19, Vite 8 (Rolldown), TypeScript 5.9 (deliberately **not** TS 7; lint tooling doesn't support it yet)
* Tailwind CSS 4 (CSS-first config in [src/styles/index.css](src/styles/index.css), no `tailwind.config.js`)
* Motion 14 (`motion/react`), Lucide icons, React Router 8 (data router), React Hook Form + Zod 4
* Supabase: Postgres, Auth, Realtime and Storage. **No Edge Functions** (deliberate, see §6).
* Hosting on Cloudflare Pages (`public/_headers`) or Vercel (`vercel.json`); GitHub for source. Both files
  carry the same security headers and a unit test keeps them in sync.
* Tests: Vitest 5 + Testing Library (jsdom), and **PGlite** (Postgres compiled to WASM) for database tests.
* Fonts self-hosted via `@fontsource-variable` (Figtree for body, Bricolage Grotesque for display).

Do not add Redis, Firebase, a separate WebSocket server, or paid services. Free open-source libraries are fine;
justify new dependencies.

---

## 4. Running it locally

Requirements: Node 20.19+ or 22.12+ (developed on Node 24 / npm 11, Windows 11).

```bash
npm install
# create .env.local (git-ignored) with:
#   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
#   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
#   VITE_PUBLIC_SITE_URL=            (optional; defaults to the browser origin)
npm run dev          # http://localhost:5173 (strict port)
```

Ask the project owner for the `.env.local` values, or create your own free Supabase project (see
[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)). **Never put values in `.env.example`.** It is committed.

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `preview` | dev server / production build to `dist/` / serve the build |
| `npm test` | all tests (`test:unit`, `test:db` run one project) |
| `npm run typecheck` / `lint` | static checks |

If the env vars are missing or invalid, the app shows a "Setup needed" screen instead of crashing. It also
refuses to start if a secret or `service_role` key is put in the publishable variable.

---

## 5. Database and migrations

Migrations live in [supabase/migrations/](supabase/migrations/), one per phase:

1. `20261106120000_phase1_foundation.sql`: secure default privileges, the `private` schema,
   `teacher_profiles`, the sign-up trigger, and `ensure_teacher_profile()`.
2. `20261107090000_phase2_quizzes.sql`: `quizzes`, `quiz_questions`, `question_options`, the `quiz-media`
   storage bucket and its policies, and the RPCs `save_quiz`, `set_quiz_status` and `duplicate_quiz`.
3. `20261108090000_phase2c_workspaces.sql`: `workspaces`, `workspace_members`, `workspace_invites`,
   `quiz_grants`, `quiz_activity`; new columns `quizzes.revision` and `quizzes.updated_by`; SELECT policies for
   shared quizzes; workspace, invite and sharing RPCs; and new versions of `save_quiz` and `set_quiz_status`
   (same signatures) that also accept editors. Purely additive: existing quizzes stay private.
4. `20261109090000_phase3_live_sessions.sql`: `game_sessions`, `participants`, `session_viewers`,
   `pin_attempts`; the host, player and projector RPCs; and the **receive-only RLS policy on
   `realtime.messages`**.
5. `20261110090000_phase4_game_engine.sql`: question snapshots, hidden answer keys, answers, scores and ranks, and
   the game RPCs (start, submit, close, leaderboard, next, end, advance_if_due, get_game_state, server_now).
6. `20261111090000_phase4b_synchronised_start.sql`: scheduled question start, full-state broadcast,
   `submit_answer` 'early' result (see "Synchronised start" below). Replaces functions from migration 5.
7. `20261112090000_phase5_reactions_autoboard.sql`: leaderboard after every question (`reveal_ms`, `board_at`,
   `advance_if_due` moves reveal → leaderboard), student reactions (`send_reaction`, `set_reactions_enabled`,
   `reaction_limits`, `private.emote_keys`). Replaces `game_payload` and `advance_if_due`.
8. `20261113090000_battle_phase1_arena.sql`: boss battle phase 1. `session_battles` (settings + monster HP,
   created for every new session by a trigger), `battle_events` (one per question, unique), the eligibility
   snapshot `session_questions.eligible_ids` (trigger when a question opens), the attack resolution (trigger
   when a question closes, inside the existing exactly-once close), `set_battle_settings`, and `game_payload`
   with a `battle` object. Replaces `game_payload`.
9. `20261114090000_battle_phase2_modes.sql`: boss battle phase 2. Normal / Rage / Enraged modes (fixed per
   question when it opens), class targets, counter-attack healing, optional battle timers, announcements (+3 s),
   7 s reveal for battle sessions, intensity presets and every threshold in `set_battle_settings`. Replaces
   `snapshot_eligible`, `resolve_battle`, `start_session_battle`, `battle_json` and `set_battle_settings`.
10. `20261115090000_battle_phase3_weapons.sql`: boss battle phase 3. `battle_weapons` (catalogue, seeded),
    `battle_votes` / `battle_ballots`, weapon columns on `session_battles` and `battle_events`, the unlock and
    weapon effects in `resolve_battle`, `board_due_at`, `resolve_vote`, `equip_weapon`, RPCs
    `cast_weapon_vote`, `decide_weapon_vote`, `use_weapon_special`, `set_weapon_settings`. Replaces
    `resolve_battle`, `battle_json`, `game_payload`, `get_game_state` (adds `me.vote`), `advance_if_due`,
    `show_leaderboard` and `next_question` (both refuse while a vote is unresolved).
11. `20261116090000_learning_progression.sql`: learning metadata on `quiz_questions` (`level` 1–4, `objective`,
    `topic`, `difficulty`, `kind`, `recovery` JSON) and `question_options.misconception`; session copies
    (`session_questions.role` / `core_position` / `level` / `level_start` / `recovery_skipped`, option
    misconceptions); `game_sessions.mastery_enabled` / `mastery_pct` / `review_ms`. Replaces `save_quiz`,
    `quiz_issues`, `copy_quiz`, `start_game`, `next_question`, `snapshot_eligible`, `game_payload`; new
    `question_accuracy`, `next_position`, `top_misconception`, `weak_objectives`, `learning_report`,
    `set_recovery_skipped`, `set_learning_settings`.
12. `20261117090000_powerups_energy.sql`: `battle_powerups` (8, seeded), `participant_powerups`, team energy and
    ability columns on `session_battles`, `powerup_draft` / `hidden_option_id` / `time_warp_s` on
    `session_questions`, energy and ability columns on `battle_events`; the Healing Wand becomes available.
    Replaces `snapshot_eligible`, `resolve_battle`, `submit_answer` (Revival Crystal), `use_weapon_special`
    (targets via `ability_target`, Healing Wand), `battle_json`, `get_game_state` (`me.powerup`); new
    `choose_powerup`, `use_powerup`, `use_team_ability`, `set_powerup_settings`.
13. `20261118090000_code_blocks.sql`: `code_language` / `code_content` on `quiz_questions` and
    `session_questions` (code shown under a question, kept exactly as written, ≤ 2000 characters) and
    `label_is_code` on `question_options` / `session_question_options` (answers that are code snippets).
    Replaces `quiz_issues`, `copy_quiz`, `save_quiz`, `start_game`, `game_payload` with the code columns added.

**Applying them:** the Supabase CLI is *not* linked on the owner's machine and Docker isn't installed, so
`supabase start` doesn't work locally. Either:

* paste each file into **Supabase Dashboard → SQL Editor** in filename order, or
* `npx supabase login`, then `npx supabase link --project-ref <ref>`, then `npx supabase db push`.

**Never edit an applied migration.** Add a new timestamped file instead. Keep
[src/types/database.ts](src/types/database.ts) in sync by hand. It is hand-written; `supabase gen types` is
possible once the CLI is linked.

### Database conventions (follow these)

* **Secure by default.** Phase 1 revokes Supabase's default grants to `anon` and `authenticated` on new tables,
  sequences and functions in `public`, and revokes `EXECUTE` from `PUBLIC` globally. **Every new table and
  function needs explicit `grant`s,** or the app gets error `42501`. Tests assert this.
* **RLS is on for every table.** Policies use `(select auth.uid())`, wrapped in a subselect for performance.
* **Clients only `SELECT` (and sometimes `DELETE`).** All writes go through `SECURITY DEFINER` RPCs with
  `set search_path = ''` and fully qualified names, so validation, counters and atomicity live in one place.
  Example: the owner cannot `UPDATE quizzes` directly; they must call `save_quiz`.
* **Internal helpers live in the `private` schema,** which the Data API doesn't expose. Examples:
  `private.is_teacher()`, `private.is_anonymous_session()`, `private.quiz_issues()`, `private.copy_quiz()`,
  `private.clean_media_path()`, `private.assert_quiz_quota()`.
* **User-facing errors:** `raise exception '<friendly text>' using errcode = 'P0001'` (or `P0002` for not
  found). The frontend's `friendlyError()` ([src/utils/errors.ts](src/utils/errors.ts)) shows P0001/P0002
  messages verbatim and hides unknown DB errors behind a generic message.
* **Teachers vs students:** students are Supabase **anonymous** users (`is_anonymous` in the JWT). Teacher
  checks must exclude them; use `private.is_teacher()`. Anonymous users never get a `teacher_profiles` row.
* **Answer keys:** `question_options.is_correct` is teacher-only. Live games (Phase 3+) will **snapshot** quizzes
  into session tables, keeping answer keys in a separate table with no student policy.

### Phase 2a data model in brief

* `quizzes`: owner, title (1–120), description (≤1000), subject (≤60), `cover_image_path`, `speed_scoring`,
  `status` (draft, published or archived), `source_quiz_id` (copied-from), `question_count`, `published_at`.
* `quiz_questions`: position 0–99, type (`multiple_choice`, `true_false` or `image_choice`), prompt (≤300),
  `image_path`, `time_limit_seconds` 5–120 (default 20), points 0–2000 (default 1000), explanation (≤500).
* `question_options`: position 0–3, label (≤120), `image_path`, `is_correct`. A partial unique index allows at
  most one correct option per question.
* **Save model:** `save_quiz(jsonb)` replaces all questions and options on every save, so question and option
  IDs are not stable across saves. Nothing references them yet; sessions will snapshot.
* **Drafts** may be incomplete. **Publishing** requires a complete quiz (`private.quiz_issues` returns `[]`).
  A **published** quiz must stay complete when edited. Limits: 100 questions per quiz, 500 quizzes per teacher.
* **Images:** bucket `quiz-media` is public-read with a 2 MB limit (webp, jpeg, png, gif). Teachers can only
  upload into their own `<user-id>/` folder. Paths are validated by regex in `private.clean_media_path`.

### Phase 2c data model in brief (workspaces and sharing)

* **Workspace** = a group of teachers (one owner, members). Invite links last 7 days, can be reused and revoked,
  and only their SHA-256 is stored. Limits: own 20, belong to 50, 50 members, 10 active links
  (`src/lib/workspace-rules.ts` mirrors them).
* **`quiz_grants`:** per quiz and workspace, either a row with `teacher_id = null` ("open to everyone in the
  workspace", view by default) or one row per chosen member. Levels are `view < copy < edit`, where **edit is the
  highest** (edit includes copy, copy includes view). `can_publish` is only valid with edit. A member's access is
  the highest of their grants, and only while they are still a member.
  * **view:** preview the quiz.
  * **copy:** `copy_shared_quiz` puts an independent draft in their own library.
  * **edit:** `save_quiz` on the shared quiz; everyone sees the change and the owner sees who edited it
    (`updated_by`, `quiz_activity`). With `can_publish`, editors may publish and unpublish (never archive).
* **Only the owner** can delete, archive or restore, duplicate, or change sharing.
* **Concurrent editors:** the client sends `revision`; `save_quiz` raises hint `quiz_revision_conflict` when it is
  outdated, and the editor offers "Reload latest version".
* **Important:** shared quizzes are readable through RLS, so any "my quizzes" query **must filter by
  `owner_id`** (`listMyQuizzes(ownerId)` does).
* Member names are exposed only through RPCs; `teacher_profiles` RLS is unchanged.

---

## 6. Key architecture decisions (and why)

Full reasoning is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §1, which also lists the contradictions found
in the brief.

1. **Postgres RPCs instead of Edge Functions.** Every game operation must be one atomic transaction and answer
   within 500 ms p95. RPCs have no cold start, no extra network hop, and need no service key.
2. **Two isolated Supabase clients** ([src/lib/supabase.ts](src/lib/supabase.ts)): `getTeacherClient()`
   (storage key `rally.teacher.auth`, handles email links) and `getPlayerClient()` (`rally.player.auth`,
   anonymous). A student join can never sign out a teacher on a shared computer. Both clients are created
   lazily. The console warning "Multiple GoTrueClient instances" is expected and harmless.
3. **Implicit auth flow** (not PKCE), so email confirmation and reset links work when opened on a different
   device.
4. **Realtime plan (Phase 3+):**
   * 3 private topics per session: `session:{id}:game`, `:host` and `:lobby`.
   * Broadcasts are sent only from RPCs via `realtime.send()`; clients get **receive-only** access through RLS
     on `realtime.messages`.
   * No Presence for students, because it fans out O(n²) and the free tier caps the rate.
   * Reactions go through a rate-limited RPC and are delivered only to the host and projector.
   * The DB is the source of truth; clients reconcile with `get_game_state()` keyed by `state_version`.
5. **Server-authoritative timing.** Every client counts down from the same `deadline_at` with a measured clock
   offset. Answers are validated with `clock_timestamp()`. Auto-progression uses a server `phase_ends_at` plus
   an idempotent `advance_if_due(session, version)` that the host *or the projector* can trigger. Browsers
   throttle hidden tabs, and the host tab is often hidden while the teacher is projecting.
6. **Scoring.** Correct answers earn `round(points × (0.5 + 0.5 × remaining_fraction))` when speed scoring is
   on, otherwise full points. Wrong or missing answers score 0, and late answers are rejected.

---

## 7. Frontend layout and conventions

```text
src/app/          App root, router.tsx (all routes, lazy), guards (RequireTeacher, GuestOnly), MotionProvider, error page
src/layouts/      RootLayout + TeacherAuthBranch, PublicLayout, AuthLayout, TeacherLayout (sidebar / mobile drawer)
src/pages/        route pages (default exports, lazy-loaded); upcoming-features.ts drives "not built yet" pages
src/components/ui/        design system: Button/ButtonLink, TextField/PasswordField, FormControls (TextArea, Select,
                          Switch, SegmentedControl, Skeleton), Dialog/ConfirmDialog, Menu, Card, Badge, Alert, Spinner, Logo
src/components/quiz/      QuestionEditor, QuestionList, QuizDetailsEditor, PreviewPanel, QuestionPreview (reusable
                          student-view renderer, intended for Phase 3+ game screens), ImagePicker, QuizCard, StatusBadge
src/components/sharing/   ShareQuizDialog, QuizActivityDialog, AccessBadge (Phase 2c)
src/components/avatar/    Avatar (layered SVG), AvatarBuilder (presets + part tabs) (Phase 3)
src/components/live/      QrCode, ConnectionPill, HostQuizDialog (Phase 3)
src/contexts/ + hooks/    teacher auth (TeacherAuthProvider/useTeacherAuth/useSignedInTeacher), toasts, useMyQuizzes
src/services/             every Supabase call (auth, profile, quizzes, media, workspaces, sharing, sessions = host,
                          player = students, live = shared lobby reads). Pages never call supabase directly.
src/lib/                  env, supabase clients, brand, redirect, media-url, quiz-rules (limits + publish rules that mirror
                          SQL), quiz-editor-reducer (pure, unit-tested), validation/ (Zod form schemas)
src/utils/                errors (friendlyError), image (browser resize to WebP), time (relativeTime)
tests/unit/               Vitest (jsdom)          tests/integration/db/   PGlite migration + RLS tests (harness.ts)
```

### Rules the code follows

* **Motion:** `LazyMotion strict` + `m.*` components only. **Never import `motion.*` or `Reorder`** (strict mode
  throws). Question reordering therefore uses up/down buttons with `layout` animation. Animate only `transform`
  and `opacity`. `MotionConfig reducedMotion="user"` plus a global reduced-motion CSS rule are in place.
* **Bundle size:** every page is lazy. Keep **Zod out of the entry chunk**: env validation is hand-written and
  `safeNextPath` lives in `lib/redirect.ts`, not in the Zod file. The student path must never import teacher
  code.
* **Fast-refresh lint:** `.tsx` files export only components. Put constants and helpers in `.ts` files (e.g.
  `button-styles.ts`, `question-type-icons.ts`).
* **No fake UI:** features from later phases render an explicit "Not built yet — Phase N" page
  (`UpcomingFeaturePage` driven by the route `handle: { upcoming }`). No dead buttons.
* **Route handles:** `handle: { wide: true }` widens TeacherLayout (used by the editor).
* **Mobile first:** check at about 390 px width with no horizontal scroll. `SegmentedControl` supports
  `shortLabel` for phones.
* **Client rules mirror server rules:** when you change a limit or publish rule, update both
  `src/lib/quiz-rules.ts` and the SQL, plus the tests on both sides.
* **Editor state:** `useReducer(editorReducer)`. "Unsaved changes" compares `draftFingerprint(draft)` with the
  fingerprint of the *version actually sent*, so edits made during a save stay dirty. A new quiz navigates from
  `/create` to `/:id/edit` with the draft in `location.state` to avoid a refetch.
* **Visual design: "Match Day"** (full spec: [docs/DESIGN.md](docs/DESIGN.md)). Teacher screens are an
  editorial desk (paper, hairline ledgers, 3px section rules, one signal-red accent, nothing loops); student and
  projector screens are a stage on the night canvas (score bugs, lower thirds, answer kits). Read DESIGN.md
  before building any screen; Phase 4/5 game screens already have tokens and motion variants reserved there.
* **Tokens** live in `src/styles/index.css` (`@theme`): `paper`, `surface`, `paper-sunk`, `ink-*`, `line`,
  `line-strong`, `signal-*` (brand), `success/warning/error/info`, `night-950…800`, `night-text/muted/line`,
  `volt-400` (student phones only, one element per screen), `answer-a…d` (+ `-press`, `-soft`), `answer-dim`,
  rank colours, the type scale (`text-caption … text-display-xl`, `text-score-*`, `text-stage-*`) and utilities
  `.type-display/.type-headline/.type-score/.type-stage/.type-kicker`, `.kit-a…d`, `.night-grid`. Legacy names
  (`flame-*`, `mint-*`, `rose-*`, `sun-*`) still compile but point at the new values; don't use them in new code.
  `tests/unit/design-tokens.test.ts` fails if a colour change breaks a text (4.5:1) or edge (3:1) pairing.
* **Motion tokens** live in `src/lib/motion.ts` (`dur`, `ease`, `spring.*`, `enterUp`, `popIn`, `wipeIn`,
  `slideFromLeft`, `stepSlide`). Never write inline springs.
* **`cn()` uses tailwind-merge**, so later classes win. Gotcha: a font-size class (`text-*`) placed after a
  `leading-*` class removes the leading; put `leading-*` last.
* **Building blocks** (`src/components/ui/`): Ledger/LedgerRow/LedgerLink, SectionHead, StatStrip, Banner,
  ScoreBug, LowerThird, Placeholder (planned features, never clickable), StatusBlock (every error, empty or
  terminal state), StepStrip, Monogram, InitialsStack, CountRoll, BreathingLine (the one waiting idiom),
  PinDigits, AnswerTile, NightCanvas, Kbd, Checkbox, UnderlineTabs, PasswordChecklist. Button variants include
  `danger-outline`, `night`, `night-ghost` and `volt`; Dialog, TextField, Badge, Alert and Skeleton take a night
  tone or surface.
* **Teacher phone navigation** is a bottom tab bar (Home, Quizzes, Live, Shared, More). Its height is exposed as
  `--tabbar-h` so floating bars and toasts sit above it. Routes with `handle: { wide: true }` (the editor) hide it.
* Answers always pair colour with a letter, a kit pattern and a fixed position (A–D).

### Routes

* **Built:** `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/teacher/dashboard`,
  `/teacher/quizzes`, `/teacher/quizzes/create`, `/teacher/quizzes/:quizId/edit`,
  `/teacher/quizzes/:quizId/preview` (full screen, outside the dashboard chrome), `/teacher/profile`,
  `/teacher/shared`, `/teacher/workspaces`, `/teacher/workspaces/:workspaceId`, and `/invite/:token` (requires a
  teacher login; `next` survives login and register), `/teacher/sessions`, `/teacher/sessions/:sessionId` (host
  lobby), `/presenter/:sessionId` (inside the teacher-auth branch but not behind `RequireTeacher`), and the
  student routes `/join`, `/join/:pin` and `/game/:sessionId` (waiting room; no teacher auth loaded).
* **Placeholder:** `/teacher/analytics` (Quiz History, Phase 5).
* **Editor and preview are permission-aware:** owner = everything; edit = editor with a "Shared with you" banner,
  Publish only with `can_publish`; view or copy = a read-only screen with Preview (and Copy).

---

## 8. Supabase project settings and gotchas

* **Anonymous sign-ins** must be turned **ON** before Phase 3 (currently off).
* **Rate limits** must be raised in the dashboard: anonymous sign-ins to **1000/h** (the default of 30 per hour
  per IP breaks a whole class behind one school IP), token refresh to 600, sign-ups and sign-ins to 300.
  [supabase/config.toml](supabase/config.toml) mirrors these values for the local CLI.
* **"Confirm email" is ON,** but no SMTP is configured. Supabase's built-in sender only delivers to
  project-team addresses and a few emails an hour, so new teachers can't confirm. Either connect free SMTP
  (Brevo or Resend) or turn confirmation off for testing. Password reset needs SMTP.
* **URL configuration:** the Site URL and Redirect URLs must include `http://localhost:5173/**` and the
  Cloudflare domain(s).
* **Pausing:** free projects pause after about 7 days idle. Restore the project in the dashboard before a lesson.
* **Main free-tier risk:** Realtime is capped at about 100 messages per second. One question broadcast to 100
  phones is about 100 deliveries. This is unverified until the Phase 6 k6 test. **Make no "supports 100
  students" claim before load testing.**

---

## 9. Testing approach

* **DB tests** ([tests/integration/db/harness.ts](tests/integration/db/harness.ts)) boot PGlite with a bootstrap
  that imitates Supabase:
  * roles `anon`, `authenticated`, `service_role` and `supabase_auth_admin`;
  * Supabase's default grants;
  * `auth.users`, `auth.uid()` and `auth.jwt()`, driven by `request.jwt.claims`;
  * a minimal `storage` schema.

  The bootstrap then runs **all real migrations**. Use `as(db, { kind: 'user', id, anonymous? }, tx => …)` to
  query as an API role, `createAuthUser()` to simulate sign-up, and `errorCode()` to assert things like
  `'42501'`. These tests don't cover GoTrue, PostgREST HTTP, Realtime or Storage HTTP behaviour.
* **Every new table or RPC needs DB tests** for the owner path, cross-tenant denial, anonymous-student denial,
  the anon role, and validation errors.
* **Manual checklists** for each phase are in [docs/TESTING.md](docs/TESTING.md).
* **UI checks** were done with a headless browser. A useful trick is a throwaway dev server with placeholder env
  vars on another port, plus a fake session written to `localStorage['rally.teacher.auth']` to render protected
  pages.

---

## 10. Sharing: Phase 2c (built) and Phase 2b (next)

### Phase 2c: workspaces and quiz sharing (✅ done)

Built at the owner's request before the original 2b plan. Decisions the owner made:

* "Group" and "workspace" are the same thing; the official name is **workspace**.
* Invites are **links**: opening one (after signing in) and clicking "Join workspace" adds the teacher.
* Per quiz, the owner can **open it to everyone in a workspace** (view by default, switchable to copy or edit)
  and/or **choose members** and give each one view, copy or edit.
* **Copy** = add the quiz to your own library and change your copy freely. **Edit** = change the shared quiz for
  everyone, and the owner sees who edited it. **Edit is the highest level.**
* **Editors can publish only with the owner's permission** (the "Can publish and unpublish" switch).
* Member names are shown to other members of the workspace.
* The original share-link plan (2b) is **kept**, not dropped.

Data model and rules: §5 "Phase 2c data model". Tests: `tests/integration/db/phase2c-workspaces.test.ts` and
`tests/unit/workspace-sharing.test.ts`. Manual checklist: docs/TESTING.md.

Open points for later phases:

* ~~Who may host a shared quiz~~ **Decided in Phase 3:** the owner and teachers with **edit** access may host a
  published quiz; view and copy holders must copy it first.
* Workspace ownership cannot be transferred yet. If the owner deletes their account, the workspace is deleted.

### Phase 2b: share links (⏭️ next; original plan, unchanged)

Planned design (ARCHITECTURE.md §3.1):

* **Table `quiz_shares`:** `id`, `quiz_id`, `created_by`, `token_hash bytea unique`, `created_at`,
  `revoked_at`, `use_count`. The token is 32 random bytes (base64url), shown **once**; store only its SHA-256
  (`extensions.digest` from pgcrypto).
* **Table `quiz_share_imports`:** `share_id`, `recipient_id`, `copied_quiz_id`, `created_at`. This powers
  "Shared with Me".
* **RPCs:**
  * `create_quiz_share(quiz_id)` returns the raw token.
  * `revoke_quiz_share(share_id)`.
  * `preview_shared_quiz(token)` (definer) returns quiz, questions and owner display name if the token is valid
    and not revoked.
  * `accept_quiz_share(token)` calls `private.copy_quiz(source, auth.uid(), title)` (already exists), records
    the import, and returns the new quiz id.
* **Frontend:**
  * a share dialog in the library and editor (create, copy link, list active links, revoke);
  * a public-ish route `/share/:token` (requires teacher login, keeps `next`) with a preview and an "Add to My
    Library" button;
  * a real `/teacher/shared` page;
  * remove `availableInPhase` from the "Shared with Me" nav item and its entry from `upcoming-features.ts`.
* **Already done by Phase 2c** (reuse, don't rebuild): `/teacher/shared` is real (add link imports to it), the
  "Shared with Me" nav item and the `upcoming-features.ts` entry are already updated, `ShareQuizDialog` exists (add
  a "Share link" section to it), and `next` already survives login and register. `private.new_token()` and
  `private.token_hash()` from the 2c migration can generate and hash the share tokens.
* **Image caveat:** copies keep the original owner's image paths. That's fine because the bucket is public-read
  and the path regex doesn't check ownership. Don't add an ownership check to `clean_media_path` without
  copying the objects.

---

## 10b. Live sessions: Phase 3 (✅ built) and Phase 4 (⏭️ next)

### What exists

* **Host flow:** Live Sessions page (open sessions, published quizzes you own or may edit, recent sessions) or
  "Host live" in a quiz card's menu → `HostQuizDialog` (player limit 10–100) → `create_session` → host lobby
  `/teacher/sessions/:id` with PIN, QR, copy link, lock switch, projector link, close lobby, player grid with
  remove. There is **no Start button yet**: a card says starting comes in Phase 4.
* **Student flow:** `/join` (PIN) or `/join/:pin` (QR) → anonymous sign-in on the **player client** →
  `lookup_session` → nickname + `AvatarBuilder` → `join_session` → `/game/:id` waiting room (bobbing avatar, player
  count, Change look, Leave/Rejoin, removed and ended screens). The last nickname and avatar are remembered in
  `localStorage['rally.player.profile']`.
* **Projector:** `/presenter/:id`. On the host's computer it uses the teacher session. On another device, the
  host creates a projector link (`#key=…` in the URL fragment) → anonymous sign-in → `claim_presenter` → read-only
  viewer row. A new link deletes old viewers.
* **Avatars** ([src/lib/avatar.ts](src/lib/avatar.ts), [src/components/avatar/](src/components/avatar/)): a 9-digit
  code, one digit per part: skin (8), hair style (10), hair colour (8), eyes (6), mouth (6), top (6), top colour
  (10), extra (6: glasses, shades, freckles, blush, headphones), background (8), giving 66,355,200 combinations,
  plus 32 named presets. The SQL regex `^[0-7][0-9][0-7][0-5][0-5][0-5][0-9][0-5][0-7]$` must match
  `PART_COUNTS` (a unit test checks this). **To add options**, raise a count only up to 10 (one digit) and
  update the SQL regex in a new migration.
* **Nickname rules** (SQL `private.clean_nickname`, mirrored in `src/lib/nickname-rules.ts`): NFKC, whitespace
  collapsed, 2–16 characters, no control or invisible characters, none of the listed symbols, not only
  punctuation, and a short blocked-word list checked after look-alike folding (`5h1t`) and repeated-letter
  collapsing. Duplicates compare a key that ignores case, spaces and `._'!?,():;-`. Any script is allowed.
* **Rules:** lobby only for new joins; locked lobbies and full sessions refuse new players, but players already in
  can still change their look; removed players cannot rejoin from that device; left players can; 5 open
  sessions per host; unstarted lobbies expire after 12 h; wrong PINs are throttled at 10 per 10 minutes per user.

### Realtime (how it is wired)

* Topics: `session:{id}:host` (host + projectors), `session:{id}:game` (host + projectors + active players),
  `session:{id}:lobby` (host + active players). The `realtime.messages` policy calls
  `private.can_receive_topic(realtime.topic())`. There is **no INSERT policy**, so no client can send or use
  Presence.
* Events: host topic `participant_joined | participant_updated | participant_left | participant_removed |
  session`; game topic `session | removed`; lobby topic `count` (at most every 5 s per session).
* Client: `useSessionChannel` (subscribes after `realtime.setAuth()`, reports connecting, live or offline, and
  calls `onSubscribed` on every (re)subscribe). `useLobby` reloads `get_session_lobby` on subscribe, when the
  tab becomes visible, and every 20 s. Players heartbeat `get_player_state` every 10–15 s (jittered), which also
  updates `last_seen_at` at most every 10 s.
* Tests: the harness stubs `realtime.messages`, `realtime.topic()` and `realtime.send()`; `canUseTopic()` checks
  receive and send per role.

### Phase 4 + animated leaderboard (✅ built)

* **Migration** `20261110090000_phase4_game_engine.sql`: `session_questions`, `session_question_options`,
  `session_answer_keys` (no client access at all), `answers` (unique per player and question), `participant_scores`
  (score, correct_count, total_response_ms, streak, rank, previous_rank, last_points, scored_version). No table
  grants: every read is `get_game_state()`.
* **Flow:** `start_game` snapshots the published quiz and opens Q1 → `submit_answer` (points from
  `clock_timestamp()` vs the deadline: `round(points × (0.5 + 0.5 × remaining))`, or full points when speed scoring is
  off) → close (host `close_question`, or anyone's `advance_if_due` once the deadline passed or everyone answered) →
  `reveal` → optional `show_leaderboard` → `next_question` … → `podium` (status `ended`). `end_game` stops early.
  Host commands carry `state_version`; stale ones are no-ops.
* **Ranking:** competition ranking on score (ties share a rank); display order inside a tie: more correct answers,
  then lower total answer time, then earlier join. Removed players are unranked. Late joiners (now allowed while
  `in_progress`, unless locked/full) get ranked from the next close.
* **Realtime:** every transition sends ONE full-state `state` broadcast on the `game` topic (see below); the host
  topic also gets `answer_count`. `useSessionChannel` shares one channel per (client, topic): supabase-js returns
  the existing channel for a topic, so two components subscribing separately would collide.
* **Synchronised start (why every screen changes together):**
  * `open_question` sets `starts_at = now + start_lead_ms` (2 s) and `deadline_at = starts_at + time limit`.
    Screens show "Get ready" and hold the question back until `starts_at` on the server clock
    (`useCountdown` fires at the exact moment), so delivery speed changes nothing. `submit_answer` returns `early`
    before the start; speed points and `response_ms` count from `starts_at`, so a slow phone is never penalised.
  * The `state` broadcast carries the whole shared state (`private.game_payload`): the question without its answer
    key; after a close also the correct option, answer counts, explanation, the top-10 and a compact rank row
    `[participant_id, score, rank, previous_rank, last_points, last_correct, streak, correct_count]` per player.
    `lib/game-sync.ts` `applyBroadcast` applies it to the screen's state, so no phone makes a follow-up request.
    `get_game_state()` returns the same payload plus the caller's own data (reconnect, first load, slow safety net).
  * `useGameState` is mounted in the LOBBY (phone, host and projector pages) so the clock offset (8 samples, median
    of the fastest 3, re-checked every 30 s) and state are ready before the game starts. Polling is a 30 s safety
    net (8 s when the channel is down), jittered. Phones only back up closing a question (3–5.5 s random delay);
    the host and projector close it.
  * Do not reintroduce per-phone requests on a transition. Keep the broadcast free of correctness until closed
    (a DB test checks this).
* **Teacher controls on the projector:** when the teacher's own signed-in browser shows `/presenter/:id`
  (`state.role === 'host'`) the Start button (lobby) and End question / Leaderboard / Next question appear; Space
  or → steps reveal → leaderboard → next question (never ends a running question). A projector opened with a
  projector link (`role === 'presenter'`) stays read-only by design. Shared logic: `useGameCommands`,
  `GameCommandButtons`.
* **Leaderboard after every question (Phase 5):** a closed question shows the reveal for `reveal_ms` (5 s), then
  the server moves to the leaderboard when nudged (`board_at` in the payload; host + projector nudge at once,
  phones are a jittered backup via `useAutoAdvance(..., boardInMs)`). Teachers can still show it sooner; "Next
  question" stays a teacher action. Every screen shows "Leaderboard in N".
* **Projector layout (Phase 5):** compact HUD (Q n/N, answered, `TimerRing`), centred prompt, answer tiles that
  fill the height (`QuestionStage size="stage"`), reveal counts under each tile, leaderboard sized so 10 rows +
  banner + controls fit 16:9 and 4:3. The right edge is a reserved reaction lane (`--rx-lane`); game content is
  padded so reactions never cover it.
* **Reactions (Phase 5):** fixed list in `src/lib/emotes.ts` = `private.emote_keys()` (a unit test checks they
  match). `send_reaction` checks: active player; lobby, or answered the current question, or reveal /
  leaderboard / podium; teacher switch; max 5 per 8 s (`reaction_limits`, RLS on, no grants). It broadcasts
  `reaction` `{id, pid, n, a, e, at}` on the game topic. `useReactions` dedupes by id, skips events older than
  6 s, batches renders (80 ms), expires after 4 s and detects bursts (same emote from 3+ players in 2.5 s).
  Projector: `ReactionLayer` (lane + bursts); phones: `EmotePanel` (only in the lobby and after a confirmed
  answer) + `ClassReactions`; lobby characters act out emotes. Teacher switch: `ReactionsToggle` (host page,
  projector, lobby).
* **Lobby playground (Phase 5):** `src/lib/playground/sim.ts` is a pure function of (session id, player ids,
  server time): per-character walking slots, idle moves, collisions on a 100 ms grid (new only after 1.5 s apart),
  reactions picked by a hash (bump / wave / high-five / dance / funny spin+laugh / giggle / angry when a pair
  keeps colliding), soft personal-space push. Every screen computes the same scene with the shared clock; no
  positions are sent. `components/lobby/Playground.tsx` renders it with one rAF loop writing transforms to the
  DOM (no React work per frame); reduced motion = still grid. Shown on the projector lobby and the host lobby
  (phones do not get the player list, so they show their own character + the class reaction row instead).
* **Music and sound (projector only):** `src/lib/audio/tracks.ts` holds six original tracks as step-sequencer
  data (lobby, get ready, question with a faster "hot" mode for the last 5 s, reveal sting, leaderboard drumroll
  + groove, podium fanfare) and `soundtrackFor(phase)`. `src/lib/audio/engine.ts` synthesises everything with
  Web Audio (oscillators + filtered noise, compressor + limiter): no audio files, nothing to license or
  download. `music` is the single live player: setting (on by default, volume) in `localStorage` key
  `rally.music`; browsers block sound until a click, so the status is `blocked` and the first click anywhere
  starts it. Hooks in `src/hooks/useMusic.ts`: `useSoundtrack`, `useSfxOn`, `useReactionSounds`. Effects:
  join chime, emote pop, burst sparkle, lobby bump "boing", get-ready ticks, "go", last-5-second ticks,
  time's-up. Button: `components/audio/MusicToggle.tsx` in the projector header. Phones and the host page stay
  silent on purpose (one sound source per room).
* **Boss battle, phase 1** (plan and later phases: [docs/BOSS_BATTLE_PLAN.md](docs/BOSS_BATTLE_PLAN.md)):
  * Server: when a question opens, the active player ids are snapshotted (`eligible_ids`); when it closes,
    `private.resolve_battle` records one `battle_events` row: attackers = every correct, non-removed player in
    answer order; accuracy = correct among the snapshot / snapshot size (no answer = wrong); damage = attackers
    × `base_damage` (default 3); HP never below 0. HP is fixed at the start: the teacher's number or automatic
    = players × questions × damage × 0.7, rounded to 10 (`private.auto_monster_hp`, mirrored in
    `lib/battle/hp.ts` for the lobby estimate). Scoring and the leaderboard are untouched.
  * Client: `lib/battle/` (pure: `formation` = honeycomb class block in a 1600×900 world, `choreography` =
    per-student swing/projectile timing from a hash, max 40 projectiles, `monster` = stage by HP: >70% calm,
    >30% rage, >0 enraged, 0 defeated; visual only until phase 2). `components/battle/`: `Monster` (SVG + CSS in
    `styles/battle.css`), `HpBar`, `BattleArena` (projector reveal; CSS animations only, no names, students who
    missed cheer), `BattleStrip` (HUD during questions/leaderboard and the host bar), `PhoneBattleCard`,
    `BattleResult` (podium), `BattleSettings` (host lobby). Sounds: whoosh, hits on the audio clock, roar on a
    big hit, victory fanfare.
* **Boss battle, phase 2 (modes):**
  * When a question opens (`private.snapshot_eligible`, a BEFORE trigger on `session_questions`), its mode
    comes from HP: above `rage_at` % Normal, above `enraged_at` % Rage, otherwise Enraged (70 / 30); the target
    % is stored on the question (`battle_mode`, `battle_target`). The first question and every change of mode
    get `battle_announce` and start 3 s later. With battle timers on, the mode's timer replaces the question's
    time limit (Normal keeps its own unless set).
  * When it closes (`private.resolve_battle`): every correct answer hits first; then if correct-among-eligible
    < ceil(eligible × target %), the special attack lands and the monster heals `heal_*` % of max HP (capped
    at max, never once at 0). `battle_events` stores mode, target, `defended` (null = no special attack) and
    `heal`. Standard: targets 50 / 60 / 70 %, heal 3 / 5 / 8 %; Gentle 40/50/60, 0/3/5; Fierce 60/70/80,
    5/8/12. Battle sessions get a 7 s reveal.
  * Client: `battle.config` and `battle.current` in the payload (`currentRules`, `chargingNote`, `modeTimer`
    in `lib/battle/state.ts`; names in `SPECIAL_ATTACK`). Projector: `BattleAnnounce` replaces "Get ready" when
    announced; the HUD strip shows "⚡ Riddle Roar charging · 18 of 30 correct needed"; the reveal continues
    after the hits with "stopped" (stunned monster) or the counter-attack (shock wave, class braces, heal).
    Phones get the same announcement, note and outcome; the host bar too. Settings: intensity, battle
    timers, Advanced (all thresholds).
  * Classic-flow DB tests (phase 4/5) switch the battle off in their setup, since it is on by default.
* **Boss battle, phase 3 (weapons and voting):**
  * Unlock (in `resolve_battle`, so exactly once): correct-among-eligible ≥ `unlock_pct` (90) % of the snapshot,
    not on the last question, not if the monster is at 0, not within `unlock_cooldown` (2) questions of the last
    unlock. Creates a `battle_votes` row: 3 available weapons other than the equipped one (`md5` order per
    question), voters = active players at close, opening at `closed_at + reveal_ms` for `vote_ms` (10 s).
  * Voting: `cast_weapon_vote` (one ballot per voter per round, PK; no changes; `early` / `closed` /
    `not_eligible` / `duplicate`); live tallies only on the host topic (`vote_tally`). All voted → resolves at
    once; otherwise `advance_if_due` resolves when `closes_at` passes. `resolve_vote`: a single leader wins;
    a tie → round 2 between the tied weapons (`runoff_ms`, 5 s); a tie again or no votes → `teacher`. Never
    random. `decide_weapon_vote` (host) picks any offered weapon or cancels (null) at any time.
  * While a vote is open / with the teacher, `board_due_at` is null: the reveal stays, `advance_if_due` and the
    host's leaderboard / next commands wait. After a decision the leaderboard follows 4.5 s later.
  * Weapons (numbers in `battle_weapons`, words sent in the payload): Thunder Blade +1 per hit / Thunderclap ×2
    hits; Inferno Staff burn 1 % max HP per question / Ignite ×5; Frost Hammer halves counter-attack heals /
    Deep Freeze stops the special attack; Shadow Bow +2 per hit in Rage–Enraged / Weak Spot +3; Crystal Spear
    +2 per hit in Normal / Shatter 10 % max HP (1 charge). Healing Wand is in the table but `available = false`
    until team energy (phase 5). One weapon at a time; a new one replaces it.
  * Specials: `use_weapon_special` (host) arms the special for the open question or, between questions, the
    next one; uses a charge; `weapon_ready_at` enforces the cooldown. `specialStatus` in `lib/battle/state.ts`
    mirrors the rules for the button.
  * Client: `useWeaponVote` (stage pending / open / teacher / done / cancelled from the server clock; nudges when a
    round is due), `WeaponVoteStage` and `WeaponEquipStage` (projector), `PhoneWeaponVote`, `VoteHostPanel` and
    `WeaponPanel` (teacher), `WeaponIcon` (6 SVG weapons), weapon badges on arena avatars, weapon projectiles,
    effect / unlock banners. `useGameState` exposes `voteTally`. `useGameCommands.voting` hides Space / next.
* **Learning progression (battle plan phase 4):**
  * Authoring: the question editor's "Learning" section (`components/quiz/LearningEditor.tsx`, `lib/learning.ts`):
    level (1–3, 4 = final challenge), kind with a suggested timer (recall/concept 15 s, application 20 s,
    predict 30 s, bug 35 s, multi-step 45 s; "Use N s" applies it, the teacher's time always wins), difficulty,
    objective, topic, a misconception note per wrong answer, and an optional recovery (parallel) question with
    text answers. All optional; publishing needs complete recovery questions (`recoveryIssues` mirrors SQL).
  * Game: `start_game` copies it all; recovery questions become `session_questions` with `role = 'recovery'`
    at position `1000 + core position` (pending until needed). `next_question` → `private.next_position`:
    after a core question below `mastery_pct` (75) correct-among-eligible, with a recovery question not yet
    played and not skipped, it opens the recovery question; otherwise the next core position (a recovery
    question continues at core + 1). `snapshot_eligible` holds a recovery question back `review_ms` (8 s) for
    the review, a new level (`level_start`) or battle announcement 3 s; the previous mode is found by
    `opened_at`, so recovery positions don't confuse it. Recovery questions score and fight but never unlock a
    weapon (not "before the last question" by position).
  * Payload: question `role`, `core_position`, `level`, `level_start`, `objective`, `topic`, `kind`,
    `difficulty`; after closing `misconception` (most-picked wrong answer, count, note) and for core questions
    `mastery` (accuracy, passed, has_recovery, skipped); recovery questions carry `review` (core prompt,
    accuracy, misconception, explanation, right answer). `learning.weak_objectives` (core questions below the
    bar) during the game; `learning.report` per objective at the end. Counts only, never names.
  * Screens (`components/learning/`): `ReviewScreen`, `LevelAnnounce` (final challenge lists weak objectives),
    `MisconceptionNote` (reveal, all screens), `MasteryBanner` (projector leaderboard + host bar, with the
    host's skip / play toggle), `LearningReport` (host podium), `LearningSettings` (host lobby).
  * Weapon specials, team abilities and power-ups armed between questions target `private.ability_target`
    (the next question actually played, a recovery question included), so nothing is lost to a recovery question.
* **Power-ups and team energy (battle plan phase 5):**
  * Energy (0–100, in `resolve_battle`): +10 mastery, +15 recovery question at the bar, +10 special attack
    stopped, +5 if ≥ 90 % of the eligible answered, +5 weapon unlocked, +1 per 2 correct in the final challenge
    (max 10), +5 per question with the Healing Wand (Renewal: +30 at once). Stored per event with reasons.
  * Team abilities (teacher, `use_team_ability`): Team Shield 30 (blocks one counter-attack heal), Group
    Lightning 40 (8 % max HP), Knowledge Reveal 25 (hides one wrong answer of the running question, never the
    right one), Final Rally 60 (hits ×2, from the draft question on). One of each per question.
  * The draft (`snapshot_eligible`): before the first level-4 core question (or the last of a 3+ question quiz
    without levels), each eligible player gets 3 applicable power-ups (`md5` order per player; `xray` and
    `comeback` only when remaining questions have objectives), and the question is held back `draft_ms` (15 s).
    `choose_powerup` until it closes; unpicked players get their first offer at close. No second draft.
  * Power-ups (`use_powerup`, once, during a running question from the draft on): Thunder Strike (own hit ×2),
    Comeback Charge (own hit ×3, only after an earlier miss on the same objective), Revival Crystal (after
    answering: one changed answer, half points, in `submit_answer`), X-Ray Vision (objective + one
    misconception note, never the answer), Time Warp (+5 s for everyone, max +10 s), Weakness Scanner (topic
    on screen, +1 per class hit), Guardian Shield (as Team Shield), Team Heal (+20 energy). Refusals that
    would waste one ("save it") leave it unused.
  * Client: `lib/battle/powerups.ts` (icons, abilities, `abilityStatus` mirror), `components/battle/Powerups.tsx`
    (`EnergyMeter`, `PhoneDraft`, `DraftStage`, `PhonePowerup`, `TeamAbilities`), energy in the HUD strip, team
    line in the reveal, removed answer dimmed (`QuestionStage hiddenOptionId`, phone tiles), lobby switch.
* **Visual world (after phase 5):**
  * `components/world/WorldBackdrop.tsx` + `styles/world.css`: one sky and landscape behind every projector
    screen (`PresenterPage` `Shell`, `-z-10` inside an `isolate` canvas): mood skies that cross-fade, three
    parallax hill layers drifting, stars / embers / sparkles, lightning flicker when Enraged, a crescent moon
    (a sun at dawn), a dark veil for readability. Mood = `lib/world.ts worldMood(state)`: the monster's stage
    (calm / rage / enraged), `victory` once defeated, calm without a battle. The arena no longer draws hills.
  * The projector leaderboard is **The Climb to the Lair** (`components/leaderboard/ClimbBoard.tsx`,
    `lib/leaderboard/climb.ts`, `styles/climb.css`): 10 ledges on a cliff path in a 1600×900 world (#1 at the
    top below the lair), using the same playback engine as the list: climbers hop ledge by ledge (small rises),
    leap in an arc (4+ places), slide down with a wobble (drops), jump up from the crowd (newcomers); torches for
    streaks, lit ledges for the top 3, a crown on #1, the monster (or a flag) at the summit, a nameless crowd at
    the foot for everyone else, an sr-only ordered list. The cliff bleeds past the board, so text and teacher
    controls below it are `relative z-10`. Host laptop and phones keep the list leaderboard.
  * Phones: `.phone-mood` tint by mood behind the game; `lib/haptics.ts buzz()` when my hit lands and when a
    weapon is equipped (phones that support vibration; only after the person has tapped, else browsers log errors).
  * Student figures: `components/avatar/Hero.tsx` + `styles/hero.css`: the avatar head (big, `headScale` 0.86)
    on a body in the avatar's skin tone and shirt colour, `size` wide × 1.5 × `size` tall, feet at the bottom.
    CSS poses: idle, attack (overhead swing, `delayMs` in time with the projectile), cheer, brace, climb, fall;
    the class weapon in the right hand (pops in when equipped). Used in the battle arena and on the Climb (the
    lobby playground keeps round heads: its collisions are radius-based).
  * Cinematic wipes: `components/world/PhaseWipe.tsx` + `styles/transitions.css`, keyed by phase + question:
    ink brush (question), slash (reveal), dust (leaderboard), light burst (podium); never on the first screen,
    off under reduced motion. `wipeFor` in `lib/world.ts`.
  * Impact: `.ba-spark` at every projectile hit, `.ba-scene[data-shake]` and `.ba-flash` on a stagger-sized hit.
  * Lobby camp: `components/lobby/CampScenery.tsx` + `styles/camp.css` behind the projector playground
    (tents, campfire, firelight, rocks), with the monster's silhouette and blinking eye on the horizon when a
    boss battle is on (`Playground lurker`).
* **Leaderboard animation engine** (`src/lib/leaderboard/`, pure, unit-tested, never touches scores):
  `config.ts` (all thresholds and the 4 s timeline), `movement.ts` (small/medium/major/legendary up,
  minor/medium/major/epic down, same, new), `themes.ts` (20 themes: 8 up, 7 down, 5 idle), `selection.ts`
  (eligible by movement → random, avoids each student's last 3), `events.ts` (legendary comeback, champion
  takeover/defence, rivalry, near miss, streak, from real data only), `engine.ts` (dedupe/stale by update id,
  80–120 ms stagger, failed-theme fallback). UI: `components/leaderboard/` (`ThemeActor` with an error boundary,
  `Leaderboard`, `Podium`, `AnimatedNumber`) and `hooks/useLeaderboardPlayback.ts` (timeline, interruption,
  reduced motion = final board at once).
* **Screens:** host lobby gets **Start game** and becomes the game controls; projector shows question → reveal
  (correct tile + answer counts + explanation) → top-10 animated leaderboard → podium; phones answer, lock in, see
  Correct / Not this time (never red), their rank card with their own animation, and the compact leaderboard.

### Importing questions from ChatGPT (JSON)

* Quiz editor → **Import using ChatGPT** (under "Add question"): `components/quiz/ImportQuestionsDialog.tsx`, logic in
  `lib/quiz-import.ts`. Three steps: copy a built-in prompt (number of questions, mix, students), paste ChatGPT's JSON
  and validate it, review/edit, then add. **Rally makes no AI or network call for this**; the teacher runs ChatGPT.
* Schema: `quiz_title`, optional `description`, `questions[]` with `question_text`, `question_type`
  (`multiple_choice` | `true_false`), `options[{id,text}]`, `correct_answer` (an option id), `explanation`, optional
  `difficulty`, `topic`. Questions become ordinary `QuestionDraft`s (reducer action `importQuestions`), so they are
  saved by `save_quiz` and checked again by the server like hand-made questions. No new tables.
* **Code blocks** (programming quizzes): a question may carry `code { language, content }` (python, c, cpp,
  java; `text` for pseudo-code; other ids are stored and shown as plain text), and an answer may be a code
  snippet (`isCode`). The JSON import accepts `"code"` on questions and on options; the prompt tells ChatGPT
  to keep code out of `question_text`. Highlighting: `lib/code.ts` (Prism's tokenizer, rendered as React text,
  never HTML), `components/code/CodeBlock` (display: language label, line numbers, sideways scroll) and
  `CodeEditor` (textarea over the highlighted code; Tab indents). The projector puts code on the left and the
  answers on the right; phones scroll long lines. **Nothing compiles or runs code.** Add a language: import its
  Prism component in `lib/code.ts` and add a line to `LANGUAGES`.

### Next

* Not built yet: pause/resume, automatic progression (the host clicks Next), emoji reactions, confetti,
  Quiz History (`/teacher/analytics`), Playwright e2e and k6 load tests (Phase 6). No "100 students" claim until then.

---

## 11. Known limitations and open items

* Replaced or removed images stay in storage as orphans. A cleanup job is planned.
* Phase 3 ended sessions and participant rows are kept indefinitely (Quiz History will use them). Add a
  retention job before the database nears the free 500 MB.
* The nickname blocked-word list is short and English-only; teachers can always remove a player.
* A removed student could rejoin by clearing site data (a new anonymous identity). Locking the lobby stops this.
* `uqr` (MIT, a few KB gzipped) is the only new dependency; it encodes QR codes locally.
* `npm audit` reports a moderate advisory in ESLint's `minimatch` (dev-only, never shipped).
* `File.md` and `Context.md` in the repo root were created by the owner; `File.md` is empty and untracked.
* Bundle: the critical path is about 180 KB gzipped (React DOM about 71, router plus supabase-js about 67,
  Motion core about 36), with Motion features (about 33 KB) loading after first paint. Revisit in Phase 6.
* `/teacher/analytics` is labelled "Quiz History" (basic session history only; advanced analytics is out of
  scope for V1).

---

## 12. Docs index

* [README.md](README.md): quick start and scripts
* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): decisions, full DB design, realtime, limits, security, phases
* [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md): project setup, auth settings, SMTP
* [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): GitHub and Cloudflare Pages or Vercel (section 7) (`npm run build`, output `dist`,
  `NODE_VERSION=22`)
* [docs/TESTING.md](docs/TESTING.md): test coverage and manual checklists
* [docs/DESIGN.md](docs/DESIGN.md): the "Match Day" visual design system (palette, type, motion, every screen)
* [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md): common errors and fixes
