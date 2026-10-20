# Design rules (read only for interface work)

Visual quality is part of "done" — not something the user has to ask for separately.

**D.1 ⭐ Don't overdesign.**
- A clean layout with excellent spacing and typography beats a page full of gradients, glows, particles and motion.
- Every visual choice must answer: "why does this improve the experience?" No answer → leave it out.
- Why: effects added "because they look cool" make pages slower, noisier and harder to use.

**D.2 Look at it — never assume.**
- After visual changes, take screenshots at phone (390 px), tablet (768 px) and desktop (1440 px) and actually look at them (`design-review` skill, screenshot tool `tools/shot.mjs`).
- One screenshot round at the end of a batch of visual work (4.4).
- Never describe a screenshot you didn't take. Couldn't run the page → say so and say what you checked instead.
- Why: code that compiles says nothing about how it looks.

**D.3 The normal order for real design work: research → tokens → build → review.**
- `design-research`: audit what exists, name the real problem, show 2–3 directions, build one.
- `design-system`: colours, type, spacing, radius, shadow and motion set once, in one place.
- `design-review`: screenshots + checklist, fix the real problems.
- Small changes skip straight to building.
- Why: deciding the direction first avoids building something three times.

**D.4 The defaults that matter most.**
- Never pure black on pure white. One accent colour — for the main action only.
- One type scale, one spacing rhythm, one radius family. Body text ≥ 16 px, line height ≥ 1.5, lines ≤ ~65 characters.
- Contrast measured, not guessed: 4.5:1 for body text, 3:1 for large text and borders.
- When something looks wrong, it usually needs more space, not more styling.
- Every interactive element: hover, `:focus-visible`, active and disabled states. Never delete a focus outline — restyle it.
- Every data view: loading, empty and error states, not only the happy path.
- Real content, never lorem ipsum (9.6). Colour-blind safe (9.7).
- Check 390 px width before calling it done — that's where layouts break.

**D.5 The product decides the style.**
- Art / portfolio → expressive, image-led. Business / SaaS → clear, trustworthy. Creative tools → usable with personality. Games → playful, animated.
- Why: one style forced on every project makes them all look the same — and often wrong.

**D.6 Codebase first, then outside components.**
- Reuse what the project already has. Prefer one well-known component source over many. Read community code before using it.
- No big new library for a small effect (2.3a still applies).

**D.7 Animation must say something.**
- Good reasons: showing a change, confirming an action, guiding attention. Short (under ~250 ms), never blocking, and respect "reduce motion".
- Bad reasons: it looked cool, the page felt empty.

**D.8 Design files (Figma) → build from the real numbers (`figma-to-code` skill).**
- Read the design's exact sizes, spacing, colours and fonts instead of guessing from a picture. Then screenshot the build and compare.
- The Figma token is a secret: it lives in `.env`, filled in by the user (section 7).

**D.9 Inspiration, never copying.**
- Learn from other sites' ideas and patterns. Never copy their branding, logos, artwork or code without a licence that allows it (6.6).
