---
name: project-showcase
description: Build a bold, honest GitHub project page (README) for a finished or mostly finished project — banner, badges, screenshots or demo GIF, Mermaid diagrams, honest status, and a "what was hard" story the owner can rewrite in their own words. Use when a project is (nearly) done, before showing it to employers, or when the user asks for a project page, portfolio page or better README.
---

# Project showcase

A great project page proves three things fast: **what it does**, **that it really works**,
and **that the owner can explain how it was built**. It should look striking — but be
readable in 10 seconds and never claim anything that isn't true.

Rules this follows: 8.10 (showcase), 6.5 (personal data), 7 (secrets), 9.6 (real content), D.1 (don't overdesign).

## Step 1 — Understand the project (cheap reads only)

Read, in this order, and stop when you know enough:
1. `PROJECT_MAP.md` if it exists, then the current `README.md`
2. `package.json` (or the stack's equivalent) → name, scripts, real dependencies
3. `git log --oneline -40` → what was built, in what order
4. `DEVLOG.md` / `NOTES.md` if they exist
5. The main entry files and routes — only the parts needed to describe features

Write down: one-sentence pitch · who it's for · 3–6 real features · tech used · how to run it.

**Keep a "does it really work?" list.** A feature counts as working only if you saw it in code
that is wired up (route exists, button calls something real), or saw it running. Everything
else is **planned**.

## Step 2 — Safety scan before writing anything

The page will be public. Never include:
- keys, tokens, passwords, `.env` contents, private URLs or dashboards
- the owner's home-folder paths, email, real names of other people, private project names
- personal data from the app (real users, messages, photos)

If the current README already contains any of these, **tell the user** — don't just delete it
(it may also be in git history, and keys must be replaced by the user, rule 6.4).

## Step 3 — Plan the page (sections, in this order)

1. **Banner** — `assets/banner-light.svg` + `assets/banner-dark.svg` inside a `<picture>` so it
   matches GitHub's light/dark mode. If the owner has their own art, use it instead and ask
   for both versions. A simple generated SVG (name + one-line pitch + one accent shape) is
   a fine starting point.
2. **One-line pitch** under the banner, centred, bold.
3. **Badges** (shields.io) — only true facts: main tech (from real dependencies), status,
   licence **only if a LICENSE file exists**, live demo only if a working URL exists.
   3–5 badges maximum.
4. **Demo** — a short GIF or 1–3 screenshots of the real app (Step 4). No fake mockups.
5. **What it does** — a feature table with an emoji per row, 3–6 rows, plain words.
6. **How it works** — one Mermaid diagram (user flow or architecture), 5–9 boxes,
   checked against the real code. GitHub draws Mermaid automatically from text.
7. **Status** — honest table: ✅ works · 🚧 in progress · 📝 planned.
8. **Run it locally** — exact commands from `package.json` scripts, inside `<details>`.
9. **What was hard, and how I solved it** — 2–4 short stories drafted from the git log /
   devlog. Mark the section `<!-- DRAFT: rewrite in your own words -->` — the owner
   must be able to tell these stories in an interview.
10. **Tech used** — short list.
11. **Credits** — libraries/assets that need credit (6.6), link `CREDITS.md` if it exists.

Strong but not cluttered: one accent colour, lots of whitespace, no wall of badges,
no GIF longer than ~10 s, collapsible sections for long details.

## Step 4 — Screenshots / demo (only if cheap and safe)

- Check free memory first (rule 4.1). Under `START_RAM_GB` → skip and mark
  "Screenshots coming soon" in the plan, never fake them.
- If the app runs locally with its normal dev command, start it, take one round with
  `node "$HOME/.claude/tools/shot.mjs" http://localhost:<port> --widths 390,1440 --out ./assets/screens`,
  then **look at the PNGs** before using them. Stop the dev server afterwards (4.3).
- Never photograph pages that show real personal data or keys.
- If it needs a login, keys or a database you can't start: skip, and tell the user.

## Step 5 — Write it

- Write `README.md` (keep any useful existing content — move it, don't throw it away).
- Put images in `assets/`. Use relative paths.
- Real text only — no lorem ipsum, no "Feature 1".
- Keep the existing README's install instructions if they're correct.

## Step 6 — Check before showing

- [ ] Every ✅ feature is really working (Step 1 list)
- [ ] Safety scan again on the new files (Step 2)
- [ ] Mermaid syntax valid (simple `flowchart LR/TD`, quoted labels with special characters)
- [ ] All image paths exist; light and dark banner both present
- [ ] Badges only state facts
- [ ] Readable in 10 seconds: pitch + demo + feature table visible near the top
- [ ] "What was hard" marked as a draft for the owner

## Step 7 — Hand over

- Commit in the project with a plain message ("Add project showcase page").
- Push following the user's push rule; if the user isn't around, **don't push** — leave it
  committed and tell them.
- Tell the user in short bullets: what the page shows, what's marked planned, which
  screenshots are missing and why, and that the "what was hard" stories need their words.
- Offer (don't do): a full GitHub Pages site — turning it on is a repository setting, so ask.
