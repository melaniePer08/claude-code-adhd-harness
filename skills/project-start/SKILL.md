---
name: project-start
description: The routine for the first minutes of any project — check the GitHub connection, read CLAUDE.md, run the lawyer skill, then work in short steps with tests, lint, a security check and one commit each, and report in short bullets with a TL;DR. Use at the start of every project or session in a new folder, or when the user pastes the project-start prompt from PROMPTS.md.
---

# Project start

Rules this follows: 1.1a (short ADHD format), 2 (permission), 5 (tokens), 8 (git and GitHub), 9.5 (done needs proof), 6 (security), 7 (secrets).

One routine, in order. Keep every message short (rule 1.1a): result, then "You need to…", then bullets, with a **TL;DR** on top when it is longer than a few lines.

## Step 1 — Check before touching anything

1. **Git remote:** run `git remote -v`. No GitHub repo connected? Stop and say: "Before I start, please create a GitHub repo for this project and send me the link: https://github.com/new". Never create the repo yourself (rule 8). Questions and read-only work do not need a repo.
2. **Read `CLAUDE.md`** (and `PROJECT_MAP.md` if it exists). Follow what they say. Do not re-read what has not changed.
3. **Look at the project:** what kind it is, what tooling it has (tests, linter, type check, build). Use the project's own tools; install nothing without asking.

## Step 2 — Run the `lawyer` skill (start-of-project version)

- Run it so the data plan is decided before the code exists: what personal data the app will collect, where it will go, what privacy settings it needs.
- If the project is pure research, practice, or stays private on the user's computer, say so in one line and skip it.
- **If the `lawyer` skill does not exist on this machine:** tell the user, and create it first from this harness (`skills/lawyer/SKILL.md`). Creating it touches `~/.claude/skills/`, so the config-protection hook will ask the user to approve it. That is expected. Explain the approval part by part (`explain-command` skill) before it appears.

## Step 3 — Plan, then work in short steps

- Show the plan once and wait for the yes (`plan-first` skill), unless the task is tiny.
- **After every step**, in this order:
  1. **Tests** for what changed (run them, show the result).
  2. **Lint / type check** if the project has them.
  3. **Security check** scaled to the step: secrets, input handling, access, packages (`secure-code` while writing, `security-check` for bigger changes).
  4. **One commit** with a plain-language message. One logical change per commit; never commit secrets or `.env`.
- A failing check is fixed or reported honestly. Never weaken a test or hide an error to get past it (rule 9.5).
- Keep `PROJECT_MAP.md` current if the project has one (`project-map` skill).

## Step 4 — Report

Short bullets, **TL;DR on top**:

- ✅ / ⚠️ / ❌ what is done, what is not, what was actually verified
- 🔒 security result in one line
- **👉 What you must do** — its own separate list: keys, accounts, decisions, approvals. Each with the exact place (for secrets, the `.env` variable name and where to get it, rule 7). If there is nothing, say "nothing".

Push the commits at the end of the task. Offer the full report as a page only if it is long.

## Never

- Never skip the GitHub check, and never create the repo for the user.
- Never open the real `.env`.
- Never write a long wall of text. If it does not fit the shape above, cut it.
