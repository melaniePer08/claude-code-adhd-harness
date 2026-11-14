---
name: figma-to-code
description: Build an interface from a Figma design using its exact measurements (sizes, spacing, colours, fonts) instead of guessing from a picture, then compare the screenshot of the build with the Figma export. Use when the user shares a Figma link or says "build this design", "match the Figma", or "make it look like my design".
---

# Figma to code

Rules this follows: `rules/design-rules.md`, 7 (the Figma token is a secret — never read `.env`), 9.7 (accessibility), 4.4 (one screenshot round), 5.3 (project map), `design-system` / `design-review` skills, section 26 of the user's global instructions (the `figma.mjs` tool).

**Never guess a design.** Read it. Build from the numbers, then look at your result next to the original.

The harness has its own read-only reader: `tools/figma.mjs` (installed at `~/.claude/tools/figma.mjs`). It needs a Figma personal access token in `FIGMA_TOKEN` or `~/.claude/.env`. **You never open that file.** If the tool says the token is missing, tell the user (they create it: Figma → Settings → Security → Personal access tokens, then paste it into their own `.env`) — don't work around it.

## Step 1 — See what exists, agree the list

```bash
node ~/.claude/tools/figma.mjs pages <figma-url>
```
Shows every page and frame. **Agree the list of screens with the user** before building: "I see Home, About, Contact (mobile + desktop). Build all, or start with Home?" Ask once (rule 1.4).

## Step 2 — Set up the tokens once

```bash
node ~/.claude/tools/figma.mjs tokens <figma-url>
```
Gives the palette and type scale the designer actually used. Feed it into the project's tokens using the `design-system` skill (CSS variables / theme file / `tailwind.config`, whatever the project uses).
- **Never replace an existing design system** — extend it and fill the gaps.
- Name tokens by role (`--color-accent`, `--space-4`), not by value.
- Note any value that fails contrast (4.5:1 body, 3:1 large/borders) and tell the user; don't silently change the design — offer the nearest accessible value.

## Step 3 — Per screen: measure and look

```bash
node ~/.claude/tools/figma.mjs spec   <figma-url> --frame "Home"   # sizes, spacing, colours, fonts
node ~/.claude/tools/figma.mjs export <figma-url> --frame "Home"   # PNGs to look at
```
- **Read the PNG** (the Read tool shows images) to understand the layout and intent.
- Use the **spec numbers** for exact sizes, spacing, radius, colours, font sizes/weights — not estimates from the picture.
- Frames are fixed sizes; the real page must **respond**. Decide breakpoints from the frames given (e.g. a 390 and a 1440 frame → fluid between them) and say how you'll handle sizes in between.
- Images/icons: export what's needed, or use the project's icon set; check licences (`package-check`, rule 6.6).

## Step 4 — Build

- Match the project's stack and style (`PROJECT_MAP.md` → "How code is written here").
- Real content from the design — never lorem ipsum (rule 9.6).
- Every interactive element: hover, `:focus-visible`, active, disabled. Data views: loading, empty, error states — even if the design only shows the happy path (tell the user what you added).
- Semantic HTML, alt text, keyboard use, visible focus (rule 9.7).
- Don't "improve" the design. If something looks wrong (low contrast, cramped), **flag it**, build what's designed unless it breaks accessibility, and ask.

## Step 5 — Compare (one screenshot round, rule 4.4)

```bash
node ~/.claude/tools/shot.mjs http://localhost:5173 --out ./.shots
```
Read your PNGs and the Figma export. Compare: spacing, alignment, sizes, colours, font weight, line length, how it behaves at 390 px. List differences honestly:

```
Home — matches the design except: hero heading is 4 px smaller on tablet (fluid size),
footer links use 14 px/1.4 in Figma (I used 16/1.5 for readability — OK?).
```
Fix real differences, take **one** more screenshot round at the end. Then run `design-review` for the full checklist when the page is substantial.

## Step 6 — Wrap up
- Delete `.shots/` and the temp export folder (`cleanup`).
- Commit one finished screen per commit (a screen with all its parts, rule 8.2).
- Update `PROJECT_MAP.md` rows for the new files.
- Report what matches, what differs and why, and what you could not check.

## Never
- Never read `~/.claude/.env` or print the Figma token.
- Never claim "pixel perfect" without comparing screenshots.
- Never build from a screenshot alone when `spec` is available.
