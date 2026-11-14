---
name: security-check
description: Check a project's code for real security risks — secrets, access control, input handling, payments, packages, SSRF, unsafe settings, rate limits, personal data — then FIX the safe problems first and report the rest ranked Critical to Low in plain words. Use for any meaningful or security-relevant change, before publishing, or when asked "is this secure". (Named security-check so it never clashes with Claude Code's built-in /security-review.)
---

# Security check

Rules this follows: 6.1 (real risks first), 6.2 (fix first, then report ranked), 6.4 (only safe fixes), 6.5 (personal data), 6.5a (**never break into anything**), 9.5 (proof), 7 (never open `.env`), 10.1 (🔴 for Critical).

Claude Code has a built-in `/security-review` for pending changes; this one is the harness version: it **fixes**, **proves**, and reports in plain words. Writing code safely in the first place is `secure-code`.

**Scope: the user's own project, on their own computer.** Never test live sites or other people's systems, never bypass logins or rate limits, never use found keys (rule 6.5a). Leaked keys belonging to someone else: don't use them, stop, tell the user.

## Step 1 — Know what you're checking

- Stack and entry points (`PROJECT_MAP.md`, `package.json`, routes, config).
- What it does with: logins, user data, payments, uploads, outside URLs, AI/email services.
- For a **change**: the diff. For a **project**: the high-risk areas first, not every file.

## Step 2 — Go through the real risks (rule 6.1)

Search with targeted greps; read only the relevant code. Only apply what fits the technology.

1. **Secrets** — keys/tokens/passwords in code, config, logs, committed history, or shipped to the browser (frontend `NEXT_PUBLIC_*` / `VITE_*` are public). Is `.env` git-ignored? (`git check-ignore .env` — **never open it**.) Search for key-shaped strings and report **file:line only, never the value**.
2. **Login and access** — can user B read/change user A's data (IDOR)? Does every route check *who* is asking, not just "logged in"? Admin actions protected? Password hashing correct (argon2/bcrypt/scrypt)? Session cookie flags?
3. **User input** — SQL built from strings; XSS (`innerHTML`, `dangerouslySetInnerHTML`, unescaped templates); command/shell injection; path traversal; unsafe file uploads (size, type, location); unsafe deserialization / `eval`.
4. **Payments and money** — prices/totals/discounts taken from the browser; webhook signatures not verified; floats for money.
5. **Packages** — fake/typo/abandoned/brand-new/known-vulnerable (`npm audit` or the stack's equivalent; `package-check` for new ones); install scripts.
6. **Server fetching URLs (SSRF)** — user-given URLs loaded server-side without an allow-list.
7. **Unsafe settings** — debug on, wildcard CORS with credentials, missing security headers (CSP, HSTS, nosniff, frame protection), cookies not `Secure`/`HttpOnly`, verbose errors.
8. **Rate limits** — login, signup, password reset, AI and email endpoints can be spammed.
9. **Personal data** (6.5) — what is stored, where, why; in logs/URLs/error messages; deletable; sent to outside services; real data in tests or the repo.
10. **Client-side trust** — permissions, prices or feature flags decided in the browser only.

Use scanners **already on the machine** when they help (e.g. `npm audit`); suggest others from `RESOURCES.md` (Gitleaks, Semgrep, Trivy) — **never install without a yes** (rule 2.3).

## Step 3 — Rank each finding

| Level | Meaning | Example |
|---|---|---|
| 🔴 **Critical** | Real users' data/money/accounts exposed or takeable right now | Anyone can open any order by changing the URL; a live secret key in the repo |
| 🟠 **High** | Serious, needs a little more effort to exploit | Stored XSS in comments; no rate limit on login |
| 🟡 **Medium** | Weakens defences | Missing CSP header; verbose error pages |
| 🟢 **Low** | Hardening, unlikely to matter alone | Missing `Referrer-Policy` on a static page |

## Step 4 — Fix first, then report (rule 6.2)

Fix in order: Critical → High → Medium → Low. **A Critical finding pauses other work** and sends the 🔴 notification.

**You may fix on your own (rule 6.4):** bugs in the project's code; missing input validation, access checks, security headers; small patch/minor package updates when tests pass **and** the version is older than `PACKAGE_WAIT_DAYS`.

**Never on your own — stop and tell the user exactly what to do:** anything about keys, passwords, tokens (create/replace/revoke); account or dashboard settings on outside services; major package upgrades; deleting data or changing a live database.

**Every fix comes with proof (rule 9.5):** write a test that performs the attack — show it **allowed ❌ before** the fix and **blocked ✅ after**. For a settings fix, show the before/after of the check (e.g. `curl -I` headers). If you can't prove it, say so.

## Step 5 — Report in plain words

Short bullets first, details after (rule 1.2). Example:

```
🔴 Critical — fixed: any logged-in user could open another user's orders by changing the
   number in the URL. Now the server checks the order belongs to you.
   Proof: test `orders-access` — before: user B read order #5 ❌, now: blocked ✅.
🟠 High — fixed: no limit on login attempts. Added 5 tries / 15 min per account + IP.
🟡 Medium — you need to decide: cookies are not marked Secure because the site runs on HTTP
   locally. In production this must be on — I made it depend on NODE_ENV.
⚠️ YOU must do (I can't): your Stripe key was in `config.js`. I removed it from the code, but the
   old key may be exposed — create a new one: Stripe → Developers → API keys → Roll key.
Not checked: email provider settings (outside the project).
```

State plainly what you did **not** check. Never write "secure" — write what was checked and found.

## Never
- Never read, print or copy a secret value, even to "confirm" it. File and line only.
- Never test against live or third-party systems. Never bypass anything (6.5a).
- Never silence a finding by deleting the test or the check (9.4).
- Never put real personal data in tests or in the report.
