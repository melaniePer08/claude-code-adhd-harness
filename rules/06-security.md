# 6. Security first

**6.1 Always check these real risks first:**
- **Secrets** — keys or passwords in code, logs, commits, or sent to the browser
- **Login & access** — can a user see or change someone else's data?
- **User input** — SQL injection, XSS, unsafe file uploads
- **Payments & money** — never trust prices or amounts sent from the browser
- **Risky packages** — fake, abandoned, typo-named, brand-new or known-vulnerable libraries
- **Server fetching URLs** (SSRF) — the server loading any link a user gives it
- **Unsafe settings** — debug mode in production, open CORS, missing security headers
- **Rate limits** — login, signup and AI endpoints can't be spammed
- **Personal data** — see 6.5
- Why: these cause real damage. Cosmetic code issues don't.

**6.2 Fixing security problems comes first — then report them, ranked Critical / High / Medium / Low, in plain words (`security-review` skill).**
- Fix in order: Critical → High → Medium → Low. A Critical finding pauses other work until it's fixed.
- Only fix what is safe for Claude to fix (see 6.4). Anything else: stop, notify, and explain exactly what the user must do.
- Every fix comes with proof (9.5).
- Why: a report alone leaves the hole open. Fixing the worst first protects real users soonest.
- Example: "🔴 Critical — fixed: any logged-in user could open another user's orders by changing the number in the URL. Now the server checks the order belongs to you. Test added."

**6.3 Write secure, high-quality code on the first try (`secure-code` skill).**
- Prefer strong, secure solutions over the simplest code — but no needless complexity.
- Before writing code that touches logins, data, payments, uploads or user input, follow the checklist of safe patterns: check every input on the server, use ready-made safe tools for passwords and database queries, give users only the access they need, and never trust the browser.
- Good sources are listed in `RESOURCES.md` → Security.
- Why: fixing a hole later costs far more than writing it safely once. Code that is short but easy to attack isn't simple, it's fragile.
- Example: a signup form → server-side input checks, hashed passwords, rate limit on the endpoint — from the start, not after a review.

**6.4 Claude may fix security problems on its own — only the safe kind.**
- **OK to fix:** bugs in the project's code; small (patch/minor) package updates when the tests still pass afterwards — **and only versions older than `PACKAGE_WAIT_DAYS`** (6.4a); missing input checks, access checks, security headers.
- **Never on its own — stop and tell the user:** anything with keys, passwords or tokens (changing, replacing or revoking them); account or dashboard settings on outside services; big (major) package upgrades; anything that deletes data or changes a live database.
- Why: safe fixes should happen fast. Secrets and accounts belong to the user, and big upgrades can break the app.
- Example: "Updated `express` 4.19.1 → 4.19.2 (security patch, 3 weeks old, all tests pass). ⚠️ Your Stripe key was in the code — I removed it from the code, but **you** need to create a new key in Stripe → Developers → API keys, because the old one may be exposed."

**6.4a Never install a brand-new version. Wait `PACKAGE_WAIT_DAYS` (default 7) after it was released.** (hook: dependency check)
- Before installing or updating any package, check its release date. Too new → use the previous version, and say so.
- The `package-check` skill and the dependency hook do this automatically before every install, so it doesn't depend on Claude remembering.
- Only exception: a fix for a security hole that is being attacked right now — then explain the risk both ways and ask the user.
- Why: hijacked or broken releases are usually caught by other people within days. Waiting a week lets them find it first.
- Example: "`axios` 1.8.0 came out 2 days ago — too new. Installing 1.7.9 (released 5 weeks ago) instead. I'll suggest 1.8.0 again next week."

**6.5 ⚠️ PERSONAL DATA — handle with extreme care. Always ask before storing it.**
Personal data = names, emails, phone numbers, addresses, location, photos, health, money, ID numbers, passwords, messages.
- **Ask first** before the app stores any personal data, and say what, where and why.
- **Collect only what's needed.** If the feature works without a birthday, don't ask for one.
- **Never store passwords as text** — always use a proper password-hashing tool.
- **Never put personal data in logs, error messages, screenshots, commits or URLs.**
- **Never use real people's data for tests** — use clearly fake data, and delete test data afterwards.
- **Never send personal data to an outside service** (analytics, AI APIs, email tools) without asking first.
- **Users must be able to delete their data** when the app stores it.
- Why: leaking personal data hurts real people, can't be undone, and brings legal duties (like GDPR).
- Example: "This newsletter form would store emails in the database. OK? I'll only store the email (no name), and add an unsubscribe + delete option."

**6.5a 🚫 Claude never breaks into anything — not even to get information it needs.**
- Never bypass logins, paywalls, CAPTCHAs, rate limits or access blocks on any site or system.
- Never guess, crack or reuse passwords or keys — including leaked ones found online or in code.
- Never scrape sites against their rules, and never collect information about real people.
- Security testing only on the user's own project, on their own computer (localhost) — never on live sites or other people's systems without written permission.
- Never route around this harness's own safety prompts or hooks.
- If Claude finds someone else's leaked keys or data: don't use them, stop, and tell the user.
- If the information is behind a login: ask the user to get it or to give access the proper way.
- Why: breaking in is illegal and harmful, no matter how good the reason. "I needed the data" is never permission.
- Example: "The docs page needs a login. I didn't try to get around it. Can you copy the part about rate limits, or log in and export it?"

**6.6 Check licences: can it be used commercially, and does it need credit? (part of `package-check`)**
- Ask once per project: "Will this project ever be sold or used for business?" Save the answer in the project notes.
- Before using copied code, a library, font, icon set or image, check its licence:
  - **Commercial project:** does the licence allow commercial use? If not, or unclear → don't use it, suggest an alternative.
  - **Needs credit** (for example MIT, Apache, CC-BY): add it to `CREDITS.md` with name, author, licence and link — automatically, every time.
  - **"Share-alike" licences** (like GPL): warn the user before using — they can force your whole project to be open-source.
- Why: using something against its licence can mean legal trouble or having to remove it later. Credits are often required, and easy to forget.
- Example: "Added `lucide` icons (ISC licence — commercial use OK, credit added to CREDITS.md)."
