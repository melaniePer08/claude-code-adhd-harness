---
name: resources-finder
description: Suggest one or two well-chosen tools, libraries or guides from RESOURCES.md that fit the current task (a linter, a security scanner, a component library, a design-token tool…), with the trade-offs. Use when starting a task that touches a topic RESOURCES.md covers, when the user asks "is there a tool for…", or "what should I use for…". Never installs anything.
---

# Resources finder

Rules this follows: 2.3 / 2.3a (never install without a yes; every package goes through `package-check`), 5.5 (suggest, don't add scope), 6.6 (licences), 5.1 (search first).

`RESOURCES.md` (in the harness repo, installed at `~/.claude/harness/RESOURCES.md`) is a table of useful projects by topic. Use it to **suggest**, not to shop. Often the right answer is "the project already has a tool for that" or "no extra tool needed".

## Step 1 — Is the task on a topic RESOURCES.md covers?

Match the task to a section: design components · security checklists and scanners · formatters and linters · commits, releases, git hooks · connecting design tools · the Claude Code ecosystem. Search the file by heading — don't read all of it if you only need one section (rule 5.1).

If the task isn't on a covered topic, say nothing about resources. Don't force a suggestion.

## Step 2 — Check what the project already has

Before suggesting anything:
- Look at `package.json` / config files / `PROJECT_MAP.md`: is a linter, formatter, test runner, component library already there?
- Respect existing conventions (user rule: no formatter or runner is installed globally; use the project's own tooling).
- If something already does the job → say "this project already uses X for this" and stop.

## Step 3 — Pick at most two

For each suggestion, give:
- **Name and link**, and what it does in one plain line.
- **Why it fits this task** (one sentence).
- **Trade-off:** extra dependency? learning curve? licence note (⚠️ copyleft: fine to *run*, careful when copying or linking its code)?
- **Freshness:** `RESOURCES.md` numbers are dated — say the date and that it may be out of date; if the last update looks old or the project looks abandoned, check the repo page before recommending.

```
For the security check I'd suggest one of these (not installed — your call):
1. **Gitleaks** — scans code and git history for leaked keys. MIT. Runs locally, nothing sent anywhere.
   Fits because you commit often and have a Stripe key in play.
2. **Semgrep** — finds insecure code patterns. LGPL (fine to run, don't copy its code).
   Heavier; worth it once the app has logins.
Neither is needed for this small static site — I'd skip both for now.
```

## Step 4 — If the user wants one

1. Run `package-check` (name, age ≥ `PACKAGE_WAIT_DAYS`, scripts, licence). For non-package tools (a binary, a CLI), check the official release page, signature/checksum if offered, and the licence.
2. Explain the install command part by part (`explain-command`) and **ask** (rule 2.3). Large downloads (> ~100 MB) always ask.
3. Add credits to `CREDITS.md` if the licence requires credit.

## Never
- Never install, download or run a tool just because it's listed.
- Never suggest more than two — the user wants a decision, not a catalogue.
- Never say a tool is "safe" because it has many stars: stars show popularity, not safety (see `DISCLAIMERS.md`).
- Never add a suggestion to the task's scope unasked (rule 5.5): present it as an option.
