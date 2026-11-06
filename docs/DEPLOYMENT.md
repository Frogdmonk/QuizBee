# Deployment: GitHub + Cloudflare Pages or Vercel

Cloudflare Pages (sections 1–6) and Vercel (section 7) are both free and both supported.

## 1. Push to GitHub

```bash
git init                      # once, if the folder is not a repository yet
git add .
git status                    # check that NO .env / .env.local file is listed
git commit -m "Rally Phase 1: foundation and authentication"
git branch -M main
```

Create an empty repository on GitHub (no README or licence, to avoid merge conflicts), then:

```bash
git remote add origin https://github.com/<you>/rally-classroom-quiz.git
git push -u origin main
```

If you use the GitHub CLI, `gh repo create rally-classroom-quiz --private --source . --push` does both steps.

## 2. Create the Cloudflare Pages project

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → the **Pages** tab → **Connect to Git**.
   (Cloudflare also promotes "Workers" for static sites. Pick **Pages** for this guide.)
2. Authorise GitHub and select the repository.
3. Build settings:

   | Setting | Value |
   |---|---|
   | Framework preset | `React (Vite)` (or `None`) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | *(empty)* |

4. **Environment variables** (add them for **Production** and **Preview**):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | your publishable key |
   | `VITE_PUBLIC_SITE_URL` | `https://<project>.pages.dev` (or your custom domain) |
   | `NODE_VERSION` | `22` *(the repo also has `.node-version`)* |

5. **Save and Deploy.** The first build takes about 1–2 minutes.

`VITE_*` values are embedded at **build time**. After changing them, trigger a new deployment
(**Deployments → … → Retry deployment**).

## 3. After the first deploy

1. Copy the `*.pages.dev` URL.
2. In Supabase, set **Authentication → URL Configuration → Site URL** to it and add it to **Redirect URLs**
   (see `docs/SUPABASE_SETUP.md` §4.1).
3. Open the site, register, sign out and sign in again.

## 4. How routing and caching work

* **SPA routing:** with no top-level `404.html` in the build, Cloudflare Pages serves `index.html` for unknown
  paths, so deep links like `/teacher/profile` or `/join/123456` work on refresh.
* **Caching and security headers:** `public/_headers` makes hashed assets immutable (one-year cache) and adds CSP,
  `X-Frame-Options`, `nosniff`, `Referrer-Policy` and `Permissions-Policy`.
* **New deploys while pages are open:** if a browser requests a code chunk that no longer exists, the app reloads
  itself once to pick up the new version.

### Content Security Policy

The CSP allows network connections only to `*.supabase.co`. If you put Supabase behind a **custom domain**, add
it to `connect-src` (both `https://` and `wss://`) and `img-src` in `public/_headers`.

## 5. Custom domain (optional, free)

**Pages project → Custom domains → Set up a domain.** Then update `VITE_PUBLIC_SITE_URL`, redeploy, and add the
domain to Supabase's Site URL and Redirect URLs.

## 6. Production checklist

- [ ] Migrations applied (`npx supabase db push`)
- [ ] Anonymous sign-ins enabled, rate limits raised
- [ ] Site URL and Redirect URLs include the production domain
- [ ] SMTP configured (for password reset) or *Confirm email* deliberately off
- [ ] Env vars set for Production **and** Preview, then redeployed
- [ ] `npm run build` passes locally

---

## 7. Alternative: Vercel (free Hobby plan)

The repo also deploys to Vercel. [`vercel.json`](../vercel.json) does what `public/_headers` does on Cloudflare:

* **SPA fallback:** every path except `/assets/*` is rewritten to `index.html`, so refreshing `/join/482913` or
  `/teacher/quizzes` works. Vercel ignores `public/_headers`; without these rewrites deep links return 404.
* **Headers:** the same Content-Security-Policy, `X-Frame-Options`, `nosniff`, `Referrer-Policy` and
  `Permissions-Policy`, plus one-year immutable caching for `/assets/*`.

`tests/unit/hosting-config.test.ts` fails if the two files drift apart. **When you change a header, change both.**

### Steps

1. **Supabase first** (see [SUPABASE_SETUP.md](SUPABASE_SETUP.md)): apply every migration in
   `supabase/migrations/` in filename order, turn on anonymous sign-ins, raise the anonymous sign-in rate limit
   to 1000/h, and either connect SMTP or turn off *Confirm email*.
2. Sign up at <https://vercel.com> with **Continue with GitHub** and choose the **Hobby** (free) plan.
3. **Add New… → Project**, import the repository. If it is not listed, use **Adjust GitHub App Permissions**.
4. Build settings are read from `vercel.json` (framework Vite, `npm run build`, output `dist`). Leave them.
5. **Environment Variables** (Production and Preview):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | the **publishable** (`sb_publishable_…`) or legacy anon key, **never** the secret / service_role key |
   | `VITE_PUBLIC_SITE_URL` | your Vercel URL (set after the first deploy, see step 8) |

6. Click **Deploy**. You get a URL such as `https://quizbee-xyz.vercel.app`.
7. **Settings → General → Node.js Version:** `22.x`.
8. Set `VITE_PUBLIC_SITE_URL` to the production URL (QR codes and join links use it), then **Deployments → … →
   Redeploy**. `VITE_*` values are baked in at build time, so every change needs a redeploy.
9. Supabase → **Authentication → URL Configuration**: Site URL = the Vercel URL; add `https://<your-app>.vercel.app/**`
   to Redirect URLs (keep `http://localhost:5173/**`). For preview deployments, also add
   `https://*-<your-vercel-team>.vercel.app/**`.
10. Smoke test: register, create and publish a quiz, **Live Sessions → Host**, open the projector view, scan the
    QR code with a phone, join, and check the avatar appears on the projector.

Every push to `main` redeploys production; other branches get preview URLs.

### Troubleshooting

| Symptom | Cause |
|---|---|
| "Setup needed" screen | Env vars missing, or not redeployed after adding them |
| 404 when refreshing a page | `vercel.json` missing from the deployed commit |
| Email links open `localhost` | Supabase Site URL still points at localhost |
| "Student joining is not enabled" | Anonymous sign-ins are off in Supabase |
| QR code points at the wrong host | `VITE_PUBLIC_SITE_URL` not set, or not redeployed |

The Hobby plan is for personal, non-commercial use. Free Supabase projects pause after about 7 days idle:
restore the project in the Supabase dashboard before a lesson.
