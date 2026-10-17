# 8. Git and GitHub

**8.1 Before changing files, check the project is connected to GitHub** (`git remote -v`). (hook: GitHub check)
- If not: stop and say "Before I start, please create a GitHub repo for this project and send me the link: https://github.com/new". Never create the repo yourself.
- Never turn the home, Desktop, Documents or Downloads folder into a repository.

**8.2 Commit after every finished piece of work — not after every line.**
- One commit = one complete, working piece you can describe in one sentence and undo on its own.
- ✅ "Add a sign-up button that opens the form and saves the email" — the button **with all its functions**.
- ❌ "Change one line", "add one import", "half a button".
- Bigger project → the pieces can be a bit bigger (a whole small feature). Tiny project → one button is a piece.
- Why: commits that are too small are noise nobody can follow; commits that are too big can't be undone without losing other work.

**8.3 Commit messages in plain language.**
- Example: "fix: sign-out button was cut off on phones" — not "refactor nav flex logic".

**8.4 Push based on task size.** (hook: auto-push)
- Small single fix → push right away. Big feature → push every 5–7 commits, and at the end.

**8.5 Make a backup point before big changes** (a commit or a branch).
- Why: you can always go back.

**8.5a When something "worked before" and now breaks, find the exact change that broke it (part of the `debug` skill).**
- Go back through the recent commits — on every branch involved, including agents' branches — and test them one by one (git's built-in tool for this is `git bisect`) until the first broken commit is found.
- Then fix only that change. Nothing is deleted or rewritten.
- Why: because work is committed piece by piece, the broken piece can be found exactly — instead of searching the whole project.
- Example: "The app crashes since today. Checked 6 commits: it broke at 'add sign-up button' (branch `agent-2`). The button's form reads a field that doesn't exist. Fixed, app works again."

**8.6 Never force-push, rewrite pushed history, or delete branches without asking.** (hook: dangerous-command confirmation)

**8.7 Before every commit, check what is staged:** no secrets, no `.env`, no large build files. Add a `.gitignore` if missing. (hook: secret scanner)

**8.8 Before a project is finished or published, `main` must contain everything (`merge-manager` skill).**
- Why: sites like Vercel publish only what is in `main`. Work left on other branches (for example from agents) is invisible — the live site is missing it.
- How it works (inside the start card):
  1. **Merge manager** lists every branch with unmerged work and merges each one into `main`, one at a time.
  2. **Verifier** tests `main` after the merges: build, tests, and a quick look at the app.
  3. If something is broken, the verifier writes what and where into a file. The manager finds which merge caused it (8.5a) and fixes it.
  4. Repeat until `main` is complete and working. Then push.
- Deleting old branches afterwards still needs a yes (8.6).
- Example: "4 branches merged into main. Verifier found the cart page broken after merging `agent-3` — fixed. All tests pass. Pushing."

**8.9 Projects in progress: keep a `DEVLOG.md` automatically (`write-up` skill).**
- Claude writes the devlog entry itself after big changes — no start card, the user never has to remember.
- Then a short message: "✅ Finished the cart and payment test. Added it to DEVLOG.md — want to post it?"
- The user rewrites it in their own words if they want. Nothing is posted outside the repo without a yes.
- Why: a build diary shows how you think and work — great for a portfolio — but only if it actually gets written.

**8.10 Finished (or mostly finished) projects: Claude builds a strong, honest showcase page itself (`project-showcase` skill).**
- No start card — Claude makes it, then tells the user: "Made a showcase page for this project — take a look. Change anything, or say 'remove it'."
- Content: what it does, who it's for, main features, a demo GIF or screenshots, simple diagrams of how the app works, tech used, how to run it, what was hard and how it was solved.
- **Honest:** only describe what really works today. Anything unfinished is marked "planned". Interviewers and users will try it.
- Make it **bold and memorable**, like the best GitHub project pages:
  - a banner image at the top (the user's own art when they have it),
  - badges (small labels like "built with React", "MIT licence"),
  - a short demo GIF of the app working,
  - Mermaid diagrams — simple text GitHub turns into a picture,
  - light/dark versions of images so it looks good in both modes,
  - collapsible sections so long details don't overwhelm.
- Still readable first: strong, not cluttered (see `rules/design-rules.md`). Never include keys, private paths or personal data.
- Optional extra: a full designed project website on GitHub Pages (free) — turning it on is a setting, so ask first.
- Why: a striking, clear, true project page is proof you can build, explain and present a project — for jobs, a portfolio, and for new users trying the project.
