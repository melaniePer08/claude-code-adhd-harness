# Hooks

Hooks are small scripts Claude Code runs **on its own** at set moments (before a command, after an edit, when a session starts, when Claude tries to stop). They enforce the harness rules even when Claude forgets them.

> **Read before you install.** Hooks run code on your computer with your permissions. Every script here is plain Node.js with no packages, no network access, and is short enough to read. Check them first — see `DISCLAIMERS.md`.

Requirements: Node.js 18 or newer (`node --version`). Windows pop-ups use PowerShell; on other systems those pop-ups are simply skipped.

## What is here

| Hook | Event | What it does | Rule |
|---|---|---|---|
| `explain-gate` | before a shell command | Holds a risky command (delete, install, force-push, upload, kill, deploy…) **once**, with a decoded breakdown, until Claude has explained it part by part. Multi-line commands, heredocs and inline scripts (`node -e`, `python -c`) are held too, with a nudge to use the Edit tool so you can review a diff (`EXPLAIN_SCRIPTS = no` turns that part off). The retry then reaches your normal approval prompt. | 2.1 |
| `block-dangerous` | before a shell command | Asks you before force-push, `reset --hard`, recursive deletes outside the project | 2.3, 8.6 |
| `protect-secret-files` | before read/edit/search | Blocks access to files holding real secrets (`.env`) | 7.4 |
| `secret-scan` | before and after a shell command | Blocks commits and pushes that contain anything that looks like a key or password | 7.5, 8.7 |
| `protect-config` | before edit/write | Asks you before Claude changes settings, rules, hooks or skills | 2.3 |
| `github-check`, `require-remote` | session start, before edits | Stops work in a project that is not connected to GitHub | 8.1 |
| `ram-check` | before agents/heavy commands | Refuses new heavy work under `START_RAM_GB` free memory; pop-up under `STOP_RAM_GB` | 4.1, 4.2 |
| `commit-guard` | before edits, at stop | Claude can't end a turn with uncommitted changes (fires once per turn) | 8.2 |
| `finish-check` | at stop | Claude can't end a turn while the project's own checks fail (max 2 nudges, then stops nagging) | 9.4 |
| `auto-push` | after a commit | Pushes after `PUSH_EVERY` commits; a single small `fix:` commit is pushed right away | 8.4 |
| `review-gate` | after a commit | Asks for a quick review of the diff every few commits | 9.5 |
| `dep-check` | after editing a manifest | Reports known-vulnerable packages and versions newer than `PACKAGE_WAIT_DAYS` | 6.4, 6.4a |
| `auto-format` | after an edit | Runs the project's own formatter, if it has one | 9.2 |
| `notify` | prompt, notification, stop | Windows pop-up when Claude needs you or finished a long turn | 10 |
| `command-log`, `session-log` | before a command, session start/end | Logs commands (keys masked) and a plain diary of what changed | 11 |
| `status-update` | every event | Writes one small status file per terminal (working / needs you / blocked). Feeds the coloured status line and `tools/status-board.mjs` | 10 |
| `session-start` | session start | Hands Claude `LESSONS.md`, yesterday's log, the weekly reminders | 4.5, 11 |
| `mistake-log` | prompt submitted | Notices "you did X again" and reminds Claude to log the mistake | 11.1 |
| `rules-refresh` | after the chat is compressed | Re-states the top rules | core |

`lib.mjs` (shared helpers) and `toast.mjs` (Windows pop-ups for serious events) are imported by the hooks. They are not hooks themselves — the installer copies them for you.

Hooks that block Claude (`finish-check`, `commit-guard`, `secret-scan`) also write one line to `~/.claude/harness/mistakes-log.md`, so repeated mistakes can become lessons.

## See which terminal needs you (status line + board)

If you run several terminals, `status-update` keeps a tiny status file per session, and two things show it:

- **A coloured status line** under the prompt of each terminal, e.g. `● appForWriters · working` or `◐ gameNight · needs you · done — your turn`. It is set up automatically by the installer (only if you do not already have a status line).
- **The status board:** `node tools/status-board.mjs`, then open http://127.0.0.1:4174 on a spare screen or a pinned tab. One tile per terminal, sorted so the ones that need you come first.

Three states, each with a word and a symbol as well as a colour (so colour alone is never the signal): **● working**, **◐ needs you** (an answer, an approval, or it finished and it is your turn), **■ blocked** (a secret was stopped, a check kept failing, or memory is low). Choose the three colours in `harness-settings.md` (`STATUS_COLOR_WORKING`, `STATUS_COLOR_WAITING`, `STATUS_COLOR_ALERT`; green, yellow, red, blue, magenta, cyan, orange or white).

Limits, honestly: a terminal that is closed without ending its session shows "no signal" after 20 minutes. `STATUS_TERMINAL_TITLE = yes` also tries to put the project name in the tab title, but Claude Code rewrites that title itself, so it is experimental and may not stick.

## Install

The easiest way is the installer at the root of the repo, `node install.mjs` (skills, rules, tools and hooks together; a dry run unless you add `--apply`). To install only hooks, use this folder's own installer. Both are a **dry run unless you add `--apply`**:

```bash
node hooks/install.mjs                                   # shows what would change; changes nothing
node hooks/install.mjs --only secret-scan,explain-gate   # preview just these two
node hooks/install.mjs --only secret-scan,explain-gate --apply
```

What `--apply` does, and nothing else:
1. Copies the chosen hook scripts (and `lib.mjs`) into `~/.claude/hooks/`. A different file with the same name is kept as `.bak`.
2. Backs up `~/.claude/settings.json` to `settings.json.bak-<time>`.
3. **Adds** the matching entries to `settings.json`. It never removes or edits what is already there, and running it again adds nothing twice.

Start a new Claude Code session afterwards. To undo: restore the backup and delete the copied scripts.

`settings.example.json` is the template the installer reads; `{{HOOKS_DIR}}` becomes your real hooks folder. You can also copy entries by hand.

## Settings the hooks read

From `harness-settings.md` (installed at `~/.claude/harness/`): `START_RAM_GB`, `STOP_RAM_GB`, `PACKAGE_WAIT_DAYS`, `PUSH_EVERY`. If a value is empty or the file is missing, the hook uses the default shown in that file — a half-filled settings file never breaks a hook.

## Safety rules every hook follows

1. **Never break a session** — an unexpected error exits quietly instead of blocking you.
2. **Never print a secret** — values read from disk stay inside the process; only file names, rule names and masked snippets are emitted.
3. **Be cheap** — fast text checks first, git or network only when they matter.
4. **No loops** — a hook that blocks Claude does so a limited number of times, then stops (rule 2.8).

## Known limits

- `explain-gate` decodes commands from a list of known risky programs. It cannot judge every command, and it cannot write the explanation itself — it forces Claude to.
- `ram-check` only stops *new* heavy work. It cannot close a program that is already running.
- Pop-ups (`notify`, `ram-check`) are Windows-only. Windows hides them in Focus Assist / Do Not Disturb.
- The secret scanner looks for known key formats and suspicious assignments; it cannot find every secret. A line that is genuinely fake can carry `secret-scan: allow` in a comment.
