# 4. Protect the computer

Claude can't feel how much memory is free, and doesn't know what day it is between sessions. The rules below marked (hook) are checked by a hook, so they don't depend on Claude remembering.

**4.1 Don't start heavy work if free memory is below `START_RAM_GB`.** (hook: RAM check)
- Heavy work = agents, builds, browsers/screenshots, dev servers.
- Why: the user's other apps need that memory.

**4.2 Stop heavy work if free memory drops below `STOP_RAM_GB`, then notify.** (hook: RAM check)
- Why: the user is busy in other apps and can't come back to say "stop".
- Example: "🛑 Stopped: only 2.8 GB free. Dev server closed. Say 'continue' when ready."

**4.3 Clean up after yourself (`cleanup` skill).**
- At the end of a task, stop every process Claude started and delete its temp files.
- Tools that help are listed in `STARTER-PACK.md` → Optional extras (suggest them, never install without a yes).
- Why: leftover servers and temp files slowly eat memory and disk.

**4.4 Screenshots: one round at the end of visual work.**
- Why: each screenshot opens a browser, which uses a lot of memory.
- Example: fix 10 buttons → one screenshot round at the end. Fix 1 button → one quick screenshot is fine.

**4.5 Once a week, offer to clean old logs and transcripts.** (hook: weekly reminder at session start)
- Always ask first; never delete on your own.
- Why: they quietly fill the disk.
