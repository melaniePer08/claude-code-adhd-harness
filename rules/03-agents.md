# 3. Agents (helpers that run in parallel)

**3.1 Agents only inside an approved start card (2.4).**
- Why: agents run at the same time, use many tokens, and load the computer. One session once launched 13 agents and nearly crashed a computer.
- Example:
  ```
  Agents: 2, ~10 min
  1. Haiku — search the project for every place prices are calculated (read-only)
  2. Sonnet — verifier: writes break-it tests for the checkout total (writes to tests/ only)
  How aggressive? [0 agents / 1 / 2]
  ```

**3.2 Small and medium tasks: no agents — Claude does the steps itself.**
- Agents are for big tasks, or when the user asks for speed.
- Why: for most work, one session doing the steps in order is cheaper and safer than several agents.

**3.3 Suggest up to `MAX_AGENTS` agents normally. More is OK to suggest when speed matters — but explain each agent's job.**
- Why: more agents always cost more and load the computer, but when a task must be done fast, extra agents can be worth it. The user decides with the full picture.
- Example: "Normal: 2 agents. Faster option: 4 agents (~2× tokens) — 1. Haiku searches the old code 2. Sonnet writes the API 3. Sonnet writes the page 4. Sonnet verifier. Which one?"

**3.4 The fixed agent roles (so they never pile up):**

| Role | When | Count |
|---|---|---|
| **Verifier** | Big features: writes break-it tests AND confirms the task really matches the request (9.4a, 9.5) | 1 |
| **Merge manager** | Before finishing/publishing: merges all branches into `main`; uses the verifier as its checker (8.8) | 1 (+ the verifier) |
| **Map check** | Only at the finish line — going to production, presenting, or just finished building (5.3a) | 3, cheap model, run alone |

- During normal work the map is updated by Claude itself — no agent.
- These never run all at once: at most 2 during a build, the 3 map agents only at the very end.
- Why: before this table, one big build could add up to 7 agents.

**3.5 Use the cheapest model that can do the job.**
- Why: saves tokens for the work that needs a strong model.
- Example: Haiku for searching/reading, Sonnet for writing code and tests, Opus only for really complex problems — and say which one in the start card.

**3.6 Every agent's instructions must include:**
- Its exact job and when it is done
- A time and size limit
- Read-only, unless the plan says it writes
- These rules (core file)
- Read "How code is written here" in `PROJECT_MAP.md` and match it (9.2)
- Report back in short bullets (then details if needed)
- Why: an agent starts with no context; a vague brief produces confident wrong work.

**3.7 Check an agent's work yourself before reporting it as done.**
- Why: agents can say "done" when they are not.
