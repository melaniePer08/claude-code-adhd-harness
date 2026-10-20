# Starter pack: hooks, skills and extras

Everything the harness comes with. `first-run-setup` asks a few questions, checks what you
already have, and installs only what you need — after explaining each piece and getting a yes.

Status: 📝 = planned (not written yet) · ✅ = exists (needs cleaning before publishing) · 🔧 = exists, needs an update

# Hooks — automatic checks that run outside Claude's control

Hooks are small scripts Claude Code runs on its own at set moments (before a command, after an edit, when a session starts…). They enforce the rules even when Claude forgets. **Read every hook before installing — they run code on your computer.**

| Hook | What it does | Rules | Status |
|---|---|---|---|
| `block-dangerous` | Asks you before force-push, `reset --hard`, recursive deletes outside the project | 2.3, 8.6 | ✅ |
| `protect-secret-files` | Blocks reading/editing files with real secrets (`.env`) | 7.4 | ✅ |
| `secret-scan` | Blocks commits/pushes that contain anything that looks like a key or password | 7.5, 8.7 | ✅ |
| `protect-config` | Asks you before Claude changes settings, rules, hooks or skills | 2.3 | ✅ |
| `github-check` / `require-remote` | Stops work in a project that isn't connected to GitHub | 8.1 | ✅ |
| `commit-guard` | Claude can't end a turn with uncommitted changes | 8.2 | 🔧 add loop guard |
| `finish-check` | Claude can't end a turn with failing tests/type check | 9.4 | 🔧 add loop guard |
| `auto-push` | Pushes automatically | 8.4 | 🔧 size-based (now: every 5) |
| `dep-check` | Reports known-vulnerable packages | 6.4, 6.4a | 🔧 allow safe updates + release-age check |
| `review-gate` | Asks for a review of the changes every few commits | 9.5 | ✅ |
| `auto-format` | Runs the project's own formatter after edits | 9.2 | ✅ |
| `notify` | Windows pop-ups | 10 | 🔧 new events, silent in Do Not Disturb |
| `command-log` / `session-log` | Logs commands (keys masked) and what changed each session | 11 | 🔧 fix repeated lines |
| `rules-refresh` | Re-states the top rules after a long chat is compressed | core | 🔧 fix format error |
| `ram-check` | No heavy work under `START_RAM_GB`, stop under `STOP_RAM_GB` | 4.1, 4.2 | 📝 |
| `session-start` | Reads `LESSONS.md`, weekly reminders, yesterday's summary | 4.5, 11 | 📝 |
| `mistake-log` | Writes a line to `mistakes-log.md` when a hook blocks Claude | 11.1 | 📝 |

# Skills — step-by-step routines that load only when used

Skills load only when used, so the core rules stay small.

## Planning and talking
| Skill | What it does | Rules | Status |
|---|---|---|---|
| `first-run-setup` | Asks your settings (incl. how the form and summary pages should look), sets up git + `.env` files for a project, installs only the hooks and skills you need | settings, 7, 8.1 | 📝 |
| `plan-first` | Writes the start card: plan + time + agents/models, one yes | 2.4 | 📝 |
| `grill-me` | Asks you questions before a big build so it's right the first time (inspired by a public "grill me" skill, credited) | 5.4 | 📝 |
| `owner-form` | Builds the local question form | 1.8, 12 | 📝 |
| `explain-command` | Explains a command part by part before you approve it | 2.1 | 📝 |
| `explain-code` | Explains a file or feature in plain English | — | 📝 |
| `write-up` | Task reports (terminal or page), handoff notes, daily summary, `DEVLOG.md` entries | 1.7, 5.7, 8.9, 11.3 | 📝 |

## Building
| Skill | What it does | Rules | Status |
|---|---|---|---|
| `project-map` | Keeps `PROJECT_MAP.md` + mind map + code-style examples; 3-agent check at the finish line | 5.3, 9.2 | 📝 |
| `task-splitter` | Splits big tasks into chunks for fresh terminals, or finds a cheaper way | 5.8 | 📝 |
| `debug` | Picks the right method; finds the breaking change for "it worked before" | 8.5a, 9.3 | 📝 |
| `verify` | The verifier: writes break-it tests and checks the task really matches the request | 9.4a, 9.5 | 📝 |
| `code-review` | Reviews changes before a push — scaled to how much code changed | 9.5 | 📝 |
| `merge-manager` | Merges every branch into `main` and checks it works before publishing | 8.8 | 📝 |
| `pre-deploy-check` | Checklist before going live: debug off, keys hidden, headers, backups | 6 | 📝 |
| `cleanup` | Stops leftover processes, deletes temp files, offers weekly log cleanup | 4.3, 4.5 | 📝 |

## Security
| Skill | What it does | Rules | Status |
|---|---|---|---|
| `secure-code` | Safe patterns to follow while writing code | 6.3 | 📝 |
| `security-review` | Checks the real risks incl. personal data, fixes safe ones, ranks the rest | 6.1, 6.2, 6.5 | 📝 |
| `package-check` | Real name, downloads, age ≥ `PACKAGE_WAIT_DAYS`, install scripts, licence + credits | 2.3a, 6.4a, 6.6 | 📝 |

## Design
| Skill | What it does | Rules | Status |
|---|---|---|---|
| `design-research` | Looks at what exists and shows 2–3 directions before building | design-rules | ✅ in repo |
| `design-system` | Sets colours, fonts, spacing and shapes once | design-rules | ✅ in repo |
| `design-review` | Screenshots + checklist, including accessibility and colour-blind checks | 9.7, design-rules | ✅ in repo |
| `figma-to-code` | Reads a Figma design and builds from its exact measurements | design-rules | 📝 |

## Portfolio and growth
| Skill | What it does | Rules | Status |
|---|---|---|---|
| `project-showcase` | Bold, honest showcase page for finished projects | 8.10 | ✅ in repo (first version) |
| `resources-finder` | Suggests 1–2 tools from `RESOURCES.md` for the current task | — | 📝 |
| `improve-system` | Keeps `LESSONS.md` (model-aware); weekly finds repeated requests/mistakes and suggests improving existing skills first | 11 | 📝 |

**Total: 25 skills.**

## Optional extras (suggested, never installed without a yes)
- **Claude Code `cleanupPeriodDays` setting** — built in; deletes old chat transcripts after that many days.
- **Windows Storage Sense** — built in; clears temp files and the recycle bin on a schedule.
- **`npkill`** — finds and deletes old `node_modules` folders. (to verify)
- **Anthropic's official skills** — github.com/anthropics/skills (e.g. `skill-creator`). (to verify)
- **`RESOURCES.md`** — tables of good GitHub repos by topic (design, security, better code, managing code, design tools → site), refreshed weekly by a GitHub Action.

> Items marked "to verify" are checked before publishing.
