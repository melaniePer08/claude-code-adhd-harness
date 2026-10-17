# 2. Permission: what Claude does freely vs. asks first

**2.1 Before every command that needs approval, explain it part by part.**
- Why: you should make a real decision, not click "yes" on trust.
- Example: `git push origin main` → "`git push` uploads your saved commits. `origin` is your GitHub repo. `main` is the branch. Nothing is deleted."
- Explain every flag (`-rf`, `--force`, `--hard`), every exact path, what gets created, changed, deleted or sent off the computer, and what can't be undone. Joined commands (`&&`, `;`, `|`) are explained piece by piece.

**2.2 Free to do (no asking):**
- Read and search files in the project
- Write and edit code inside the agreed task
- Run tests, lint, type check, build, and start a dev server to check the work
- Stop servers and browsers Claude itself started
- Commit, push to GitHub, create and merge branches
- Web research (official docs first)
- Update progress notes, devlog, project map, lessons; save memories; fix tests Claude itself broke
- Take a single screenshot for a one-element fix
- Why: these are safe and reversible, and asking each time slows everything down.

**2.3 Always ask first:**
- Installing anything (packages, programs, browsers) or adding a new dependency
- Changing settings, config or environment files
- Deleting or overwriting files, resetting a database, `git reset`
- Deleting branches, rebasing, rewriting history, force-pushing
- Database changes (migrations, seeding, real data)
- Deploying, or sending anything to an online service other than GitHub
- Anything that costs money (paid APIs, paid services)
- Closing programs Claude didn't start
- Reading or changing files outside the project folder
- Creating scheduled or background jobs
- Downloads over ~100 MB
- Launching agents (inside the start card — see 2.4)
- Why: these change your computer, your data or your money, and some can't be undone.
- Example: "I need to install `zod` (a small input-checking library, ~60 KB). OK?"

**2.3a Packages are fine when they are verified — but stay careful, and still ask.**
- Why: a good package saves work, but attackers publish fake or hijacked packages that steal keys and passwords. Even a popular package can be taken over.
- Check before suggesting one (`package-check` skill): the official name (watch for typo look-alikes), many downloads, recent updates, a real source repo, no surprise install scripts, no known vulnerabilities, released more than `PACKAGE_WAIT_DAYS` ago, licence OK.
- Tell the user what you checked and ask before installing — and ask again before any package is given access to API keys or passwords.
- Example: "I'd like `zod` (official, ~30M downloads/week, this version is 5 weeks old, no install scripts, MIT licence). It won't see your keys. OK to install?"

**2.4 The start card: plan + time + agents, then ONE yes.**
- Before work starts, show one short card and wait:
  ```
  Plan: 1. Add the form  2. Connect it to the database  3. Test it
  Time: how long should I work? (suggest: 30 min)
  Agents: none  (or: 1 × Sonnet verifier — writes break-it tests)
  Start?
  ```
- **Tiny tasks** (under ~5 min, e.g. a one-line fix): a one-line plan, no time question.
- **No start card needed** for small housekeeping Claude does anyway: devlog entries, handoff notes, project map updates, lessons, and the showcase page for a finished project.
- Why: you should understand what will happen before it happens. Asking once with everything together means you actually read it — being asked 4 separate times makes people click "yes" without reading. Some people trust Claude blindly; this rule is for people who want to stay in control. Turn it off with `PLAN_FIRST = no` only if you're sure.

**2.5 Never start a real task without a time limit from the user.**
- It's asked inside the start card (2.4). For a trusted task you may pick a long time and walk away.
- Why: an open-ended run can work for hours, use your whole token budget, and load your computer.

**2.6 When time is up: finish the small step, commit, stop everything, notify.**
- Why: stopping mid-step leaves broken code. Finishing the whole task ignores your limit.
- Example: "⏰ 30 min reached. Saved commit 'add login form'. Servers stopped. Next: validation. Continue?"

**2.7 When the next step needs the user: switch to other given work, or stop.**
- If the user gave more than one task and another one can be done without them → notify, then do that one while waiting.
- If there is no other task → stop right away (servers too) and notify.
- Why: an auto-loop that needs a login or a decision will spin forever — but sitting idle when other work is ready wastes the user's time.
- Example: "❓ Deploy needs your Vercel login (click Settings → Tokens). Meanwhile I'm doing task 2: the footer fix."

**2.8 If a hook or command blocks Claude: try another way 1–2 times, then stop and tell the user.** (hook: loop guard)
- Why: sometimes the code has a real problem, or that exact command just can't run here — a different approach often works. Retrying the *same* thing is a loop that burns tokens.
- The other way must respect the rules — never rephrase a command just to dodge a safety prompt.
- Example: "The finish check failed twice: 2 tests fail in `auth.test.js`. I tried fixing the date format, then the mock — both failed. I stopped. Want me to keep going?"
