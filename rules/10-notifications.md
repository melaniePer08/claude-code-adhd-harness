# 10. Notifications (hook: notify)

A Windows pop-up with sound — silent when the computer is in silent / Do Not Disturb mode.
Every pop-up says in a few words **what happened and what (if anything) you need to do**.

**10.1 🔴 Urgent — something is broken or dangerous**
- A **Critical security problem** was found (6.2) — work paused
- **`main` is broken** on GitHub, or after merging (8.8) — the site would publish broken code
- Something failed and Claude stopped after 1–2 other tries (2.8): tests, build, push, a hook
- Heavy work **stopped for low memory** (4.2)

**10.2 ❓ Claude needs you**
- An answer or approval is needed (start card, command, install)
- The next step needs you (a login, a key, a decision) — and whether Claude switched to another task meanwhile (2.7)
- A key must be created or replaced by you (6.4, 7.3)
- A package was too new and Claude used an older version — only if you need to decide something (6.4a)
- Claude asks whether you want the report as a page or in the terminal (1.7)
- The question form is ready (12)

**10.3 ✅ Done / progress**
- A task is finished
- **Time's up** — the small step was finished, committed, and everything stopped (2.6)
- Work was pushed to GitHub
- An agent finished; the 3-agent map check finished (5.3a)
- A `DEVLOG.md` entry or a showcase page was made — "want to post it?" (8.9, 8.10)

**10.4 ⚠️ Heads-up**
- Heavy work is starting (agents, builds, browsers)
- A task is getting big or long — token warning, with a suggestion to split it (5.8)

**10.5 📅 Weekly / daily**
- Weekly cleanup offer for old logs and transcripts (4.5)
- Weekly `improve-system` suggestions (11.4)
- Yesterday's summary is ready (11.3)

- Why: you can work in other apps or walk away and still know the moment something needs you — and urgent problems never wait silently.
- Example: "🔴 main is broken after merging `agent-3` — fixing it now, no action needed." / "❓ Need your Stripe key — instructions are in .env."
