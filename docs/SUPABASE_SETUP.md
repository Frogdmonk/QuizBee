# Supabase setup

Everything here works on the **free plan** with no credit card. Supabase occasionally renames dashboard menus, so
if a label differs slightly, look for the closest match.

## 1. Create the project

1. Sign in at <https://supabase.com/dashboard> and click **New project**.
2. Pick a name (e.g. `rally`), set a strong database password (store it in a password manager), and choose the
   **region closest to your school**. Latency to the region directly affects answer acknowledgement times.
3. Wait for provisioning to finish (1–2 minutes).

## 2. Copy the API values into `.env.local`

**Project Settings → API Keys** (and **Project Settings → Data API** for the URL):

| Dashboard value | `.env.local` variable |
|---|---|
| Project URL (`https://<ref>.supabase.co`) | `VITE_SUPABASE_URL` |
| **Publishable key** (`sb_publishable_…`), or the legacy **anon public** key | `VITE_SUPABASE_PUBLISHABLE_KEY` |

```bash
cp .env.example .env.local     # then edit the two values
```

> ⚠️ **Never** copy the *secret* key (`sb_secret_…`) or the legacy `service_role` key into any `VITE_*` variable.
> Those bypass all security. The app detects this and refuses to start.

## 3. Apply the database migrations

**Option A: Supabase CLI (recommended).** The CLI ships as an npm package, so nothing else needs installing.

```bash
npx supabase login                         # opens the browser once
npx supabase link --project-ref <ref>      # <ref> is the id in your project URL
npx supabase db push                       # applies everything in supabase/migrations
```

**Option B: SQL editor.** Open **SQL Editor → New query**, paste the contents of each file in
`supabase/migrations/` **in filename order**, and click **Run** for each one.

Verify: **Table Editor** should list `teacher_profiles` with a shield icon showing RLS is enabled.

## 4. Authentication settings (required)

### 4.1 URL configuration: **Authentication → URL Configuration**

* **Site URL:** your production URL, e.g. `https://rally-quiz.pages.dev` (use `http://localhost:5173` until you
  deploy).
* **Redirect URLs:** add all of these:
  ```text
  http://localhost:5173/**
  https://<your-project>.pages.dev/**
  https://*.<your-project>.pages.dev/**
  ```
  The last entry allows Cloudflare preview deployments. Email confirmation and password reset links only
  redirect to URLs on this list.

### 4.2 Providers: **Authentication → Sign In / Providers**

* **Email:** enabled.
  * **Confirm email:** recommended **on** for production, which requires SMTP (§4.4). For a quick pilot without
    SMTP, turn it **off** so teachers can sign in right after registering.
  * **Minimum password length:** `8` (the app also requires letters and numbers).
* **Allow anonymous sign-ins:** **on. Required from Phase 3.** Students and projector devices join through
  anonymous sessions. While it is off, `/join` shows "Student joining is not enabled on the server yet".

### 4.2b Realtime: **Realtime → Settings**

* Live sessions use **private** channels (`session:{id}:host|game|lobby`). Who may receive is decided by the
  RLS policy on `realtime.messages` that the Phase 3 migration creates; there is no send policy, so clients
  can only receive. Nothing needs enabling for this to work.
* Optional hardening: turn **off** "Allow public access" so that only private channels can be used at all.

### 4.3 Rate limits: **Authentication → Rate Limits**

| Setting | Default | Set to | Why |
|---|---|---|---|
| Anonymous sign-ins (per hour, per IP) | 30 | **1000** | A whole class shares one school IP |
| Token refreshes (per 5 min, per IP) | 150 | **600** | 100 phones refresh tokens around the same time |
| Sign-ups and sign-ins (per 5 min, per IP) | 30 | **300** | Staff-room / shared networks |

`supabase/config.toml` mirrors these values for the local CLI stack.

### 4.4 Email delivery (SMTP), needed for password reset

Supabase's built-in sender is for testing only: a handful of emails per hour, and recent projects only deliver
to your own team's addresses. For real teachers, connect a free SMTP provider:

1. Create a free account with an SMTP provider that has a free tier (for example **Brevo**, about 300
   emails/day, or **Resend**, about 100/day, which needs your own domain).
2. Verify a sender address or domain with that provider.
3. In Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP**, then enter host, port, user,
   password and sender.
4. Raise **Rate Limits → Emails sent per hour** (e.g. to 30).

Optionally customise the **Confirm signup** and **Reset password** templates under **Authentication → Emails →
Templates**.

## 5. Verify Phase 1

1. `npm run dev` and open <http://localhost:5173>.
2. Register a teacher account. With *Confirm email* off you land on the dashboard. With it on, confirm via the
   email link first.
3. In **Table Editor → teacher_profiles** you should see one row with your name.
4. Change your name on **Profile**, reload, and check that it persisted.
5. Sign out, open `/teacher/dashboard`, and check that you are redirected to `/login?next=…`.
6. **Forgot password** (needs SMTP): request a link, open it, set a new password, and confirm you are signed in.

## 6. Free-plan notes

* Projects **pause after about 7 days of inactivity**. Open the dashboard and click **Restore** before a lesson
  if the project has been idle.
* Only one free project per organisation stays active per region in some plans. Keep this project dedicated to
  Rally.
