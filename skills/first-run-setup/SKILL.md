---
name: first-run-setup
description: One-step setup for the harness — asks the user's settings (plan, memory limits, page look), checks what they already have, explains each piece, and installs only the hooks, skills, tools and rules they say yes to. Also sets up git and .env files for a new project. Use right after the harness is downloaded, when harness-settings.md values are empty, or when the user says "set up the harness".
---

# First-run setup

Rules this follows: 2.3 (installing and changing settings **always ask first**), 2.1 (explain commands part by part), 7 (secrets: the user fills `.env`, you never open it), 8.1 (GitHub repo: the user creates it), 1.5 (ask when unsure), `harness-settings.md`.

This is the one skill that changes the user's own setup, so it moves slowly and asks at every step that matters. **Nothing is installed, copied or changed without a yes**, and every change is something you can describe and undo.

## What gets installed where

| From the harness folder | Goes to | What it is |
|---|---|---|
| `CLAUDE.md`, `rules/`, `harness-settings.md`, `RESOURCES.md` | `~/.claude/harness/` | The rules. **Never** in `~/.claude/rules/` and never `@`-imported — Claude Code would then load them in every session and waste tokens. |
| `skills/<name>/` | `~/.claude/skills/<name>/` | Routines that load only when used |
| `tools/*.mjs` | `~/.claude/tools/` | `shot.mjs` (screenshots), `figma.mjs` (Figma reader) |
| `hooks/*.mjs` | `~/.claude/hooks/` + entries in `~/.claude/settings.json` | The automatic checks — through `hooks/install.mjs` only |

Everything under `~/.claude/` is outside the project, so each part needs the user's yes (rule 2.3). Never touch `~/.claude/.env` or any file with real secrets (rule 7.4).

## Step 1 — Look first (read-only, free)

1. Where is the harness folder? (the repo the user downloaded; usually the current folder)
2. What is already installed? List `~/.claude/skills/`, `~/.claude/hooks/`, `~/.claude/tools/`, `~/.claude/harness/`, and whether `~/.claude/settings.json` has hooks. **Do not read `.env` files.**
3. Versions: `node --version` (hooks need Node 18+), `git --version`, `gh --version` (optional).
4. Free memory and total memory (to suggest `START_RAM_GB` / `STOP_RAM_GB`). Windows: `Get-CimInstance Win32_OperatingSystem`.
5. Is there an existing `CLAUDE.md` in `~/.claude/`? The user's own rules always win — never replace or merge into it without showing the exact change.

Tell the user in a short bullet list what you found: "Already have: 3 of your own skills, 5 hooks. Missing: Node 18+."

## Step 2 — Ask the settings (one round, ask once)

Ask in the terminal, numbered, with a recommended answer for each, explaining each in plain words (rule 1.1). Skip any that already have a value in `harness-settings.md`.

1. **Claude plan** (`PLAN`) — Pro / Max / other. Lower plans mean more careful token use.
2. **Memory limits** (`START_RAM_GB`, `STOP_RAM_GB`) — suggest from the computer's real total (e.g. 16 GB → start 4, stop 3). Explain: "Under this much free memory I won't start heavy work."
3. **Helper agents** (`MAX_AGENTS`) — default 3. Explain: agents work in parallel but cost more and load the computer.
4. **Plan first** (`PLAN_FIRST`) — yes (strongly recommended): "I show a start card and wait for one yes before real work."
5. **Package wait** (`PACKAGE_WAIT_DAYS`) — default 7: "I won't install a package version released in the last 7 days."
6. **Push batch** (`PUSH_EVERY`) — default 5.
7. **Questions** (`FORM_AFTER`, `QUESTION_FORM`) — how many questions before I offer the form; `ask` / `always` / `never`.
8. **How pages should look** (`PAGE_THEME`, `PAGE_ACCENT`, `PAGE_TEXT_SIZE`, `PAGE_DETAIL`, `PAGE_LANGUAGE`, `PAGE_EXTRAS`) — for the question form and report pages. Offer three presets (calm light / dark / follow computer) rather than six open questions.

If the user has more than `FORM_AFTER` questions pending, offer the form (`owner-form`) — otherwise stay in the terminal.

Then write the answers into **the user's copy** of `harness-settings.md` (inside `~/.claude/harness/` after install, or the repo copy before). Show the filled table and ask "OK to save?" first — this is a settings file (rule 2.3). "You decide" = pick the recommended value and say so.

## Step 3 — Offer the install, piece by piece

Present a short list, each with **what it is, what it does, whether it's needed**, and a recommended default. Group them:

- **Rules** (always): copy `CLAUDE.md`, `rules/`, `harness-settings.md`, `RESOURCES.md` into `~/.claude/harness/`. Then tell the user: *add one line to their `~/.claude/CLAUDE.md`, or project `CLAUDE.md`, pointing at the harness core rules* — and show the exact line. Never overwrite their file.
- **Hooks** — recommend the safety set first: `secret-scan`, `protect-secret-files`, `block-dangerous`, `explain-gate`, `commit-guard`. Then optional: `ram-check`, `finish-check`, `auto-push`, `review-gate`, `dep-check`, `auto-format`, `notify`, `session-start`, `session-log`, `command-log`, `mistake-log`, `rules-refresh`, `github-check`, `require-remote`, `protect-config`. Read `hooks/README.md` for the one-line meaning of each.
- **Skills** — the starter pack, by group (see `STARTER-PACK.md`). Recommend the ones the user's projects need: design skills only if they build interfaces; `owner-form` only if they like forms; etc. Never install all 24 "just in case" — unused skills only add noise.
- **Tools** — `shot.mjs` if they build interfaces; `figma.mjs` only if they use Figma (needs a token they create themselves).

For each group, **ask for a yes** before doing it (rule 2.3). Explain the commands part by part (`explain-command`) — e.g. copying files: "`Copy-Item skills\debug ~\.claude\skills\debug -Recurse` copies the `debug` folder into your Claude skills folder; nothing is deleted; undo by deleting that folder."

### Doing it

- **Rules, skills, tools**: copy with the system tools. Check each target first — never overwrite an existing file/folder with different content; if one exists, show the difference and ask.
- **Hooks**: only through the installer, dry run first:
  ```bash
  node hooks/install.mjs --only secret-scan,explain-gate,block-dangerous,commit-guard,protect-secret-files        # preview
  node hooks/install.mjs --only secret-scan,explain-gate,block-dangerous,commit-guard,protect-secret-files --apply  # after the user's yes
  ```
  Explain what `--apply` does: copies the scripts into `~/.claude/hooks/`, backs up `settings.json`, **adds** entries (never removes), safe to run twice. If the user's settings already have hooks of their own, say that they stay untouched.
- Never put anything into `settings.json` yourself with a text edit — the installer does it, with a backup.

## Step 4 — Per-project setup (also for every new project)

When the user starts a project (or now, for the current one):

1. **GitHub** (rule 8.1): `git remote -v`. Not connected → stop and say: *"Before I start, please create a GitHub repo for this project and send me the link: https://github.com/new"*. **Never create the repo yourself.** Once the link arrives: `git init -b main` if needed (never in the home, Desktop, Documents or Downloads folder), add `origin`, initial commit, push.
2. **`.gitignore`** for the stack; must include `.env`, `node_modules/`, build output, `.shots/`, `docs/owner-answers.json`.
3. **Secrets** (rule 7): if the project needs keys, create `.env.example` (names, placeholders, step-by-step "where to get it") and `.env` with **empty values**, then tell the user exactly which lines to fill. **Never open `.env`.**
4. `PROJECT_MAP.md` (`project-map` skill) for non-trivial projects.
5. Ask once: "Will this project ever be sold or used for business?" — save the answer in the project notes (licence checks need it).

## Step 5 — Finish

Report in two layers (rule 1.2):
- ✅ What was installed (counts, names), what was skipped on purpose, what the user must still do (create a Figma token, fill `.env`, add the line to their `CLAUDE.md`).
- How to check: "Start a new Claude Code session; the first task will show a start card."
- How to undo each part (delete the copied folders; restore `settings.json.bak-…`).
- Send the ✅ notification if the user stepped away.

Update `harness-settings.md` with the answers; commit changes inside the harness repo only if the user keeps their settings there.

## Never
- Never install, copy, or change anything outside the project without a yes.
- Never open, print, copy or edit `.env` or any real secrets file; never ask the user to paste a token into the chat.
- Never replace the user's own `CLAUDE.md`, settings or hooks. Add beside, show the diff.
- Never `@`-import the rule files or place them in `~/.claude/rules/`.
- Never run a downloaded script without reading it first.
- Never create the GitHub repo.
