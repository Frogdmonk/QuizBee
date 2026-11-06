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
