# 5. Save tokens (without lowering quality)

**5.1 Search first, then read only the part you need.**
- Why: reading whole files you don't need wastes tokens.

**5.2 Don't re-read a file you already read, unless it changed.**
- Why: the information is already known.

**5.3 Read the project's file map first — and keep it updated yourself (`project-map` skill).**
- `PROJECT_MAP.md` lists each file (except secret files) with a summary — longer for big files — plus a simple mind map of how pages and parts connect, plus "How code is written here" (9.2).
- Create it once per project. While working, Claude updates the line for every file it changes — no agent needed.
- Why: a short summary of every file is far cheaper than opening them all.

**5.3a At the finish line only, the map is checked by 3 agents.**
- When: going to production, presenting the project, or just finished building something big. Never during normal work.
- Agent A and Agent B each check the map on their own and write findings to their own file (`map-check-A.md`, `map-check-B.md`). They never talk to each other — only through files.
- Agent C reads both files, keeps what both agree on, re-checks the code where they disagree, and writes the final `PROJECT_MAP.md`.
- Cheap models, inside the start card, and nothing else runs at the same time.
- Why: two separate checks catch mistakes one agent would repeat. Keeping them apart stops one copying the other's errors.

**5.4 Ask questions before building — how many depends on the size (`grill-me` skill for big builds).**
- Why: building the wrong thing is the most expensive mistake.
- Example: tiny fix → no questions. Medium → a few. Big feature → a full question round.

**5.5 No scope creep.**
- Why: unrequested work costs tokens and creates surprises.
- Example: do only what was asked. "Also noticed: the footer link is broken — want me to fix it?"

**5.6 Big tasks get a checklist that updates as you go.**
- Why: the user sees progress at a glance.

**5.7 Write handoff notes when a session gets long.**
- Why: if the session ends or memory gets compressed, nothing is lost.
- Example: `NOTES.md` → Done / In progress / Next.

**5.8 When a task gets big, suggest splitting it — or a cheaper way to do it (`task-splitter` skill).**
- Split it into small chunks, each with a short brief, that can run in **fresh terminals** (new sessions start with a clean, cheap memory).
- Or suggest a different, cheaper approach that gets the same result.
- Why: one huge session keeps re-sending everything it has seen, which burns tokens fast. Small fresh sessions do the same work for less.
- Example: "This is getting big. Option 1: split into 3 chunks — (1) database, (2) API, (3) page — each in a new terminal with its own brief. Option 2: reuse the existing form component instead of building a new one. Which?"
