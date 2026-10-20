---
name: design-system
description: Give a project a real visual foundation — color, type, spacing, radius, shadow and motion tokens — so everything built afterwards looks deliberate instead of generic. Use when starting any interface, when a project looks flat or inconsistent, or when the user says it "looks AI-generated" or "looks like a template".
---

# Design system

Most interfaces look amateur for the same few reasons: too many sizes, inconsistent
spacing, pure black on pure white, one radius here and another there, and a colour
picked at random per component. Fixing that once, up front, raises the quality of
everything built afterwards without slowing anything down.

## Step 1 — Read the project first

Find out what already exists before adding anything:

- Styling approach: Tailwind, CSS modules, plain CSS, styled-components, SCSS, a UI kit?
- Is there already a token file, a theme object, or a `tailwind.config`?
- What does the existing UI look like — screenshot it with `shot.mjs` if it runs.

**Never replace an existing design system.** If one exists, extend it and fill the gaps.
Adding a second set of tokens beside a first is worse than having none.

## Step 2 — Pick a direction, do not invent one silently

Ask the user **one** question with three concrete options, each described in plain
language, not jargon. For example:

- **Calm & editorial** — lots of white space, large serif headings, restrained colour,
  content-first. Suits portfolios, writing, galleries.
- **Crisp & modern product** — tight sans-serif, strong contrast, one confident accent,
  cards and clear affordances. Suits apps, dashboards, SaaS.
- **Warm & friendly** — softer rounding, warmer neutrals, generous type, gentle colour.
  Suits community, education, personal projects.

If the project already has a logo, existing colours, or a reference site the user likes,
use that instead of asking.

Ground those options in real examples rather than inventing them — the `design-research`
skill has the sources, matched to the kind of product being built.

## Step 3 — Write the tokens

Put them in one place — `:root` in a global stylesheet, or `tailwind.config`. Every
component reads from these. No component invents its own value.

```css
:root {
  /* Type — one scale, ratio 1.25. Do not use sizes outside it. */
  --text-xs: 0.75rem;    /* 12px — labels, captions only */
  --text-sm: 0.875rem;   /* 14px — secondary text */
  --text-base: 1rem;     /* 16px — body. Never smaller for paragraphs. */
  --text-lg: 1.125rem;   /* 18px — lead paragraphs */
  --text-xl: 1.5rem;     /* 24px — card titles */
  --text-2xl: 1.953rem;  /* 31px — section headings */
  --text-3xl: 2.441rem;  /* 39px — page titles */
  --text-4xl: 3.052rem;  /* 49px — hero */

  --leading-tight: 1.15; /* headings */
  --leading-normal: 1.6; /* body — never below 1.5 */
  --measure: 65ch;       /* max line length for readable text */

  /* Space — a 4px rhythm. Every margin and padding is one of these. */
  --space-1: 0.25rem;  --space-2: 0.5rem;   --space-3: 0.75rem;
  --space-4: 1rem;     --space-6: 1.5rem;   --space-8: 2rem;
  --space-12: 3rem;    --space-16: 4rem;    --space-24: 6rem;

  /* Radius — pick ONE family and stay in it. */
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px; --radius-full: 999px;

  /* Shadow — layered and low-alpha. A single hard shadow always looks cheap. */
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.04), 0 1px 3px rgb(0 0 0 / 0.06);
  --shadow-md: 0 2px 4px rgb(0 0 0 / 0.04), 0 4px 12px rgb(0 0 0 / 0.08);
  --shadow-lg: 0 8px 24px rgb(0 0 0 / 0.10), 0 2px 6px rgb(0 0 0 / 0.06);

  /* Motion — fast, and out of the way. */
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --dur-fast: 150ms;   /* hover, focus, small state changes */
  --dur-base: 250ms;   /* panels, menus, page transitions */

  /* Colour — semantic names, never raw hex in a component. */
  --bg: #fbfbfd;          /* not #fff */
  --surface: #ffffff;
  --surface-alt: #f4f4f7;
  --border: #e4e4e9;
  --text: #1a1a1f;        /* not #000 */
  --text-muted: #6b6b76;  /* must still hit 4.5:1 on --bg */
  --accent: #4f46e5;
  --accent-text: #ffffff;
  --success: #15803d; --warning: #b45309; --danger: #be123c;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f0f13; --surface: #17171d; --surface-alt: #1f1f27;
    --border: #2a2a34; --text: #ececf1; --text-muted: #9b9ba6;
  }
}
```

Adjust the hues to the chosen direction — keep the structure.

## Step 4 — The rules that separate good from generic

Apply these whether or not you were asked to:

1. **Never pure black or pure white** for text and background. Off-black on off-white
   reads better and looks considered.
2. **Two typefaces maximum.** One is usually right. If pairing, contrast them clearly
   (serif heading + sans body), never two similar sans-serifs.
3. **One accent colour, used sparingly.** Accent means *the primary action and nothing
   else*. If everything is coloured, nothing stands out.
4. **Whitespace is the cheapest quality signal there is.** When a layout looks wrong,
   the answer is usually more space around things, not more decoration.
5. **Body text capped at ~65 characters per line.** Full-width paragraphs look unread
   because they are unreadable.
6. **Align to a grid.** Things that nearly line up look like mistakes. Either align
   them or separate them clearly.
7. **Consistent radius.** A 4px input next to a 16px card is the single most common
   tell of an unplanned interface.
8. **Contrast: 4.5:1 for body text, 3:1 for large text and UI borders.** Check it,
   do not estimate it. Light grey on white fails almost every time.
9. **Every interactive element needs five states**: rest, hover, `:focus-visible`,
   active, disabled. Never remove focus outlines — restyle them.
10. **Every data view needs four states**: loading, empty, error, populated. An empty
    state saying "Nothing here yet" plus the action to fix it is worth more than any
    animation.
11. **Motion is under 250ms and never blocks.** Respect
    `@media (prefers-reduced-motion: reduce)`.
12. **Real content, never lorem ipsum.** Plausible names, real-length text, a real
    number of items. Fake content hides real layout problems.

## Step 5 — Prove it

After applying tokens, screenshot the result at 390, 768 and 1440 and look at it:

```bash
node "$HOME/.claude/tools/shot.mjs" http://localhost:5173 --out ./.shots
```

Then Read the PNGs. Fix what actually looks wrong. Do not report the work as done
on the basis of the code alone. See the `design-review` skill for the checklist.

## Scope

Set up the foundation and apply it to what exists. Do not redesign screens the user
did not ask about, and do not rewrite working components just to move them onto
tokens — convert them as you touch them.
