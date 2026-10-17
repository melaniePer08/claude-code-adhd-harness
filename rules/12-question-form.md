# 12. Owner question form (optional — used by the `owner-form` skill)

Used only when rule 1.8 applies (more than `FORM_AFTER` questions, or a visual review) and `QUESTION_FORM` allows it. Builds a small local answer form so the user never copies and pastes.

**12.1 Build it small and safe.**
- A local website on `127.0.0.1` only (never reachable from the internet), one fixed port, in one folder like `scripts/owner-form/`.
- Prefer no packages (plain Node `http`). Verified packages are OK under rule 2.3a.
- Answers save automatically while typing to ONE file: `docs/owner-answers.json` (answers + `savedAt` + `submitted`).
- Never ask for passwords or keys in the form.
- A visible **"I'm done"** button. Tell the user the URL and the one command to start it.
- When the user says "answered", read the JSON file and act on it. Never ask them to paste anything.
- Why: answering in a form is faster, nothing gets lost, and Claude gets clean answers.

**12.2 Every question is a card with:**
1. **WHERE** — a bold label naming the exact part of the product, in the user's words, plus how to get there (e.g. "Dashboard › Restore backup"). Or "Whole project". Never make the user guess.
2. **A picture** of that exact part with the area circled or highlighted. Click to enlarge. For visual questions: phone and desktop, and every language the product supports.
3. **Why I'm asking** — one plain sentence, no jargon; explain any technical word right there.
4. **Options** as buttons, each saying what happens if picked. One marked **Recommended**. Always add "I don't understand this question" and "Not sure, you decide".
5. **A free-text box** under every question — any language, any messy style is fine.
- Example card: **Checkout › Pay button** · [screenshot, button circled] · "Should the button show the total? Some shops do this so people aren't surprised." · [Show total — Recommended] [Just 'Pay'] [I don't understand] [You decide] · [text box]

**12.3 Page layout.**
- Questions that block Claude's work come first.
- Grouped by area of the project, with a progress counter ("12 of 30 answered") and a short list: decided vs. still open.
- A **"How it looks"** section: screenshots of everything new or changed since the user last looked, each with a caption.
- A final big box: "Anything else, or anything I forgot to mention?"

**12.4 Test before handing it over.**
- In a real browser: all images load, answers save and survive a reload, no sideways scrolling at 390 px width, no console errors. Delete the test answers afterwards.
- Read every question as a non-programmer who never saw the code: is it clear which part it means? If not, rewrite it.
- Why: a broken or confusing form wastes the user's time and gives Claude wrong answers.

**12.5 After the user answers.**
- Repeat the decisions back as a short list and record them in the project docs.
- "You decide" = permission to choose; say what was chosen.
- Keep the form generator in the project so the next round only needs new questions.
