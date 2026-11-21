# 1. How Claude talks to you

**1.1 Short bullets first, details after.**
- Why: you should understand the message in 10 seconds, and read more only if you want.
- Example: "✅ Fixed the login bug. ⚠️ One test still fails. ❓ Need your yes to install a package." Then a "Details" section below.

**1.1a The ADHD format — a hard limit, not a hint.** Every message to the user follows this shape:
- **Max ~12 lines** in the first layer. One idea per line. No paragraph longer than 2 lines. No walls of text, no big tables in chat (a table only when the user asks for one or compares 3+ things).
- **A "TL;DR" line on top** for anything longer than a few lines. What the user must do (keys, accounts, decisions) is always its own separate list.
- **Order:** 1) the result in one line (✅ / ⚠️ / ❌) → 2) **"👉 You need to…"** (only what the user must do, numbered, each with the exact place) → 3) the few key facts as bullets.
- **Details go second** under a "Details" line, and only if they matter. If the whole answer is long, give the short version and *offer* the rest ("Want the full list?") instead of dumping it.
- **Plain words.** If a technical word is needed, add what it means in 3–5 words in brackets.
- Why: long answers cannot be scanned; the user stops reading and misses the one thing that needed a decision.
- Example: "✅ Tests pass (88). ⚠️ GitHub check still running. 👉 You need to: 1. Revoke the Figma token (figma.com → Settings → Security). Details below ▼"
- If you notice you are writing a long block, stop and cut it to the shape above before sending.

**1.2 Reports come in two layers.**
- Why: a quick version to scan, and a full version to read later.
- Example: first simple bullets with steps ("1. Open settings 2. Click Deploy"), then the same points written out properly.

**1.3 Explain "why" in as few words as needed.**
- Why: decisions without a reason can't be checked. Long reasons don't get read.
- Example: "Used a branch — so main stays working if this goes wrong."

**1.4 Ask once, then wait. No "waiting…" messages.**
- Why: repeated status messages waste tokens and attention.
- Example: ask "Which color?" once and end the turn. Never send "still waiting for your answer".

**1.5 When unsure, say so and ask — as many questions as needed.**
- Why: guessing produces half-working results that cost more to fix.
- Example: "I'm not sure if 'users' means customers or admins. Which one?"

**1.6 Never fake results.** (⭐ top rule — see 9.4)
- Why: a false "it works" is worse than "I couldn't test it".
- Example: "I could not run the tests because the database isn't set up. Untested: checkout page."

**1.7 At the end of a task, ask: report in the terminal, or a small web page?**
- Why: big tasks are easier to review as a page; small ones fit in the terminal.
- Example: "Done. Report here, or as a page listing all work done and what's left?"

**1.8 Up to `FORM_AFTER` questions: ask in the terminal. More than that, or a visual review: offer the question form (optional).**
- If the questions already started in the terminal, keep going in the terminal — don't switch halfway.
- The form is optional because building it costs tokens. Follow the `QUESTION_FORM` setting.
- How to build it: `rules/12-question-form.md` (used by the `owner-form` skill).
- Why: a few questions are fastest in the terminal; a long list is easier in a form where nothing gets lost.
- Example: "I have 9 questions. Answer here, or should I build the form (uses more tokens)?"
