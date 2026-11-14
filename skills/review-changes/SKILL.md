---
name: review-changes
description: Review your own changes before a push or a merge — scaled to how much code changed — looking only for real problems (crashes, broken logic, contradictions, unsafe code, UI breakage). Use when the review checkpoint hook fires, before pushing a big feature, before merging, or when asked to "review this". This is the light, cheap harness version, not the built-in /code-review.
---

# Review changes

Rules this follows: 9.5 (done needs proof; review scaled to size), 5.5 (no scope creep), 9.4 (never hide errors), 6.1 (real risks first), 3.7 (check agents' work).

Named `review-changes` (not `code-review`) so it never clashes with Claude Code's built-in `/code-review`. For a deep multi-reviewer pass on a PR, the user can run that built-in command instead.

**Purpose:** catch what actually breaks or endangers the project. Not style, not "I'd do it differently", not refactors.

## Step 1 — Size the review

Get the size first (cheap): `git diff --stat <base>..HEAD` (or the range the hook names).

| Diff size | Review |
|---|---|
| **Under ~50 lines** | Read the whole diff yourself. ~2 minutes. |
| **50–800 lines** | Read the diff yourself, file by file. Focus on code files; skim docs. |
| **Over ~800 lines** | Review the **most important files only** (entry points, auth, data, payments, anything that runs on user input) and **say which files you skipped**. Suggest a second pass in chunks. |
| **Huge, risky, going to production** | Offer a separate reviewer agent (start card, rule 3.1) — or point the user to `/code-review`. |

Read **the diff**, not the whole repo (rule 5.1).

## Step 2 — What to look for (only these)

1. **Crashes / throws:** undefined variables, wrong imports or paths, bad async handling (missing `await`), off-by-one, null access, a function called with the wrong arguments.
2. **Contradictions:** commits that undo or disagree with each other; a half-finished rename (old name still used somewhere); a function changed but its callers not.
3. **Leftovers:** `console.log` / `print` debug lines, commented-out blocks, `TODO`/`FIXME` in a code path that runs, test-only shortcuts left in.
4. **Unsafe code** (rule 6.1): secrets or keys in code; missing input validation on the server; missing access/ownership checks; unescaped user content in HTML (XSS); SQL built by string concatenation; shell commands built from user input; file paths from user input; server fetching user-given URLs; debug mode or open CORS in production settings.
5. **Hidden problems** (rule 9.4): empty `catch`, swallowed errors, tests deleted/skipped/loosened, fake success messages.
6. **UI breakage in changed interface files:** missing states (loading / empty / error), broken layout at 390 px, no focus style, missing alt text. If you can run it, screenshot once (`shot.mjs`) and look; otherwise say it wasn't visually verified and why.
7. **Missing proof:** a behaviour change with no test or manual check recorded.

**Ignore:** naming taste, formatting (the formatter does it), "could be cleaner", rewriting working code.

## Step 3 — Act

- **Real problems:** fix them, re-run the relevant check, commit the fix with a plain-language message ("fix: order total ignored quantity").
- **Not safe to fix alone** (keys, accounts, big upgrades, data deletion): stop and tell the user (rule 6.4).
- **Not a problem, but you noticed:** list under "Also noticed" — don't fix unasked (rule 5.5).
- **Do not start new work** from a review, and do not refactor.

## Step 4 — Report (3 lines)

```
Checked: diff 0a652d1..HEAD (10 files, ~700 lines); skipped: none.
Fixed:   missing `await` in cart.js (commit 8f3a1c2).
Also noticed: the footer link is broken — want me to fix it?
```
or: **"No problems found."** Never write "looks good" without saying what you checked.

Then carry on with what you were doing.

## If the review hook asked for this
The review checkpoint fires every few commits once enough changed. Keep to **that diff only**, fix real problems, then continue. It is not a reason to start a refactor.
