# Starter pack: hooks, skills and extras

Everything the harness comes with. `first-run-setup` asks a few questions, checks what you
already have, and installs only what you need — after explaining each piece and getting a yes.

Status: 📝 = planned (not written yet) · ✅ = exists (skills are first versions) · 🔧 = exists, needs an update

# Hooks — automatic checks that run outside Claude's control

Hooks are small scripts Claude Code runs on its own at set moments (before a command, after an edit, when a session starts…). They enforce the rules even when Claude forgets. **Read every hook before installing — they run code on your computer.**

| Hook | What it does | Rules | Status |
|---|---|---|---|
| `block-dangerous` | Asks you before force-push, `reset --hard`, recursive deletes outside the project | 2.3, 8.6 | ✅ |
| `protect-secret-files` | Blocks reading/editing files with real secrets (`.env`) | 7.4 | ✅ |
| `secret-scan` | Blocks commits/pushes that contain anything that looks like a key or password | 7.5, 8.7 | ✅ |
| `protect-config` | Asks you before Claude changes settings, rules, hooks or skills | 2.3 | ✅ |
| `github-check` / `require-remote` | Stops work in a project that isn't connected to GitHub | 8.1 | ✅ |
| `commit-guard` | Claude can't end a turn with uncommitted changes | 8.2 | ✅ |
| `finish-check` | Claude can't end a turn with failing tests/type check | 9.4 | ✅ |
| `auto-push` | Pushes automatically | 8.4 | ✅ |
| `dep-check` | Reports known-vulnerable packages | 6.4, 6.4a | ✅ |
| `review-gate` | Asks for a review of the changes every few commits | 9.5 | ✅ |
| `auto-format` | Runs the project's own formatter after edits | 9.2 | ✅ |
| `notify` | Windows pop-ups | 10 | ✅ |
| `command-log` / `session-log` | Logs commands (keys masked) and what changed each session | 11 | ✅ |
| `rules-refresh` | Re-states the top rules after a long chat is compressed | core | ✅ |
| `status-board` | A coloured tile per open terminal (e.g. green = working, yellow = waiting for you, red = needs you now; you choose the colours) plus a short project name, so you can see which screen needs you. Planned layers: a status line inside each terminal, a small local page, and best-effort tab title/colour | 10 | 📝 |
| `explain-gate` | Holds a risky command (delete, install, force-push, upload, kill, deploy…) until Claude has explained it part by part, then lets the retry through to your approval prompt | 2.1 | ✅ |
| `ram-check` | No heavy work under `START_RAM_GB`, stop under `STOP_RAM_GB` | 4.1, 4.2 | ✅ |
| `session-start` | Reads `LESSONS.md`, weekly reminders, yesterday's summary | 4.5, 11 | ✅ |
| `mistake-log` | Writes a line to `mistakes-log.md` when a hook blocks Claude | 11.1 | ✅ |

# Skills — step-by-step routines that load only when used

Skills load only when used, so the core rules stay small.

## Planning and talking
| Skill | What it does | Rules | Status |
|---|---|---|---|
| `first-run-setup` | Asks your settings (incl. how the form and summary pages should look), sets up git + `.env` files for a project, installs only the hooks and skills you need | settings, 7, 8.1 | ✅ first version |
| `plan-first` | Writes the start card: plan + time + agents/models, one yes | 2.4 | ✅ first version |
| `grill-me` | Asks you questions before a big build so it's right the first time (inspired by [`grill-me`](https://github.com/mattpocock/skills) by Matt Pocock, MIT licence — credited) | 5.4 | ✅ first version |
| `owner-form` | Builds the local question form | 1.8, 12 | ✅ first version |
| `explain-command` | Explains a command part by part before you approve it | 2.1 | ✅ first version |
| `explain-code` | Explains a file or feature in plain English | — | ✅ first version |
| `write-up` | Task reports (terminal or page), handoff notes, daily summary, `DEVLOG.md` entries | 1.7, 5.7, 8.9, 11.3 | ✅ first version |

## Building
| Skill | What it does | Rules | Status |
|---|---|---|---|
| `project-map` | Keeps `PROJECT_MAP.md` + mind map + code-style examples; 3-agent check at the finish line | 5.3, 9.2 | ✅ first version |
| `task-splitter` | Splits big tasks into chunks for fresh terminals, or finds a cheaper way | 5.8 | ✅ first version |
| `debug` | Picks the right method; finds the breaking change for "it worked before" | 8.5a, 9.3 | ✅ first version |
| `verify` | The verifier: writes break-it tests and checks the task really matches the request | 9.4a, 9.5 | ✅ first version |
| `review-changes` | Reviews changes before a push or merge, scaled to how much changed (named so it never clashes with the built-in `/code-review`) | 9.5 | ✅ first version |
| `merge-manager` | Merges every branch into `main` and checks it works before publishing | 8.8 | ✅ first version |
| `pre-deploy-check` | Checklist before going live: debug off, keys hidden, headers, backups | 6 | ✅ first version |
| `cleanup` | Stops leftover processes, deletes temp files, offers weekly log cleanup | 4.3, 4.5 | ✅ first version |

## Security
| Skill | What it does | Rules | Status |
|---|---|---|---|
| `secure-code` | Safe patterns to follow while writing code | 6.3 | ✅ first version |
| `security-check` | Checks the real risks, fixes the safe ones with proof, ranks the rest (named so it never clashes with the built-in `/security-review`) | 6.1, 6.2, 6.5 | ✅ first version |
| `package-check` | Real name, downloads, age ≥ `PACKAGE_WAIT_DAYS`, install scripts, licence + credits | 2.3a, 6.4a, 6.6 | ✅ first version |

## Design
| Skill | What it does | Rules | Status |
|---|---|---|---|
| `design-research` | Looks at what exists and shows 2–3 directions before building | design-rules | ✅ in repo |
| `design-system` | Sets colours, fonts, spacing and shapes once | design-rules | ✅ in repo |
| `design-review` | Screenshots + checklist, including accessibility and colour-blind checks | 9.7, design-rules | ✅ in repo |
| `figma-to-code` | Reads a Figma design and builds from its exact measurements | design-rules | ✅ first version |

## Portfolio and growth
| Skill | What it does | Rules | Status |
|---|---|---|---|
| `project-showcase` | Bold, honest showcase page for finished projects | 8.10 | ✅ in repo (first version) |
| `resources-finder` | Suggests 1–2 tools from `RESOURCES.md` for the current task | — | ✅ first version |
| `improve-system` | Keeps `LESSONS.md` (model-aware); weekly finds repeated requests/mistakes and suggests improving existing skills first | 11 | ✅ first version |

**Total: 25 skills.**

## Optional extras (suggested, never installed without a yes)
- **Claude Code `cleanupPeriodDays` setting** — built in; how many days chat transcripts are kept (default 30). Lower it to free disk space.
- **Windows Storage Sense** — built in; clears temp files and the recycle bin on a schedule.
- **[`npkill`](https://github.com/voidcosmos/npkill)** (MIT) — lists every `node_modules` folder with its size so you can delete old ones. Code is still updated, but the last official release is from 2024.
- **[Anthropic's official skills](https://github.com/anthropics/skills)** — e.g. `skill-creator`, `frontend-design`, `webapp-testing`. Mixed licences: many are Apache-2.0, the document skills are source-available — check each one.
- **Package managers' built-in "minimum release age"** — npm, pnpm, Yarn and Bun can all refuse brand-new versions themselves (see rule 6.4a).
- **[`RESOURCES.md`](RESOURCES.md)** — tables of good GitHub repos by topic.

> Checked on 2026-10-21 against official docs and the GitHub API.
