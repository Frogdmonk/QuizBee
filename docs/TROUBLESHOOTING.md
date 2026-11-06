# Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Setup needed: The app is not configured yet" | Missing or invalid `VITE_*` variables | Create `.env.local` from `.env.example` and **restart** `npm run dev`. On Cloudflare, set the variables and **redeploy** (they are baked in at build time). |
| App says the key is a SECRET / service_role key | Wrong key copied | Use the **publishable** (or legacy anon) key. Then rotate the leaked secret key in Supabase → API Keys. |
| "Cannot reach the server" | Wrong URL, offline, or the project is paused | Check `VITE_SUPABASE_URL`. In the dashboard, **Restore** a paused project. |
| Registration says "check your inbox" but no email arrives | Built-in email sender limits | Configure SMTP (`docs/SUPABASE_SETUP.md` §4.4), or turn *Confirm email* off for a pilot. |
| Confirmation or reset link opens `localhost` in production | Site URL still set to localhost | **Authentication → URL Configuration:** set Site URL and Redirect URLs to the production domain. |
| Reset link shows "Reset link not valid" | Link expired (1 h), already used, or opened after a newer one was requested | Request a new link and use the latest email. |
| "Too many attempts" / HTTP 429 | Auth rate limits | Raise limits (`SUPABASE_SETUP.md` §4.3), or wait 5 minutes. |
| Teacher profile shows "Could not load your profile" | Migration not applied | Run `npx supabase db push`. The app recreates missing profiles automatically through `ensure_teacher_profile`. |
| Console warning "Multiple GoTrueClient instances" | Teacher and student clients in the same tab (by design, with separate storage keys) | Harmless. It only appears when one tab visits both teacher and student pages. |
| Blank page after a deploy | Old cached chunks | The app auto-reloads once. If not, hard-refresh (Ctrl+Shift+R). |
| Requests blocked with a CSP error in the console | Supabase on a custom domain | Add the domain to `connect-src` / `img-src` in `public/_headers`. |
| Cloudflare build fails with a Node/Vite version error | Old Node in the build image | Set `NODE_VERSION=22` (also pinned in `.node-version`). |
| `npm run test:db` fails with "Migration … failed" | SQL error in a migration | The message names the file and the Postgres error. Fix it and rerun. |
| Vite prints a `configLoader` warning in tests | Informational notice from Vite 8 | Safe to ignore. |
