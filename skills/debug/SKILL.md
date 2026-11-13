---
name: debug
description: Find and fix problems with the right method — read the real error for a clear failure, find the breaking change first for "it worked before" or errors everywhere, normal debugging for code that never worked. Use for any bug, crash, failing test, failing build, or "it broke" report.
---

# Debug

Rules this follows: 9.3 (pick the right method), 8.5a (find the breaking commit), 9.4 (**never hide errors or weaken tests**), 9.5 (proof), 2.8 (loop guard: 1–2 other tries, then stop), 5.5 (no scope creep).

**Never make random changes "to see if it helps".** Every edit must follow from a reason you can state.

## Step 1 — Read the real error

Get the actual message, the full stack trace, and the command that produced it. Don't summarize from memory. Note: what failed, where (file:line), when it started failing.

## Step 2 — Pick the method

| What you see | Method |
|---|---|
| **One clear error, you can see where** | **A. Direct fix** — fastest and cheapest. |
| **"It worked before"**, or **errors everywhere** after a change | **B. Find the breaking change first**, then A on that change. |
| **New code that never worked** | **C. Normal debugging** — history won't help. |
| **Only sometimes / only on one machine / only in production** | **D. Make it reproducible first.** |

### A. Direct fix
1. Read the code at the error location and the code that calls it.
2. State the cause in one sentence: "`user.name` is undefined because the API returns `username`."
3. Fix the cause, not the symptom.
4. Re-run exactly the command that failed.

### B. Find the breaking change (rule 8.5a)
Many errors usually come from one change. Find it exactly:
1. Find the last known-good state (last passing test run, last commit the user remembers working).
2. List the commits since then, **on every branch involved**, including agent/chunk branches: `git log --oneline <good>..HEAD`.
3. Test them one by one, or let git do the search: `git bisect start`, `git bisect bad`, `git bisect good <hash>`, then run the failing check at each step and answer `good`/`bad`. **End with `git bisect reset`.** (Bisect moves the working folder between commits — commit or stash your work first, and tell the user in plain words, rule 2.1.)
4. Name the first bad commit and read its diff.
5. Fix **only that change** — nothing is deleted or rewritten from history. Then go to A.

Example: "Checked 6 commits: it broke at 'add sign-up button' (branch `agent-2`). The form reads a field that doesn't exist. Fixed."

### C. Normal debugging
1. Make a small way to trigger the failure (a test is best).
2. Add **temporary** logging or use the debugger at the boundaries: what goes in, what comes out.
3. Narrow the area by halves until the wrong value appears.
4. Fix, then **remove every temporary log** you added.

### D. Intermittent / environment-specific
1. Find what differs: data, timing, versions, settings, OS.
2. Capture the failing input or state; recreate it locally.
3. Only once it fails on demand, go to A or C. Don't fix what you can't reproduce.

## Step 3 — Prove it

Rule 9.5: show evidence, not a claim.
- The failing command now **passes** (run it, show the result).
- If a test didn't exist, **write one that fails before the fix and passes after** — and keep it.
- Run the rest of the project's checks for regressions (tests, type check, build).
- Security bug → a test that performs the attack: allowed ❌ before, blocked ✅ after.

## Never
- **Never hide an error** to get green: no empty `catch`, no deleting/skipping/loosening a test, no `// @ts-ignore` to silence a real problem, no catching and returning fake data. (rule 9.4, top rule)
- Don't "fix" by upgrading packages or rewriting modules unless the cause is there (and ask first for installs).
- Don't widen scope: note other problems as "Also noticed:" (rule 5.5).

## When you're stuck (loop guard, rule 2.8)
After **2 different attempts** that both failed: stop. Report in plain words — what fails, what you tried, what you think it is, what you'd try next — and ask. Never retry the same thing, and never rephrase a command just to dodge a safety prompt. If the cause needs the user (login, key, data, a decision), send the ❓ notification.

## Log it
If the bug came from a Claude mistake (wrong assumption, forgotten step), add one line to `mistakes-log.md`: `date · model · project · what went wrong` (rule 11.1).
