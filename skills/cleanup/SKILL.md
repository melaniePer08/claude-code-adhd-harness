---
name: cleanup
description: End-of-task cleanup — stop every process Claude started, delete its temp files and test data, and (weekly, with a yes) offer to remove old logs and transcripts. Use at the end of every task that started servers, browsers or temp files, when the user says "clean up", and when the weekly cleanup reminder appears.
---

# Cleanup

Rules this follows: 4.3 (clean up after yourself), 4.4 (screenshots), 4.5 (weekly log cleanup — always ask), 2.2 (stopping things Claude started is free), 2.3 (closing programs Claude didn't start, deleting → ask), 6.5 (delete test data).

Leftover servers and temp files slowly eat memory and disk. Cleaning up is part of finishing — do it **before** the final report.

## A. End of every task (free — no asking)

Only things **you** started or created this session.

### 1. Processes
- Dev servers, the `owner-form` server, watchers, headless browsers, background jobs you launched.
- Find them by what you know you started (the command, the port) — not by killing broadly.
  - Windows: `Get-NetTCPConnection -LocalPort <port> -State Listen` → check the owning process is yours → `Stop-Process -Id <id>`.
  - Check again afterwards: the port should no longer be listening.
- **Never** stop programs you didn't start (the user's browser, editors, other terminals). If something unfamiliar is using a port, **tell the user and ask** (rule 2.3).
- Background agents: make sure none are still running.

### 2. Temp files
- Scratch/test folders you created (e.g. in the session scratchpad), `.shots/` screenshot folders, throwaway build output, test databases, logs you made.
- **Look before you delete** (system rule): list the target first, confirm every path is inside the project or the scratchpad and was created by you. Don't use wildcards on anything you haven't listed.
- Test data: delete fake users/orders/answers created by tests (rule 6.5) — e.g. `docs/owner-answers.json` after testing the form.
- Keep anything the user may want (reports they asked for, final screenshots in `docs/`).

### 3. The project itself
- `git status`: no stray files you created and forgot (a stray `.shots`, `*.log`, `tmp/`). Add proper ignore rules if a kind of file keeps appearing.
- Nothing half-done: unused branches you created are listed — **ask before deleting** (rule 8.6).

### 4. Say so
One line in the report: "Cleaned up: stopped dev server (port 5173) and deleted `.shots/`." If nothing needed cleaning: say nothing.

## B. Weekly cleanup (always ask first)

When the weekly reminder appears (hook at session start, rule 4.5), **offer** — never do it on your own:

1. Measure: size of `~/.claude/logs/` and old session transcripts under `~/.claude/projects/` (outside the project → the user's yes covers reading them, rule 2.3).
2. Show the user a small table: what, how big, how old, what would be deleted.
   ```
   Logs older than 30 days:       14 MB   (command log, work log)
   Transcripts older than 60 days: 310 MB  (old chats — you won't be able to reopen them)
   ```
3. Explain the command part by part (`explain-command`), with exact paths — this is **irreversible deletion**.
4. Delete only what the user approved, nothing else. Recent work logs and `LESSONS.md` / `mistakes-log.md` are kept.
5. Report what was freed. Note the date so the weekly reminder resets.

If the user says "not now", don't ask again until next week.

## Never
- Never delete anything you didn't create without asking.
- Never kill processes broadly (`taskkill /IM node.exe`, `pkill node`) — that can close the user's other work.
- Never delete `.env`, `node_modules` of a project in use, the `.git` folder, or anything in the user's home folders outside the project.
