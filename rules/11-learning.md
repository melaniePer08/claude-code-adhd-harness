# 11. Learn from mistakes and improve

**11.1 Mistakes are noticed without reading old chats.**
Reading past chats costs huge amounts of tokens, so Claude never does that to find mistakes. Instead, mistakes are written down **the moment they happen**, one line each, in a small `mistakes-log.md`:
- the user corrects Claude ("you did X again", "that's wrong"),
- a hook blocks Claude (finish check failed, secret scanner, loop guard) — the hook writes the line itself, (hook)
- Claude catches and fixes its own error.

Each line: date · model · project · what went wrong.
- Example: `2026-10-17 · Sonnet · shop-site · ended the session with the dev server still running`

**11.2 Same mistake twice → one line in `LESSONS.md`** (mistake → fix).
- When a new line in `mistakes-log.md` matches an earlier one, Claude adds a lesson. It notes which model made it.
- Example: `[Sonnet] Forgot to stop the dev server before ending → always stop servers at task end.`
- `mistakes-log.md` is trimmed automatically to the last ~100 lines.

**11.3 Read `LESSONS.md` at the start of every session. Keep it under ~50 lines.** (hook: session start)
- Full → merge similar lessons, or retire old ones (11.5).
- Why: the same mistakes otherwise repeat across projects — but a long file would cost tokens every session.

**11.4 End of the day: a summary + a ready prompt for next time (`write-up` skill).**
- When the user says they're done for the day (or time's up), Claude writes per project:
  - **Done** · **Next** · **Mistakes / lessons** from today
  - **Prompt for next time** — a ready-to-paste first message that starts the next session in the right place.
- If the terminal was just closed, Claude can't write anymore — then at the next session start it builds the summary from the work log instead. (hook: session start)
- Example: "Next time, paste: *Continue the shop site: finish checkout validation (NOTES.md → Next). Don't touch the cart — it's done.*"
- Why: the next session starts instantly, without re-explaining or re-reading everything.

**11.5 Improve the system itself (`improve-system` skill).** (hook: weekly reminder at session start)
- Once a week (or when the user asks), look at the work logs, `mistakes-log.md` and `LESSONS.md` — never full past chats unless the user says yes.
- Find requests repeated **3 or more times**, and repeated mistakes.
- **Before suggesting a new skill, check the existing ones.** Often the right answer is "improve skill X" or "skill X already does this" — not another skill.
- **Protect what works:** never change a skill, hook or rule without a yes. Show what changes (before → after). The old version stays in git, so it can always be undone.
- **Model-aware:** every lesson records which model made the mistake. When the user switches to a newer or stronger model, lessons from the old one are marked "check": if the mistake doesn't happen again within a few weeks, the lesson is retired. Lessons that only matter for one model only apply to that model.
- Why: repeated work should become a one-word command — but piling up skills and rules can make things worse, and a new model may not need old fixes at all.
- Example: "This week: you asked 3× to 'run the app'. The `run` skill already does that — want me to add 'open the browser too' to it, instead of a new skill? Also: 2 Sonnet lessons haven't been needed in 4 weeks on Opus — retire them?"
