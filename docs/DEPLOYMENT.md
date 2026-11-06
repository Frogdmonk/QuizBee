# Deployment: GitHub + Cloudflare Pages

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
