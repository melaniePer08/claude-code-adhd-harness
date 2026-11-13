---
name: plan-first
description: Show the start card (plan + time limit + agents/models) and wait for ONE yes before starting any real task. Use at the start of every task that will take more than about 5 minutes, before editing files, launching agents or running long commands. Skip for tiny tasks and housekeeping.
---

# Plan first (the start card)

Rules this follows: 2.4 (start card), 2.5 (time limit), 2.6 (time's up), 3 (agents), `PLAN_FIRST` in `harness-settings.md`.

If `PLAN_FIRST = no` in `harness-settings.md`, skip the card and just start. Otherwise follow the steps below.

## Step 1 — Decide how big the task is

| Size | What to do |
|---|---|
| **Tiny** (under ~5 min, e.g. one-line fix, rename, typo) | One-line plan in the message, then do it. No time question, no card. |
| **Housekeeping** (devlog entry, handoff note, project map update, lessons, showcase page for a finished project) | No card. Just do it. |
| **Everything else** | Full start card (Step 3). |

If unsure, treat it as not tiny.

## Step 2 — Look before you plan (cheap reads only)

You cannot write an honest plan without knowing the project. Read, in this order, and stop when you know enough:
1. `PROJECT_MAP.md` if it exists
2. The files the task clearly touches (search first, then read only those)
3. `git status` and `git remote -v` — the project must be connected to GitHub before any file changes (rule 8.1). If not, stop and ask for the repo link.

If the request is unclear in a way that changes the plan, ask the questions **before** the card (rule 1.5). Do not put guesses on the card.

## Step 3 — Show the card

Keep it short enough to read in 20 seconds. Exactly this shape:

```
Plan:   1. <step>  2. <step>  3. <step>        (3–6 steps, plain words)
Time:   <suggested limit>                      (e.g. 30 min — say it's your suggestion)
Agents: none   (or: 1 × Sonnet verifier — writes break-it tests)
Asks later: <anything that will need a separate yes>   (installs, settings, deletes…)
Start?
```

Rules for each line:
- **Plan** — verbs the user understands, no jargon. Name real files or screens when helpful. Include the verify step ("check it in the browser", "run the tests").
- **Time** — always a real number. Suggest from the size: small 15 min · medium 30–45 min · large 1–2 h (and suggest splitting, rule 5.8). The user may pick a longer time and walk away.
- **Agents** — small and medium tasks: `none`, Claude does the steps itself. Use agents only if they save real time or give an independent check. Name the model (cheapest that fits: Haiku → Sonnet → Opus), the exact job, and stay within `MAX_AGENTS` unless the extra ones are explained one by one. Never launch agents that are not on the card.
- **Asks later** — be honest about what will need separate approval (rule 2.3). If nothing, write `nothing`.

Then **stop and wait**. One question, asked once (rule 1.4). Never send "still waiting".

## Step 4 — Work inside the card

- A "yes" covers exactly what is on the card. New agents, new installs, or a bigger plan → say so and ask again.
- "Change X" → update the card and show it again, shorter.
- Keep a live checklist for big tasks (rule 5.5).
- Watch the clock. When time is up (rule 2.6): **finish the small step you are in, commit, stop servers and agents, send the ✅ notification**, and say what comes next. Do not finish the whole task past the limit.

## Step 5 — Finish

Report in two layers (rule 1.2): simple bullets first, details after. Then ask if the user wants the report in the terminal or as a small page (rule 1.7).

## Example

```
Plan:   1. Add a contact form to contact.html
        2. Save messages to a local file (no database)
        3. Check it in the browser at phone width
Time:   30 min (my suggestion)
Agents: none
Asks later: nothing
Start?
```
