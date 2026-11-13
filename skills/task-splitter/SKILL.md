---
name: task-splitter
description: When a task gets big, split it into small chunks that can each run in a fresh terminal with a short brief, or suggest a cheaper way to get the same result. Use when a task has many independent parts, the session is getting long or expensive, or the user asks to split the work or save tokens.
---

# Task splitter

Rules this follows: 5.8 (split big tasks), 5.6 (live checklist), 5.7 (handoff notes), 3.2 (small/medium → no agents), 2.4 (start card).

**Why:** one huge session keeps re-sending everything it has seen, so every step gets more expensive. Several small fresh sessions do the same work for less — and each starts with a clean head.

## Step 1 — Decide whether to split at all

Suggest splitting when **any** of these is true:
- The plan has more than ~6 steps in different areas (database + API + pages + tests).
- The conversation already holds a lot (many files read, long outputs, several earlier tasks).
- Parts are independent — they don't need each other's results to start.
- The user is on a lower plan or says tokens are tight (`PLAN` in `harness-settings.md`).

Don't split when the steps are tightly linked (each needs the previous result) or the task is small — splitting has its own cost (briefs, merging).

## Step 2 — Look for a cheaper way first

Before splitting, check:
- **Reuse:** does the project already have a component/function that does most of this? (search first, rule 5.1)
- **Smaller scope:** can the first version do 60% of the work, with the rest as a later chunk? (rule 5.5)
- **Existing tool:** a library the project already uses, or a skill (`RESOURCES.md`), instead of writing new code?

If one of these removes work, offer it as **Option 2**.

## Step 3 — Cut the task into chunks

Good chunks are:
- **One area each** (database / API / page / tests), 15–45 minutes of work
- **Independent** where possible; where not, in a clear order
- **Checkable** — each ends with something you can run or look at
- **Small in files touched**, so two terminals never edit the same file (conflicts!)

For each chunk write a **brief** the fresh terminal can follow with zero memory:

```markdown
### Chunk 2 of 4 — Orders API
**Goal:** POST /api/orders and GET /api/orders/:id, only for the logged-in user.
**Done when:** `npm test -- orders` passes, including "user B can't read user A's order".
**Read first:** PROJECT_MAP.md → "How code is written here"; src/routes/users.js (same style).
**Touch only:** src/routes/orders.js, tests/orders.test.js. Nothing else.
**Don't:** change the database schema (chunk 1 did it), or install packages.
**Needs from earlier chunks:** table `orders` exists (chunk 1, commit abc123).
**Time limit:** 30 min. Commit when done, push, write NOTES.md → Done.
```

Put the briefs in `docs/chunks/` (or one `TASKS.md`) so they survive. Order them, mark which can run in parallel.

## Step 4 — Offer the choice (one question)

```
This is getting big. Options:
1. Split into 4 chunks, each in a new terminal with its own brief
   (database → API → pages → tests). Cheaper per step; I write the briefs now.
2. Cheaper approach: reuse the existing <component> and skip <feature> for now.
3. Keep going here (costs more as the chat grows).
Which one?
```

Then wait (rule 1.4). Never split without a yes.

## Step 5 — If they split

1. Write the briefs and a short `TASKS.md` index with order and dependencies.
2. Make a **backup point** first: commit or branch (rule 8.5).
3. Tell the user how to start each terminal: "Open a new terminal in the project folder and paste: *Read docs/chunks/02-orders-api.md and do it.*"
4. Parallel terminals should use **separate branches** (`chunk-2-orders`) so they don't overwrite each other. Merging them into `main` later is the `merge-manager` skill's job (rule 8.8).
5. Write the handoff note (`write-up` skill, part B) so nothing in this session is lost.

## Never
- Never run parallel sessions that edit the same files.
- Never skip the verify step: each chunk must prove it works before the next relies on it (rule 9.5).
