---
name: design-review
description: Screenshot a page at phone, tablet and desktop widths and review what it actually looks like against a concrete checklist. Use after changing any interface, when something "looks off" or "looks wrong", before calling frontend work finished, or when the user asks how a page looks.
---

# Design review

Code that compiles tells you nothing about whether a page looks right. This skill is
for looking at it.

## Step 1 — Get the page on screen

Find the dev server (`npm run dev`, `npm start`, the port in `vite.config`,
`README`, or `package.json`). If it is not running, start it in the background and
wait for the port to answer.

If the project is plain HTML with no server, pass the file path directly — the tool
serves the folder over `127.0.0.1` by itself.

## Step 2 — Capture

```bash
node "$HOME/.claude/tools/shot.mjs" http://localhost:5173 --out ./.shots
```

Defaults to 390 (phone), 768 (tablet) and 1440 (desktop). Useful flags:
`--widths 390,1440`, `--selector "#checkout"`, `--wait 1500` for animations or data
loading, `--out DIR`.

The JSON it prints already contains things worth acting on before you even look:
`consoleErrors`, `failedRequests` (a 404 image is invisible in the code and obvious
on screen), and `warnings` for a missing viewport tag or images without alt text.

**Then Read each PNG.** The screenshots are the review. Skipping this step and
reviewing the source code instead defeats the purpose.

## Step 3 — Review against this checklist

Go through it in order. Most real problems are in the first four.

**Hierarchy** — Where does the eye land first? Is that the most important thing on the
page? Can you tell primary from secondary action at a glance?

**Spacing** — Is spacing on a consistent rhythm, or arbitrary? Related things closer
together than unrelated things? Is anything cramped against an edge? Is the page
breathing, or stuffed?

**Alignment** — Do edges line up down the page? Anything *nearly* aligned reads as a
bug. Is there an invisible grid, or is everything centred by default?

**Typography** — More than two typefaces? More than ~4 sizes on one screen? Body text
below 16px? Line length over ~75 characters? Line height below 1.5 on paragraphs?
Headings that are just bold body text?

**Colour and contrast** — Is grey text readable, actually measured, not guessed? Is the
accent colour doing one job or scattered everywhere? Pure black on pure white? Does it
survive dark mode if the project supports it? **Colour-blind safe:** is any meaning shown
by colour alone (red = error, green = OK)? Add an icon or a word too.

**Accessibility** — Keyboard: can every control be reached with Tab, in a sensible order?
Visible focus? Images have alt text? Buttons and inputs have labels? On art sites and
games, the art itself may break these rules — menus, text and buttons still may not.

**Responsive** — At 390: does anything overflow horizontally, get clipped, or collapse
into a column of squashed cards? Are tap targets at least 44px? At 1440: does content
stretch into an unreadable full-width band, or is it contained?

**States** — Hover and `:focus-visible` on every interactive element. Disabled states
that look disabled. Loading, empty and error states that exist at all.

**Polish** — Broken or missing images. Placeholder text left in. Inconsistent border
radius. Icons at mismatched sizes or optical weights. Misaligned icon and label.
Scrollbars appearing where they should not.

## Step 4 — Report

Give **at most 8 findings, ranked by how much they hurt**, each as one line:
what is wrong, where, and the specific fix.

```
1. Hero heading and body are both 16px — no hierarchy. Set heading to --text-3xl.
2. Cards overflow at 390px: fixed width:320px in Card.tsx:24 → min-width:0 + fluid grid.
3. Muted text #a8a8a8 on white is 2.4:1, unreadable. Use --text-muted (#6b6b76).
```

Then **fix the ones you are confident about** and re-screenshot to confirm the fix
actually landed. Raise anything subjective with the user rather than deciding taste
for them.

Do not list everything that could theoretically be better. A review of 20 minor
points is less useful than 5 real ones.

## When the answer is "it needs a direction, not a fix"

If the review keeps returning "this is fine but forgettable", the problem is not a list
of small defects — it is that the page has no design direction. Switch to the
`design-research` skill: audit, name the real problem, look at how comparable products
solve it, and propose 2–3 directions rather than patching details.

## Honesty rule

If you could not get the page running, say so plainly and say what you checked
instead. Never describe a screenshot you did not take.
