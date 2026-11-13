---
name: secure-code
description: Safe patterns to follow WHILE writing code that touches logins, user input, data, payments, uploads, files, URLs or secrets — so security is built in the first time. Use before writing any such code, not after. Pairs with security-check, which reviews code that already exists.
---

# Secure code

Rules this follows: 6.3 (secure code on the first try), 6.1 (real risks), 6.5 (personal data), 7 (secrets), 2.3a (packages). Good sources: `RESOURCES.md` → Security; OWASP Cheat Sheet Series (cheatsheetseries.owasp.org) is the first place to check a pattern.

Fixing a hole later costs far more than writing it safely once. "Short but easy to attack" isn't simple — it's fragile. But no needless complexity: use the ready-made safe tool, don't invent one.

**Adapt to the stack.** The patterns below are language-independent; use the project's own framework features for each.

## The core habits (always)

1. **Never trust the browser/client.** Anything that comes from outside — forms, URLs, headers, cookies, JSON, files, other APIs — is untrusted. **Validate on the server**, even if the page also validates.
2. **Check type, length, range, format** — allow-list what's valid instead of block-listing what's bad.
3. **Least privilege.** Each user, key and service gets only the access it needs.
4. **Fail closed.** If a check can't be completed, deny. Errors show a safe message to users; details go to server logs (without secrets or personal data).
5. **Use proven libraries** for crypto, passwords, sessions, parsing. Never write your own.

## By situation

### Login, passwords, sessions
- Hash passwords with a purpose-built slow hash (**argon2id**, **bcrypt**, or **scrypt**) — never plain text, never MD5/SHA alone.
- Prefer a trusted auth provider/library over a home-made login.
- Rate-limit login, signup, password reset. Same message for "wrong user" and "wrong password".
- Session cookies: `HttpOnly`, `Secure`, `SameSite=Lax/Strict`; expire and rotate on login.
- Never put tokens or passwords in URLs or logs.

### Access control (the most common real hole)
- **Every** request for a record checks **who is asking** and that they own/are allowed it — not just that they're logged in. `GET /orders/5` must check order 5 belongs to this user (IDOR).
- Check permissions on the server for every action, including delete/export/admin.
- Don't rely on hidden buttons.

### Database
- **Parameterized queries / prepared statements / the ORM's safe API.** Never build SQL by joining strings with user input.
- The database account used by the app has only the rights it needs.

### Showing user content (XSS)
- Escape output by default (modern frameworks do — don't bypass with `dangerouslySetInnerHTML`, `innerHTML`, `v-html`, `|safe`).
- If you must render rich text, sanitize with a maintained sanitizer.
- Set a Content-Security-Policy.

### Forms that change things (CSRF)
- State-changing requests need CSRF protection (tokens or SameSite cookies + origin checks), unless the API is token-authenticated only.

### File uploads
- Check size, **real** type (not just the extension), and name; store outside the web root with generated names; never execute uploads; serve with the right `Content-Type` and `nosniff`.

### Files and commands
- Never build a file path from user input without resolving it and checking it stays inside the allowed folder (path traversal: `../`).
- Never pass user input to a shell. Use the language's argument-array APIs (`spawn` with an array, `subprocess.run([..])` without `shell=True`).
- Never `eval` / deserialize untrusted data with unsafe formats (`pickle`, unsafe YAML load).

### The server fetching URLs (SSRF)
- If users can give a URL the server loads: allow-list hosts, block private/internal addresses (`127.0.0.1`, `10.*`, `169.254.169.254`, etc.), don't follow redirects blindly, set timeouts and size limits.

### Payments and money
- **Never trust prices, totals or discounts from the browser.** Recompute on the server from your own data.
- Use the payment provider's hosted checkout / official SDK; **verify webhooks' signatures**; make operations idempotent.
- Money in integers (cents), not floats.

### Secrets and config (rule 7)
- Secrets live in environment variables / the host's secret store, loaded from `.env` that is git-ignored. **Never open `.env`.** List names in `.env.example`.
- Never in code, logs, error messages, client bundles, URLs, screenshots or commits.
- Don't send secrets to the browser (frontend env vars like `NEXT_PUBLIC_*`/`VITE_*` are **public**).

### Web settings
- Security headers (CSP, HSTS, `nosniff`, frame protection, referrer policy), HTTPS, no wildcard CORS with credentials, debug off in production.

### Personal data (rule 6.5)
- Ask before storing it; collect only what's needed; not in logs/URLs; allow deletion; fake data in tests.
- Don't send it to analytics, email tools or AI APIs without asking.

### Packages (rule 2.3a, 6.4a)
- Prefer the standard library or an already-used package. A new package: run `package-check` first; ask before installing.

## Before you say it's done
- Did every input get validated on the server?
- Does every record access check ownership?
- Any secret, personal data or stack trace that could leak?
- Is there a test that tries the attack (rule 9.5)? Write one for anything touching login, money, access or uploads.
- Then run `security-check` if the change is meaningful.
