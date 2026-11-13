---
name: pre-deploy-check
description: Checklist to run before putting a project live — debug off, keys hidden, security headers, HTTPS, backups, error pages, no test data, licences, and a final look. Use before any deploy or publish, when the user says "go live", "publish", "deploy", or "put it online".
---

# Pre-deploy check

Rules this follows: 6 (security), 7 (secrets), 8.8 (main complete), 2.3 (deploying always asks first), 6.6 (licences), 9.5 (proof), 10 (notifications).

**Deploying is always an ask-first action** (rule 2.3): it sends the project to an outside service and may cost money. This skill does the *checking*; the actual deploy needs the user's yes, with the command explained part by part (`explain-command`).

Work through the list in order. Mark each item ✅ / ❌ / ⚠️ with evidence. **A ❌ blocks the deploy** until fixed or the user explicitly accepts the risk in plain words.

## 1. The code is complete and working
- [ ] `main` contains everything (`merge-manager` skill). No important work stranded on other branches.
- [ ] Build passes, tests pass, type check passes — run them now, show the result.
- [ ] No leftover debug code: `console.log`, `debugger`, commented-out blocks, `TODO` in running paths.
- [ ] No test data, test accounts, fake users or "lorem ipsum" in what ships (rule 9.6).

## 2. Secrets (rule 7)
- [ ] `.env` is git-ignored. **Never open it**; check with `git check-ignore .env` and `git ls-files | grep -i env`.
- [ ] `.env.example` lists every variable name, with instructions, no values.
- [ ] No keys or tokens in code, config, logs or the built output. Search the repo and `git log -p` for key-shaped strings (patterns like `sk_live_`, `AKIA`, `ghp_`, `-----BEGIN`), **without printing any match** — report only file and line.
- [ ] Production keys are different from test keys and are set **in the host's dashboard** by the user, not in files.
- [ ] If a real key was ever committed: it counts as leaked — the **user** must create a new one (rule 6.4). Tell them exactly where.

## 3. Settings that must change for production
- [ ] **Debug / development mode is OFF** (`NODE_ENV=production`, `DEBUG=false`, framework dev flags).
- [ ] Error pages don't show stack traces or file paths to visitors.
- [ ] **CORS** is not `*` unless the API is truly public.
- [ ] Cookies: `Secure`, `HttpOnly`, `SameSite` set; sessions have an expiry.
- [ ] **HTTPS only**; HTTP redirects to HTTPS.
- [ ] Database/admin panels are not reachable from the internet; default passwords changed (by the user).
- [ ] Rate limits on login, signup, password reset and any AI/email endpoint.

## 4. Security headers (check the live or preview URL with `curl -I`)
- [ ] `Content-Security-Policy` (at least a sensible default)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Strict-Transport-Security`
- [ ] Clickjacking protection (`frame-ancestors` in CSP or `X-Frame-Options`)
- [ ] `Referrer-Policy`
Missing headers on a static site are Medium at most; on an app with logins, High.

## 5. Dependencies and licences
- [ ] `npm audit` (or the stack's equivalent) — report high/critical to the user; **don't upgrade on your own** beyond safe patch updates (rule 6.4).
- [ ] No package newer than `PACKAGE_WAIT_DAYS` (rule 6.4a).
- [ ] Licences OK for the project's use; `CREDITS.md` complete (rule 6.6).

## 6. Personal data (rule 6.5)
- [ ] Only the data actually needed is stored; the user agreed to what's stored.
- [ ] Not in logs, URLs, error messages, analytics.
- [ ] There is a way to delete a user's data; a privacy note exists if data is collected.
- [ ] No real people's data in the repo or the screenshots.

## 7. Safety net
- [ ] **Backups** exist for any real database and the user knows how to restore. (A deploy that can't be undone needs a backup first.)
- [ ] Know the rollback: which previous version/commit to redeploy.
- [ ] Monitoring/notifications for errors, if the host offers them.

## 8. The final look (rule 9.7, `design-review`)
- [ ] Key pages screenshot at 390 / 768 / 1440 px; no console errors, no broken links, images have alt text, favicon present, page titles real.
- [ ] Empty, loading and error states exist where data loads.
- [ ] Accessible: contrast, keyboard use, visible focus.

## 9. Host and cost
- [ ] Which service, which plan, what it costs, who owns the account — the **user** decides and creates the account/keys.
- [ ] If anything costs money → say the price, ask (rule 2.3).
- [ ] Free-tier terms allow what the project does (e.g. commercial use) — check the *current* terms.

## Report

```
Pre-deploy check — <project>
✅ Build + 38 tests pass · ✅ no secrets in repo · ✅ debug off · ✅ HTTPS
⚠️ Missing Content-Security-Policy header (Medium) — I can add it, want me to?
❌ Blocking: production Stripe key is not set in the host — you need to add it:
   Vercel → Project → Settings → Environment Variables → STRIPE_SECRET_KEY
Not checked: email sending (no mail service in this environment).
```

If everything is ✅ or accepted: **ask for the yes to deploy**, then explain the deploy command part by part. After deploying, open the live URL once and look; send the ✅ notification.
