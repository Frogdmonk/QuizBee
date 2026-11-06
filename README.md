# QuizBee: live classroom quizzes

A real-time multiplayer classroom quiz platform. Teachers build quizzes and host live games; students join from
their phones with a PIN or QR code (no accounts); a projector view shows questions, countdowns and an animated
leaderboard.

**Stack:** React 19 · Vite 8 · TypeScript · Tailwind CSS 4 · Motion · React Router · React Hook Form + Zod ·
Supabase (Postgres, Auth, Realtime, Storage) · Cloudflare Pages or Vercel. Free-tier only; no paid APIs.

> **Build status: Phases 1, 2a, 2c and 3 complete.** Foundation, teacher authentication, the quiz builder and
> library, workspaces with quiz sharing, and live-session lobbies (PIN and QR join, avatar builder, waiting
> room, projector lobby) work today. Share links (Phase 2b), the game engine (Phase 4), leaderboards and
> reactions (Phase 5) and load testing (Phase 6) follow.
> See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quick start

Requirements: **Node.js 20.19+ or 22.12+** and a free Supabase project.

```bash
npm install
cp .env.example .env.local     # fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push           # applies supabase/migrations
npm run dev                    # http://localhost:5173
```

Then complete the **required** dashboard settings in [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) (redirect
URLs, anonymous sign-ins, rate limits, SMTP).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on port 5173 |
| `npm run build` | Type-check and build the production bundle into `dist/` |
| `npm run preview` | Serve the production build locally (port 4173) |
| `npm test` | Run unit and database tests |
| `npm run test:unit` / `npm run test:db` | Run one test project |
| `npm run typecheck` / `npm run lint` | Static checks |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Project URL, e.g. `https://abcd.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | Publishable (`sb_publishable_…`) or legacy anon key. **Never the secret / service_role key.** The app refuses to start with one. |
| `VITE_PUBLIC_SITE_URL` | no | Public origin used in share links and QR codes; defaults to the current origin |

`.env`, `.env.local` and all other `.env.*` files except `.env.example` are git-ignored.

## Project layout

```text
src/app         router, guards, providers        src/pages       lazy-loaded route pages
src/components  ui/ design system + features     src/services    all Supabase calls
src/contexts    auth + toast contexts            src/lib         env, clients, validation
supabase/       config.toml, migrations, seed    tests/          unit, integration/db (PGlite), e2e, load
docs/           architecture, setup, deploy, testing, troubleshooting
```

## Documentation

* [Architecture and V1 plan](docs/ARCHITECTURE.md): decisions, database design, realtime, limits, security
* [Supabase setup](docs/SUPABASE_SETUP.md)
* [Deployment (GitHub + Cloudflare Pages or Vercel)](docs/DEPLOYMENT.md)
* [Testing](docs/TESTING.md)
* [Troubleshooting](docs/TROUBLESHOOTING.md)
* [Design system ("Match Day")](docs/DESIGN.md): palette, type, motion and the layout of every screen

## Security model in one paragraph

The browser only ever holds the publishable key. Every table has Row Level Security, and Supabase's broad default
grants are revoked so each table and function must be granted explicitly (verified by tests). Game state changes
will go through transactional Postgres functions that validate membership, deadlines and versions. Answer keys
live in tables students cannot read, and scores are computed only on the server.
