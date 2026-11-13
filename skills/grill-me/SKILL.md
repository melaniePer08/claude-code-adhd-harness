---
name: grill-me
description: Ask the user the right questions BEFORE a big build, so the result is right the first time. Scales from none (tiny fix) to a full question round (big feature). Use before any medium or large task where requirements, scope or design are not completely clear, or when the user says "grill me", "interview me" or "ask me first".
---

# Grill me

Inspired by the [`grill-me`](https://github.com/mattpocock/skills) skill by Matt Pocock (MIT licence) — rewritten for this harness.

Rules this follows: 5.4 (questions before building), 1.5 (unsure → ask), 1.4 (ask once, then wait), 1.8 (terminal vs form), 5.5 (no scope creep), `FORM_AFTER` and `QUESTION_FORM` in `harness-settings.md`.

Building the wrong thing is the most expensive mistake. A few minutes of questions saves hours.

## Step 1 — Scale the round to the task

| Task | Questions |
|---|---|
| Tiny fix (one line, rename, typo) | **None.** Just do it. |
| Small, clear task | **0–2**, only if something is truly ambiguous. |
| Medium feature | **3–6** — scope, look, edge cases. |
| Big feature, new project, redesign | **A full round** (Step 3), grouped by area. |

Never ask what you can find out yourself. Search the project, `PROJECT_MAP.md`, the README and git history first (rules 5.1, 5.2). Asking "what framework is this?" when `package.json` answers it wastes the user's attention.

## Step 2 — Work out what you really don't know

Before writing a single question, list silently what could go wrong if you guessed:
- **Goal** — what should be true when this is done? Who uses it?
- **Scope** — what is explicitly *not* part of it?
- **Looks** — is there a design, a Figma file, a reference site?
- **Data** — where does it come from, where does it go? Is any of it personal data (rule 6.5)?
- **Edge cases** — empty, huge, wrong input, offline, slow?
- **Money, accounts, outside services** — anything that costs money or needs a key (rule 2.3, 7)?
- **Existing behaviour** that must not change?
- **Done when** — how will the user check it works?

Drop every item you can answer yourself. What's left are your questions. If it's more than ~12, you're asking too much: pick the ones that change the plan and choose sensible defaults for the rest — say which defaults.

## Step 3 — Write good questions

- **One decision per question.** "Should it have login, and should it use Google?" is two questions.
- **Plain words.** Explain any technical word in the same line.
- **Give options, with a recommendation.** For each: what happens if picked. Mark one **Recommended** and say why in a few words. Always allow "not sure, you decide" — and if chosen, say what you chose.
- **Say why you ask** in one sentence, so the user can answer wisely.
- **Most blocking first.** Questions that stop you from starting go on top.
- Never ask for passwords or keys (rule 7). Never ask the user to paste secrets.

Example:
> **Sign-up › Email** — Should I store the email in the database? *(Why: it lets you send a welcome message, but it's personal data, so I'd add a delete option — rule 6.5.)*
> 1. Yes, store it **(Recommended — needed for the welcome message)**
> 2. No, just show a thank-you
> 3. Not sure, you decide

## Step 4 — Terminal or form?

- Up to `FORM_AFTER` questions → ask **in the terminal**, all at once, numbered.
- More than that, or a visual review → **offer** the question form (`owner-form` skill) and say it costs extra tokens (rule 1.8). Follow `QUESTION_FORM`: `never` → terminal, `always` → build it, `ask` → offer once.
- If you already started in the terminal, stay in the terminal.

Then **stop and wait**. Ask once (rule 1.4). No "still waiting" messages.

## Step 5 — Close the loop

When the answers arrive:
1. Repeat the decisions back as a short list (5–8 lines).
2. Mark every "you decide" with what you chose.
3. If an answer changes the plan size, say so — then continue to the start card (`plan-first`).
4. If an answer is unclear, ask **that one** follow-up in the terminal. Don't start another full round.
5. Save the decisions where the project keeps them (`PROJECT_MAP.md` or `NOTES.md`) so a fresh session doesn't need to ask again.
