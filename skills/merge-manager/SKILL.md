---
name: merge-manager
description: Before a project is finished or published, merge every branch with unmerged work into main, test main after each merge, and fix what broke — so the live site isn't missing anything. Use when the user says finish, publish, deploy, or "put everything together", or when several branches (agents, chunks, features) exist.
---

# Merge manager

Rules this follows: 8.8 (main must contain everything), 8.5a (find the breaking change), 8.6 (never force-push or delete branches without a yes), 3.4 (roles: merge manager + verifier), 10.1 (🔴 if `main` breaks).

**Why:** sites like Vercel or GitHub Pages publish only what is in `main`. Work left on other branches (from agents, chunks, features) is **invisible** — the live site is missing it.

## Step 0 — Preconditions

- Project connected to GitHub (`git remote -v`).
- Inside an approved start card (rule 2.4). Merging and pushing are free actions (rule 2.2); an extra **verifier agent** must be on the card.
- Working tree clean (`git status`). If not, commit or ask.
- **Backup point first** (rule 8.5): note the current `main` hash: `git rev-parse main`. It's your undo.

## Step 1 — List what's unmerged

```bash
git fetch --all --prune
git branch -a --no-merged main       # branches with work main doesn't have
git log --oneline main..<branch>     # what each one adds
```

Make a table: branch · what it adds (commits) · last commit date · overlaps with other branches (same files)? Show it to the user in the plain-words layer. Branches that look abandoned or experimental: **ask** — don't merge blindly.

## Step 2 — Merge one at a time

Order: smallest/least risky first, or dependency order if one builds on another.

For each branch:
1. `git switch main` and make sure it's up to date (`git pull --ff-only`).
2. `git merge --no-ff <branch>` (keeps the history readable and each merge undoable).
3. **Conflict?** Read both sides. Keep the intent of both. Never just pick "ours" or "theirs" for a whole file. If you can't tell what the right result is, stop and ask (rule 1.5).
4. Run the project's checks right away: build, tests, type check.
5. If it fails: find out **which merge** caused it (rule 8.5a — you merged one at a time, so it's the last one). Fix only that. If it's not quickly fixable: `git merge --abort` (if mid-merge) or `git reset --hard <backup hash>` **only with the user's yes** (rule 2.3, it's destructive) — or revert the single merge with `git revert -m 1 <merge hash>`, which keeps history.
6. Commit the merge (plain-language message: "Merge: contact form from branch `chunk-3`").

## Step 3 — Verifier checks `main`

After all merges, the **verifier** (`verify` skill; one agent, Sonnet) tests `main`: full build, full test suite, and a real look at the app (run it; screenshot the key pages).

- Findings go into a file (`docs/merge-check.md`): what broke and where.
- You find which merge caused each (8.5a) and fix it.
- Repeat until `main` is complete and working.

## Step 4 — Publish

1. `git push origin main` (normal push — **never force**, rule 8.6).
2. If `main` is broken at any point after pushing: **🔴 notify immediately** (rule 10.1), fix forward or revert the bad merge (a new commit, not history rewriting).
3. Confirm on GitHub (`gh run list` or the repo page) that checks pass, if the project has CI.

## Step 5 — Tidy up (asks first)

- **Deleting** merged branches needs a yes (rule 8.6): list them, ask, then delete only those the user approves (`git branch -d <name>`; remote with `git push origin --delete <name>` — explain it part by part first).
- Delete `docs/merge-check.md` or keep it as a note — user's choice.

## Report
```
✅ 4 branches merged into main (chunk-1 … chunk-4). Verifier found the cart broken after
   merging chunk-3 — fixed. All 38 tests pass; build OK. Pushed main (abc1234).
Not merged (asked you): experiment-old (abandoned, 3 months).
```

## Never
- Never force-push, rewrite pushed history, or delete branches without a yes.
- Never merge a branch you haven't looked at.
- Never resolve conflicts by blindly taking one side.
- Never push a `main` that fails the build or tests.
