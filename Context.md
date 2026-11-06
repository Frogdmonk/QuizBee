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
| 4 | Game engine: start, open question, submit answer, close and score, pause/resume, next, end, auto-advance, clock sync, reconnection, game screens | Planned |
| 5 | Animated leaderboard, emoji reactions, confetti, podium, final results, session history (`/teacher/analytics` = "Quiz History") | Planned |
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
* Hosting on Cloudflare Pages; GitHub for source.
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

### Phase 4 (next)

Add a new migration (don't edit Phase 3): snapshot tables (`session_questions`, `session_question_options`,
`session_answer_keys`), `answers`, `participant_scores`, and the RPCs `start_game`, `submit_answer`,
`close_question`, `next_question`, `pause_game`/`resume_game`, `end_game`, `advance_if_due`, `get_game_state` and
`server_now`. Full design in ARCHITECTURE.md §2.1–2.2 and §3.2–3.4. The status and phase columns and
`state_version` already exist on `game_sessions`. Replace the "Phase 4" notes in `HostLobbyPage`,
`PlayerLobbyPage` and `PresenterPage`, and decide whether late joiners may enter an `in_progress` game (today
`join_session` refuses them).

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
* [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): GitHub and Cloudflare Pages (`npm run build`, output `dist`,
  `NODE_VERSION=22`)
* [docs/TESTING.md](docs/TESTING.md): test coverage and manual checklists
* [docs/DESIGN.md](docs/DESIGN.md): the "Match Day" visual design system (palette, type, motion, every screen)
* [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md): common errors and fixes
