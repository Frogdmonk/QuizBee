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
