---
name: owner-form
description: Build a small local question form (127.0.0.1 only, no packages) so the user answers many questions, or reviews visual changes, by clicking instead of typing and pasting. Use only when rule 1.8 applies (more than FORM_AFTER questions, or a visual review) AND the QUESTION_FORM setting allows it AND the user said yes to the extra tokens. Questions that already started in the terminal stay in the terminal.
---

# Owner form

Rules this follows: 1.8 (when to offer), 12 (how to build it), 7 (never ask for secrets), 6.5 (personal data), `FORM_AFTER`, `QUESTION_FORM` and the `PAGE_*` settings in `harness-settings.md`.

The form costs extra tokens, so it is **optional**. Offer it once ("I have 9 questions. Answer here, or should I build the form?") and respect the answer. If `QUESTION_FORM = never`, stay in the terminal. If `always`, build it without asking.

## What is in this skill

```
skills/owner-form/template/
  server.mjs               plain Node server, no packages, 127.0.0.1 only, autosave
  index.html               the form page (reads questions.json, renders the cards)
  questions.example.json   the question format, with two example cards
```

You only write `questions.json` and the images. Do not rewrite the server or the page for each project — that wastes tokens and loses the security checks already built in.

## Step 1 — Set it up in the project (once)

1. Copy `server.mjs` and `index.html` to `scripts/owner-form/` in the **user's project**.
2. Create `scripts/owner-form/images/` for pictures.
3. Make sure the project's `.gitignore` contains `docs/owner-answers.json` — answers can hold personal opinions or data and don't belong on GitHub. Keep the form generator itself in the repo (rule 12.5).
4. Creating files inside the project is free (rule 2.2). Do not install anything.

## Step 2 — Write `scripts/owner-form/questions.json`

Copy the shape of `questions.example.json`. Fields per question:

| Field | Meaning |
|---|---|
| `id` | short unique name, e.g. `pay-button` (used as the key in the answers file) |
| `group` | area of the project; questions are grouped by it |
| `where` | **bold label naming the exact part, in the user's words**, with the path: "Dashboard › Restore backup" — or "Whole project" |
| `blocking` | `true` if you cannot continue without the answer; these are shown first |
| `images` | file names in `images/` — a screenshot of that exact part with the area circled or highlighted |
| `why` | one plain sentence, no jargon; explain any technical word right there |
| `question` | the actual question, one thing at a time |
| `options` | 2–4 buttons, each with a `label` and an `effect` (what happens if picked); mark exactly one `"recommended": true` |

Automatic extras per card (do not add them yourself): "I don't understand this question", "Not sure, you decide", a free-text box. Plus the final "Anything else, or anything I forgot to mention?" box and the "I'm done" button.

Top-level fields: `title`, `intro` (one or two lines), `looks` (the **How it looks** section: `{ "image", "caption" }` for everything new or changed since the user last looked), and `settings`.

`settings` comes from `harness-settings.md`:
- `PAGE_THEME` → `theme` (`light` / `dark` / `auto`)
- `PAGE_TEXT_SIZE` → `textSize` (`normal` / `large`)
- `PAGE_ACCENT` → `accent` (a `#RRGGBB` hex colour; convert a colour name to hex)
- `PAGE_LANGUAGE` → write all card text in that language
- `PAGE_EXTRAS` (e.g. "no emojis", "colour-blind safe") → follow them in the text; the page's own colours already pass contrast checks.
If a value is empty, use the defaults in the example.

### Writing good cards (rule 12.2)

- **WHERE** first. The user must never have to guess which part you mean.
- **A picture** whenever the question is about something visible. Take screenshots with `shot.mjs` (phone and desktop), circle the area, and name every language the product supports if text differs. For visual questions without a picture, say so in `why` and ask whether the user wants one.
- Write it for someone who has never seen the code. After writing, read each card once as that person: is it clear which part it means? If not, rewrite it.
- Never ask for passwords, keys or tokens in the form (rule 7). Never put real personal data from the app into a card or picture (rule 6.5) — blur or use sample data.

## Step 3 — Run and test before handing it over (rule 12.4)

1. Start it: `node scripts/owner-form/server.mjs` — as a background process you started yourself. Starting a dev-style server to check work is free (rule 2.2). Port 4173; change with `OWNER_FORM_PORT` only if busy.
2. Check it:
   - `node "C:/Users/melan/.claude/tools/shot.mjs" http://localhost:4173 --out ./.shots`, then **read the PNGs**. All images load, nothing scrolls sideways at 390 px, no console errors.
   - Click an option, type in a box, reload: answers survived (look at `docs/owner-answers.json`).
3. **Delete the test answers** (`docs/owner-answers.json`) and the `.shots` folder afterwards.
4. Tell the user the URL and the one command to start it:
   > "Form is ready: http://127.0.0.1:4173 — if it ever stops, start it with `node scripts/owner-form/server.mjs`."

Leave the server running while the user answers (it is yours, so stopping it later is free). If the user hasn't answered and the time limit from the start card ends, stop it (rule 2.6).

## Step 4 — After the user says "answered"

1. Read `docs/owner-answers.json`. Never ask the user to paste anything.
2. Check `submitted`. If `false`, some answers may still be missing — carry on with what is there and say which questions were skipped.
3. Repeat the decisions back as a short list (rule 12.5), and record them in the project docs (`PROJECT_MAP.md`, `DEVLOG.md` or wherever decisions live).
4. **"Not sure, you decide"** = permission to choose. Choose, and say what you chose and why in one line.
5. **"I don't understand"** = rewrite that one question more simply and ask it again in the terminal (one question — no need for a second form).
6. Free-text answers in any language are valid answers. Act on them.
7. Stop the form server you started. Keep `scripts/owner-form/` so the next round only needs a new `questions.json`.

## Security notes (already built into the template — do not remove)

- Listens on `127.0.0.1` only, so nothing outside this computer can reach it.
- Rejects requests whose `Host` header isn't `127.0.0.1` / `localhost` (stops DNS-rebinding tricks) and writes from other origins.
- Images are served only from `scripts/owner-form/images/`, only image file types, with path-traversal blocked.
- The page builds everything with `textContent`, never `innerHTML`, so a question containing `<script>` is shown as text, not run.
- Answers are size-limited and written to one file only.
