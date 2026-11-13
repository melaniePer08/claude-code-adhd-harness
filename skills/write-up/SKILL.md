---
name: write-up
description: Write the reports and notes — task reports (terminal or small web page), handoff notes for long sessions, the end-of-day summary with a ready prompt for next time, and DEVLOG.md entries. Use when a task ends, when a session gets long, when the user says they're done for the day, or after a big change in a project that is in progress.
---

# Write-up

Rules this follows: 1.1–1.3 (short bullets first, two layers), 1.7 (report where?), 5.7 (handoff notes), 8.9 (devlog), 11.4 (end of day), 6.5 and 7 (no personal data, no secrets), `PAGE_*` settings in `harness-settings.md`.

Pick the part that matches the moment.

---

## A. Task report (end of a task)

Two layers, always (rule 1.2):

**Layer 1 — simple steps / bullets** (the user reads this in 10 seconds):
```
✅ Added the contact form
✅ Messages save to messages.json
⚠️ Not tested: the email notification (no mail server here)
❓ Need you: which email should receive messages?
```

**Layer 2 — details**, using the final-report headings from the user's global instructions, only those that apply:
**Completed · Important files · Verification · Security · Visual · Remaining**

Rules for the content:
- **Never fake results** (rule 1.6, 9.4). "I couldn't test X because Y" beats a false "works". Name what was *actually* run and its result.
- Short "why" for decisions, not essays (rule 1.3).
- Commit messages, file names and numbers are real — copy from the output, don't recall from memory.

Then ask once (rule 1.7): **"Report here in the terminal, or as a small page?"** Follow `PAGE_DETAIL` (`short` = bullets only, `both` = bullets then details).

### Report as a page
Only if asked. One self-contained HTML file in `docs/reports/` (never overwrite an old one — date in the name). Use the `PAGE_THEME`, `PAGE_ACCENT`, `PAGE_TEXT_SIZE`, `PAGE_LANGUAGE`, `PAGE_EXTRAS` values from `harness-settings.md`; if empty, use a calm light theme. Follow `rules/design-rules.md`: body text ≥ 16 px, contrast ≥ 4.5:1, readable at 390 px, no emoji-only meaning. Screenshot it once and look (`shot.mjs`) before handing it over.

---

## B. Handoff notes (long sessions — rule 5.7)

When a session is getting long, or before a context compression, write `NOTES.md` (update it, don't make a second one):

```markdown
# Notes — <project>
Updated: <date, time>

## Done
- <thing> — commit <short hash>

## In progress
- <thing> — where I stopped, what the next step is, which files

## Next
1. <step>

## Decisions (and why)
- <decision> — <reason>

## Don't forget
- <gotchas, things the user asked me not to touch>
```

Keep it under ~60 lines. No secrets, no personal data, no pasted logs. Housekeeping: **no start card needed.**

---

## C. End of day (rule 11.4)

When the user says they're done, or time is up. Per project:

```markdown
## <project> — <date>
**Done:** …
**Next:** …
**Mistakes / lessons today:** … (one line each; same mistake twice → `LESSONS.md`, rule 11.2)

**Prompt for next time** — paste this to start:
> Continue <project>: <exact next step> (see NOTES.md → Next). Don't touch <thing that's done>.
```

The prompt must work in a fresh session with no memory: name the project, the exact next step, the files, and what NOT to touch. If the terminal was closed before this could be written, the `session-start` hook builds it from the work log next time.

---

## D. Devlog entry (rule 8.9)

After a big change in a project that is in progress, append to `DEVLOG.md` (create it if missing). **No start card.**

```markdown
## <date> — <short title in plain words>
**What I built:** … (2–3 sentences)
**Why:** …
**What was hard / what I learned:** …
**Next:** …
```

- Written as the user would say it, first person, plain language — they will rewrite it in their own words if they want.
- Honest: say what doesn't work yet.
- Then tell the user in one line: "✅ Added to DEVLOG.md — want to post it?" Nothing is posted outside the repo without a yes.
- This is raw material for the portfolio and `project-showcase`, so keep real details: numbers, decisions, screenshots paths.

---

## Always
- No keys, tokens, `.env` contents, private paths, or real personal data in any report, note or devlog (rules 6.5, 7).
- Don't re-read the whole chat to write these. Use what you know, `git log`, and the live checklist.
- Commit notes and devlog changes with a plain-language message.
