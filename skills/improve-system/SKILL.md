---
name: improve-system
description: Weekly self-improvement of the harness — read the work logs, mistakes-log.md and LESSONS.md (never full chats), find requests repeated 3+ times and repeated mistakes, suggest improving an existing skill before adding a new one, and retire lessons a newer model no longer needs. Use when the weekly reminder appears, when the user asks to "improve the system", or when they switch to a newer model.
---

# Improve system

Rules this follows: 11.1–11.5 (learning), 2.3 (changing settings/skills needs a yes), 5.1 (cheap reads), 3.5 (cheapest model), 10.5 (weekly notification).

**Protect what works.** Never change a skill, hook or rule without a yes. Show before → after. The old version stays in git, so it can always be undone. More skills and rules are not automatically better — sometimes the best change is deleting one.

## What to read (cheap — rule 11.1, 11.5)

- `~/.claude/logs/` work logs for the past week (what changed, what was committed)
- `mistakes-log.md` (one line per mistake: date · model · project · what went wrong)
- `LESSONS.md` (≤ 50 lines)
- The list of existing skills (names + descriptions only)

**Never read full old chats/transcripts** — that costs huge amounts of tokens. Only if the user says yes, and say how big it is first.

## Step 1 — Find patterns

1. **Repeated requests (3 or more times):** things the user asked for again and again ("run the app", "make a report", "check the phone view"). Group similar ones.
2. **Repeated mistakes:** the same kind of line more than once in `mistakes-log.md`. (Same mistake twice → it should already be a lesson, rule 11.2 — add any missing ones.)
3. **Friction:** hook blocks that kept happening, questions the user had to answer repeatedly, steps they always corrected.
4. **Lessons gone stale** (Step 4).

## Step 2 — Before suggesting anything new, check what exists

For every pattern, ask in this order:
1. **Does an existing skill/hook/rule already cover it?** → "The `run` skill already does that" — maybe the user just didn't know. Say so.
2. **Can an existing one be improved?** → propose the small edit.
3. **Only then** consider a new skill — and only if the request repeated ≥ 3 times and no existing one fits.

Example: "You asked 3× to 'run the app'. The `run` skill already does that — want me to add 'open the browser too' to it, instead of a new skill?"

## Step 3 — Propose, one at a time, with before → after

```
Suggestion 1 of 3 — improve `plan-first`
Problem: 4 times this week the start card suggested 30 min for tiny tasks.
Change:  in Step 3 → Time: "tiny tasks never get a time question" (it already says so, but
         add it to the example, because the example is what gets copied).
Before:  <the current lines>
After:   <the new lines>
Apply? (yes / no / change it)
```

- Wait for each answer (ask once, rule 1.4); apply only the "yes" ones.
- Apply in the harness repo, one commit per change with a plain message ("improve plan-first: …"), and copy to `~/.claude/` only with the user's yes (config change, rule 2.3).
- If a suggestion would change a **rule** (not just a skill), say so clearly — rules are the user's decisions.

## Step 4 — Model-aware lessons (rule 11.5)

Every lesson in `LESSONS.md` records **which model** made the mistake: `[Sonnet] Forgot to stop the dev server → always stop servers at task end.`

When the user switches to a newer or stronger model:
1. Mark lessons from the old model as **"check"** (add the date).
2. If the mistake **doesn't happen again within a few weeks** (check `mistakes-log.md`), propose retiring that lesson.
3. Lessons that only matter for one model apply only to that model.
4. Keep `LESSONS.md` under ~50 lines: merge similar lessons, retire old ones.

```
2 lessons from Sonnet haven't been needed in 4 weeks since you switched to Opus:
- "Always stop dev servers at task end" (no repeat in 28 days)
- "Re-read a file after the formatter runs" (no repeat in 28 days)
Retire them? (They can come back from git history.)
```

## Step 5 — Housekeeping and report

- Trim `mistakes-log.md` to the last ~100 lines (rule 11.2).
- Note the date so the weekly reminder resets; the weekly **cleanup offer** is the `cleanup` skill (separate, asks first).
- Short report: what you looked at (sizes, date range), what you found, what was applied, what's left for later. Housekeeping notes need no start card.
- Send the 📅 notification only if the user isn't at the terminal and a decision is waiting.

## Never
- Never change a skill, hook, rule or setting without a yes.
- Never read old chats without a yes.
- Never add a skill when improving one would do.
- Never include secrets or personal data in logs, lessons or suggestions.
