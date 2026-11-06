# Rally: Architecture & Version 1 Plan

This document is the technical review of the Version 1 requirements: contradictions found, the architecture,
the final database design, the folder structure, the delivery phases, free-tier limits, security-sensitive
operations, the plan for 100 concurrent students, and the animation performance strategy.

> **Status:** Phase 1 (foundation) and Phase 2a (quiz builder and library) are implemented. Sharing (Phase 2b) and Phases 3–6 are designed here and will be built in order.
> Anything described for a later phase is a design, not a claim that it exists.

---

## 1. Requirement review: contradictions and decisions

| # | Tension in the brief | Decision |
|---|---|---|
| 1 | **Anonymous students on a school network vs. Supabase's default rate limit.** Supabase allows **30 anonymous sign-ins per hour per IP** by default. A classroom behind one NAT IP would fail at student #31. | Raise *Auth → Rate Limits → anonymous sign-ins* (we set 1000/h) and *token refresh*. Documented as a **required** setup step. CAPTCHA (Cloudflare Turnstile, free) can be added later if abuse appears. |
| 2 | **Password reset / email confirmation vs. "no paid services".** Supabase's built-in email sender is for testing only: it sends just a few emails per hour, and recent projects only deliver to the project team's own addresses. | Two free options, documented in `docs/SUPABASE_SETUP.md`: (a) connect a free SMTP tier (e.g. Brevo or Resend free plans) for real reset and confirmation emails; (b) for a pilot, disable "Confirm email". Password reset needs (a). |
| 3 | **"Use Supabase Edge Functions" vs. latency and atomicity.** Every game operation must be atomic and answer within 500 ms p95. Edge Functions add a network hop and cold starts and need a service-role key to write. | All game operations are **PostgreSQL RPC functions** (`SECURITY DEFINER`, explicit grants). They run inside one transaction, with no cold start and no service key anywhere. **V1 needs no Edge Functions.** They stay available for future work Postgres can't do (AI, outbound email, image processing). |
| 4 | **Suggested 5 Realtime channels per session vs. free-tier message and join budgets.** Each channel a phone joins costs joins and messages; Presence fans out O(n²). | Three topics per session (see §3.4). **Presence is not used for students**: with 100 students every join and leave would be re-sent to everyone, and the free tier caps Presence at a low message rate. Connection status comes from a throttled heartbeat RPC instead. |
| 5 | **Reaction "broadcasting" vs. "don't overwhelm Realtime".** If students could broadcast directly, a single scripted client could flood the project-wide message budget and delay question delivery for everyone. | Students get **no write access to any channel**. Reactions go through an RPC with a per-student throttle and a per-session cap, and are broadcast only to the teacher and projector. Students don't receive each other's reactions, which saves O(n²) messages. |
| 6 | **Automatic progression without a server scheduler.** Browsers throttle timers in background tabs; a teacher laptop that is projecting usually has the host tab hidden. | The server stores `phase_ends_at`. Any authorised client (host **or projector**) can call `advance_if_due(session, version)`; the server advances **only if the time has really passed** and the version matches. The projector window is in the foreground, so it keeps the game moving. If no one nudges, the game simply waits. It is never advanced early or twice. |
| 7 | **Projector route `/presenter/:sessionId` must be read-only, but the projector may be a different device.** | Same browser: it reuses the teacher's session. Different device: the teacher copies a presenter link carrying a one-time **presenter key**. The device signs in anonymously and claims a read-only viewer role with that key. The key is never shown as a QR code. |
| 8 | **"Do not expose correct answers" vs. reconnection and reveal.** If students could read their own `answers` row, `is_correct` would leak the answer before the reveal. | Students never read `answers`, `session_answer_keys` or quiz tables directly. Everything comes through `get_game_state()`, which includes correctness **only after the question is closed**. |
| 9 | **Speed scoring "from database time" vs. client clocks.** | Scoring uses `clock_timestamp()` at insert time against the stored `deadline_at`. Clients estimate their clock offset (`server_now()` RPC, best of 3 round trips) and render countdowns from `deadline_at`. Countdowns are never started from message arrival. |
| 10 | **Image transformations** (resizing) are a paid Supabase feature. | Images are resized and converted to WebP **in the browser** (canvas) before upload. Storage serves them through its CDN. |
| 11 | **"Quiz History" nav item vs. `/teacher/analytics` route.** | `/teacher/analytics` renders *Quiz History* (basic session results). Advanced analytics stays out of scope. |
| 12 | **`reactions` table in the suggested schema.** Persisting every emoji costs a write per tap and has no product use in V1. | A `session_reaction_counters` row per session and second backs the rate limit. Individual reactions are not stored. |
| 13 | **Free-tier project pausing.** Free Supabase projects pause after about a week without activity. | Documented. The teacher may need to "Restore" the project in the dashboard before a lesson after a long break. |

---

## 2. Architecture overview

```text
 ┌────────────────────────────── Cloudflare Pages (static, CDN) ──────────────────────────────┐
 │  React SPA (Vite)  ── route-level code splitting ──                                         │
 │   • Teacher dashboard  (teacher Supabase client, email+password session)                   │
 │   • Student game       (player Supabase client, anonymous session, separate storage key)   │
 │   • Projector          (teacher session OR anonymous + presenter key)                      │
 └──────────────┬──────────────────────────────────────────────────────┬────────────────────────┘
                │ HTTPS (PostgREST: tables + RPC)                     │ WSS (Realtime broadcast, receive-only)
 ┌──────────────▼──────────────────────────────────────────────────────▼────────────────────────┐
 │ Supabase                                                                                       │
 │  Auth ─ teachers: email/password · students: anonymous                                        │
 │  Postgres ─ RLS on every table · SECURITY DEFINER RPCs for every state change                 │
 │            · RPCs call realtime.send() inside the same transaction → broadcast after commit   │
 │  Realtime ─ private channels authorised by RLS on realtime.messages                           │
 │  Storage  ─ quiz-media bucket (owner-scoped writes)                                           │
 └───────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Core rules**

1. **Database is the source of truth.** Every state change is one RPC = one transaction. Broadcasts are
   notifications ("state v42 is out, here's the compact payload"), never the only copy of state.
2. **Clients never write game tables.** Students and teachers call RPCs. Tables carry RLS and only the minimum
   `SELECT` grants. Students have no table write privileges at all.
3. **Idempotency by version.** `game_sessions.state_version` increments on every transition. Host commands send
   the version they saw, and a stale version is a no-op that returns the current state. That covers "teacher
   clicked Next twice" and "two requests close the same question".
4. **Lazy, isolated auth.** Separate Supabase clients for teacher and player (different storage keys). A
   student join on a shared computer never signs the teacher out, and student pages never load teacher code.

### 2.1 Session state machine

```text
 lobby ──start_game──▶ question(open) ──close_question──▶ reveal ──show_leaderboard──▶ leaderboard
   ▲                      │  ▲                                                        │
   │                      │  └──────────────────── next_question ──────────────────────┘
   │                 pause/resume (deadline shifted by remaining time)                │
   │                                                              last question ──▶ podium ──▶ ended
 (cancel) ──▶ cancelled
```

* `close_question` runs when the deadline passes, when every active participant has answered, or when the host
  closes it early. It is idempotent: it locks the `session_questions` row `FOR UPDATE`, and in-flight answer
  submissions hold `FOR SHARE`, so scoring always sees every accepted answer.
* Pause stores `paused_remaining_ms` and clears `deadline_at`. Resume sets `deadline_at = now() + remaining`.
  Speed scoring uses time remaining, so a pause never changes points.

### 2.2 Scoring (server-side only)

```text
correct, speed scoring off : points
correct, speed scoring on  : round(points × (0.5 + 0.5 × remaining_fraction)),  remaining_fraction ∈ [0,1]
incorrect / no answer      : 0
late (clock_timestamp() > deadline_at) : rejected, not stored
```

Points are computed in `submit_answer` (stored on the `answers` row, invisible to students) and aggregated into
`participant_scores` (score, correct_count, rank, previous_rank) inside `close_question`. Ranks are standard
competition ranking (1, 2, 2, 4) ordered by score, with ties broken by earliest join only for display order.

---

## 3. Final database design

All tables live in `public` with RLS enabled. Internal helpers live in the non-exposed `private` schema.
Timestamps are `timestamptz`. IDs are `uuid` (`gen_random_uuid()`).

### 3.1 Content (teacher-owned)

| Table | Key columns | Constraints / indexes |
|---|---|---|
| `teacher_profiles` ✅ *(Phase 1)* | `id → auth.users`, `display_name`, `school_name` | name 1–60 chars; created by trigger for non-anonymous users only |
| `quizzes` | `owner_id → teacher_profiles`, `title`, `description`, `subject`, `cover_image_path`, `status` (`draft/published/archived`), `source_quiz_id` (copied-from), `question_count` | title 1–120; idx `(owner_id, status, updated_at desc)` |
| `quiz_questions` | `quiz_id`, `position`, `type` (`multiple_choice/true_false/image_choice`), `prompt`, `image_path`, `time_limit_seconds`, `points`, `speed_bonus`, `explanation` | time 5–120 (default 20); points 0–2000 (default 1000); `unique (quiz_id, position) deferrable` |
| `question_options` | `question_id`, `position`, `label`, `image_path`, `is_correct` | 2–4 options; `unique (question_id, position) deferrable`; partial unique idx: one correct per question |
| `quiz_shares` | `quiz_id`, `created_by`, `token_hash bytea`, `revoked_at`, `use_count` | `unique (token_hash)`; token = 32 random bytes (base64url), **only the SHA-256 hash is stored** |
| `quiz_share_imports` | `share_id`, `recipient_id`, `copied_quiz_id` | powers *Shared with Me* |

Quizzes are saved through `save_quiz(jsonb)`, one transaction that validates and replaces questions and options.
Sharing goes through `create_quiz_share`, `revoke_quiz_share`, `preview_shared_quiz(token)` and
`accept_quiz_share(token)`. Accepting deep-copies the quiz into the recipient's library, and the copy is fully
independent.

### 3.2 Live sessions (snapshotted at game start)

| Table | Key columns | Notes |
|---|---|---|
| `game_sessions` | `host_id`, `quiz_id` (nullable, `on delete set null`), `quiz_title`, `pin char(6)`, `status` (`lobby/in_progress/ended/cancelled`), `phase` (`lobby/question/reveal/leaderboard/podium`), `current_position`, `state_version`, `is_locked`, `is_paused`, `paused_remaining_ms`, `progression` (`manual/auto`), `reveal_seconds`, `leaderboard_seconds`, `phase_ends_at`, `max_participants` (100), `presenter_key_hash`, `started_at`, `ended_at` | partial unique idx on `pin` **where status in (lobby, in_progress)** |
| `session_questions` | `session_id`, `position`, `type`, `prompt`, `image_path`, `time_limit_seconds`, `points`, `speed_bonus`, `status` (`pending/open/closed`), `opened_at`, `deadline_at`, `closed_at` | snapshot: editing the quiz mid-game changes nothing |
| `session_question_options` | `session_question_id`, `position`, `label`, `image_path` | **no correctness column** |
| `session_answer_keys` | `session_question_id` PK, `correct_option_id`, `explanation` | **no student policy**; readable by the host only |
| `participants` | `session_id`, `user_id → auth.users`, `nickname`, `nickname_key` (normalised), `avatar_id`, `status` (`active/removed`), `joined_at`, `last_seen_at`, `last_reaction_at` | `unique (session_id, user_id)`; partial unique `(session_id, nickname_key)` where active |
| `answers` | `session_question_id`, `participant_id`, `option_id`, `answered_at` (`clock_timestamp()`), `is_correct`, `points_awarded` | **`unique (participant_id, session_question_id)`**; no student SELECT |
| `participant_scores` | `participant_id` PK, `session_id`, `score`, `correct_count`, `answered_count`, `rank`, `previous_rank` | updated only in `close_question` |
| `session_viewers` | `session_id`, `user_id`, `role` (`presenter`) | read-only projector devices |
| `session_reaction_counters` | `session_id`, `window_start`, `count` | per-second cap for reactions |
| `game_events` | `session_id`, `state_version`, `type`, `payload`, `created_at` | audit/debug trail of transitions |

### 3.3 Server-side operations (RPC)

| Operation | Caller | Key validation |
|---|---|---|
| `create_session(quiz_id, settings)` | teacher | owns quiz; quiz valid; generates unique PIN (retry loop); creates presenter key |
| `join_session(pin, nickname, avatar_id)` | student (anonymous) | session in lobby, not locked, not full; nickname rules and duplicates; idempotent per `auth.uid()` (a rejoin returns the same participant) |
| `remove_participant`, `set_lobby_locked` | host | host owns session |
| `start_game` | host | lobby, ≥1 participant; snapshots questions, options and answer keys |
| `submit_answer(question_id, option_id)` | student | active participant, question open, option belongs to question, `clock_timestamp() ≤ deadline_at`; `INSERT … ON CONFLICT DO NOTHING`; returns `accepted` / `duplicate` / `late` / `closed` |
| `close_question`, `show_leaderboard`, `next_question`, `pause_game`, `resume_game`, `end_game` | host | expected `state_version`; legal transition |
| `advance_if_due(session, version)` | host or presenter | only when `now() ≥ phase_ends_at` (auto mode) |
| `get_game_state(session)` | any member | role-filtered snapshot for reconnection; correctness only after close |
| `heartbeat(session)`, `send_reaction(session, emoji)` | student | throttled writes |
| `server_now()` | anyone signed in | clock-offset estimation |

### 3.4 Realtime channels

| Topic | Subscribers | Events (compact payloads) |
|---|---|---|
| `session:{id}:game` | participants, host, presenter | `state` (version, phase, question **without answers**, `deadline_at`), `reveal` (correct option, distribution), `leaderboard` (top 10 + `[participant_id, score, rank, prev_rank]` for everyone so each phone finds its own rank without an extra request), `removed` |
| `session:{id}:host` | host, presenter | `participant_joined/left`, `answer_count`, `reaction` |
| `session:{id}:lobby` | participants | debounced roster summary (count + latest joiners) |

All channels are **private**. RLS policies on `realtime.messages` allow `SELECT` (receive) only for members of
that session, and allow **no client `INSERT`** (send). Broadcasts originate only from RPCs via `realtime.send()`.

Note that Realtime authorisation is checked when a client joins a channel. A removed student may keep receiving
non-sensitive broadcasts until they reconnect, but every RPC rejects them immediately and the client leaves on
receiving `removed`.

---

## 4. Project structure

```text
├── public/                  favicon, Cloudflare _headers, (Phase 3) avatar SVG sprites
├── src/
│   ├── app/                 App root, router, guards, motion provider, error boundary
│   ├── components/
│   │   ├── ui/              design-system primitives (Button, TextField, Card, Alert, Badge…)
│   │   ├── marketing/       landing/auth illustrations
│   │   ├── teacher/         dashboard widgets, nav config
│   │   ├── quiz/            (P2) builder + preview
│   │   ├── student/         (P3) join, avatar picker, answer pad
│   │   ├── leaderboard/     (P5) animated ranking list, podium
│   │   └── presenter/       (P3–5) projector screens
│   ├── contexts/            React contexts (teacher auth, toasts; P3 game session)
│   ├── hooks/               useTeacherAuth, useToast; (P3+) useServerClock, useGameChannel…
│   ├── layouts/             Root, Public, Auth, Teacher
│   ├── lib/                 env, supabase clients, brand, validation (Zod)
│   ├── pages/               route components (lazy-loaded)
│   ├── services/            all Supabase calls (auth, profile; P2+ quizzes, sessions, game)
│   ├── types/               database types
│   ├── utils/               pure helpers (errors; P4 scoring display, timing)
│   └── styles/              Tailwind v4 theme tokens
├── supabase/
│   ├── config.toml          local CLI config (auth settings mirrored from production)
│   ├── migrations/          one migration per phase (+ fixes)
│   └── seed.sql             explicitly labelled development seed data
├── tests/
│   ├── unit/                Vitest + Testing Library (jsdom)
│   ├── integration/db/      migrations + RLS tests in PGlite (real Postgres in WASM)
│   ├── e2e/                 (P6) Playwright against a Supabase project
│   └── load/                (P6) k6 scripts for 100-participant sessions
└── docs/                    architecture, Supabase setup, deployment, testing, troubleshooting
```

---

## 5. Free-tier limits and bottlenecks

Values are the published free-plan limits at the time of writing. **Verify them in your dashboard**; Supabase
changes plans periodically.

| Resource | Free limit (approx.) | Our usage for one 100-student, 20-question game | Risk |
|---|---|---|---|
| Realtime concurrent connections | 200 | ~102 (100 phones + host + projector) | OK for **one** class at a time; two simultaneous 100-student classes would hit it |
| Realtime messages / month | 2 million | ≈ 100 recipients × ~4 broadcasts × 20 questions ≈ 8–12k | OK: roughly 150+ full games a month |
| Realtime messages / second | ~100 (tenant) | a question broadcast to 100 phones is ~100 deliveries at once | **Main risk.** How bursts are counted is the key question for the Phase 6 load test. Mitigation: heartbeat reconciliation (§7). Fallback: Pro plan |
| Realtime channel joins / second | ~100 | 100 students joining over ~30–60 s | OK; clients retry with jitter |
| Anonymous sign-ins | **30/h per IP by default** | 100 from one school IP | **Must be raised** (setup step) |
| Database size | 500 MB | ~2–5 MB per 100-student game (answers, events) | OK for thousands of games; history pruning possible later |
| Egress | 5 GB | images dominate: keep ≤ 200 KB each (client compression) | OK |
| Storage | 1 GB | quiz images | OK |
| Edge Function invocations | 500k/month | 0 in V1 | n/a |
| Project pausing | after ~7 days idle | | Restore before class |
| Auth emails | test-only sender | | Use free SMTP (§1, item 2) |

**Database throughput.** A burst of 100 `submit_answer` calls in about 2 s means ~50 short transactions per
second, each touching a few indexed rows. The free compute tier handles this comfortably through PostgREST's
connection pool. The load test will confirm it (we make **no claim of 100-student support until k6 has run**).

---

## 6. Development phases

| Phase | Scope | Exit criteria |
|---|---|---|
| **1 ✅** | Vite/React/TS foundation, Tailwind design system, Motion setup, Supabase clients, teacher auth (register, login, logout, reset, profile), protected routes, teacher shell, Phase 1 migration, Cloudflare config, docs | build passes; unit and DB tests pass |
| **2a ✅** | Quiz schema + RLS + Storage bucket; library (create, edit, duplicate, publish, archive, delete); builder with live preview, reordering, image upload; full-screen preview; dashboard stats | DB tests for ownership, validation and publishing; UI flows |
| **2b** | Sharing (links, preview, add to library, revoke); Shared with Me | DB tests for share tokens and copies |
| **3** | Session schema; PIN and QR; anonymous join, nickname rules, 12+ original SVG avatars; waiting room (teacher, student, projector); lock/unlock; remove; Realtime authorisation; reconnection to lobby | join, lock and remove tests; 2-device manual test |
| **4** | Game engine RPCs (start, open, submit, close, score, pause, resume, next, end, advance_if_due), clock sync, student, teacher and projector game screens, manual and auto progression, reconnection mid-question | scoring, deadline, duplicate and race tests in PGlite |
| **5** | Animated leaderboard (rank changes, top-10 entry, new #1), reactions, confetti, podium, final results, session history and review | reduced-motion check; low-end device check |
| **6** | k6 load tests (100 joins, 100 answers, reconnection storm), Playwright e2e, performance tuning, production deployment, free-tier findings | documented, measured results |

---

## 7. Handling 100 concurrent students

1. **Joining.** One RPC (`join_session`) after an anonymous sign-in, so two requests in total. The PIN lookup
   uses a partial unique index. The host channel is told about each join; students get a *debounced* roster
   summary, not 100 × 100 individual join events.
2. **Question delivery.** One broadcast per transition carrying the question text, options (without answers),
   `deadline_at` and `state_version`. Images are preloaded during the previous reveal and leaderboard phase.
3. **Answers.** `submit_answer` is a single short transaction with indexed lookups and
   `INSERT … ON CONFLICT DO NOTHING`. The acknowledgement is the RPC response itself, with no broadcast to other
   students. The host receives a coalesced `answer_count`.
4. **Close and leaderboard.** One set-based SQL statement updates all scores and ranks. One broadcast carries the
   top 10 plus a compact rank array for everyone (about 5 KB for 100 students).
5. **Missed events.** Every client tracks `state_version`. On reconnect, on returning to the tab, or when a
   version gap appears, it calls `get_game_state()`. A slow heartbeat (every 10–15 s, jittered) doubles as
   reconciliation and connection status, so the clients never poll in a tight loop.
6. **Clock fairness.** Everyone counts down to the same `deadline_at`, corrected by their measured clock
   offset. Screens are close to simultaneous, not perfectly so, because network latency differs per device.
   Fairness is guaranteed by the server deadline, not by screen timing.

## 8. Smooth animations on low-end phones

* **Motion via `LazyMotion` + `m` components.** Animation features (~33 KB gzip) load *after* first paint.
  `strict` mode prevents accidentally importing the full bundle.
* **Transform and opacity only.** No animated `width`, `height`, `top`, `box-shadow` or `filter`. Leaderboard
  reordering uses `layout` (FLIP, which is transform-based) on at most 10 rows.
* **Short-lived effects.** Confetti is a one-shot burst (fixed particle count, removed after ~1.5 s), not a
  running particle system. Floating reactions are capped (e.g. 12 on screen) and dropped beyond that.
* **Few re-renders.** The countdown is driven by a Motion value or `requestAnimationFrame` writing to one text
  node, not React state at 60 fps. Game state lives in a reducer keyed by `state_version`, and components
  subscribe to slices.
* **Reduced motion.** `MotionConfig reducedMotion="user"` plus a global CSS rule. Celebrations become simple
  fades.
* **Small bundles.** Every route is lazy-loaded. Zod is kept out of the entry chunk. The student path never
  downloads teacher code. Fonts are self-hosted variable WOFF2 with `unicode-range` subsets.

## 9. Security-sensitive operations

| Area | Protection |
|---|---|
| Service-role key | Never used by the app. The frontend refuses to start if a secret or `service_role` key is configured |
| Teacher data | RLS `owner_id = auth.uid()` plus explicit grants; anonymous JWTs are excluded (`is_anonymous`) |
| Default privileges | Migration revokes Supabase's broad defaults; every table and function is granted explicitly (tested) |
| Answer keys | Separate tables with no student policy; correctness reaches students only after close |
| Scores | Written only inside `SECURITY DEFINER` RPCs; students have no write grants |
| Answer submission | Membership, active status, open question, option ownership, deadline (`clock_timestamp()`), unique constraint |
| State transitions | Host check plus `state_version` compare-and-set; row locks prevent double advancement |
| Share links | 256-bit random tokens, SHA-256 hashes stored, revocable, accepting creates a copy |
| Presenter access | Read-only role via a hashed presenter key; no admin RPCs accept it |
| Realtime | Private channels; receive policy by membership; no client send policy |
| Redirects | `next` parameter restricted to same-origin paths (tested) |
| Headers | CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` via Cloudflare `_headers` |
| PII | Students give only a nickname; no email, no password |
