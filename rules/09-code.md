# 9. How to work on code

**9.1 Understand before changing.** Look at how the project works first.

**9.2 Respect the existing code — and everyone writes in ONE style.**
- Don't rewrite things just to match your own style.
- `PROJECT_MAP.md` has a short section **"How code is written here"** with 3–5 tiny real examples (naming, file layout, how errors are handled). The first agent (or Claude, when working alone) writes it; it's updated when the style changes.
- Every agent reads that section before writing, and matches it. It's part of every agent brief (3.6).
- Why: agents that each write their own way make a project messy and hard to fix. One shared example page is cheap and keeps them consistent.

**9.3 Debug properly — pick the right method for the problem (`debug` skill).**
- **One clear error, and you can see where** → read the real error → find the cause → fix → re-test. Fastest and cheapest.
- **"It worked before, now it's broken" / errors everywhere** → first find the change that started it (8.5a). Many errors usually come from one change. Then debug that change properly.
- **New code that never worked** → normal debugging (going back in history won't help).
- Never random changes "to see if it helps".
- Why: going back through history is great for "it used to work"; reading the error is faster for everything else. Using the right one saves time and tokens.

**9.4 ⭐ TOP RULE: Never hide errors, never weaken tests, never cover up a problem.** (hook: finish check)
- No deleting or skipping tests, no catching errors and ignoring them, no "it works" when it doesn't.
- Why: a hidden problem is worse than a visible one — it breaks later, in front of real users, when it's harder to find.

**9.4a Big features: one verifier agent writes the tests AND checks the task is really done (`verify` skill).**
- The agent that wrote the code tends to write easy tests its own code passes. The **verifier** is a different agent: it reads the code and tries to **break** it — wrong input, empty fields, huge values, attacks.
- It also compares the result with the original request: was everything asked for actually built?
- Tests go in separate test files. Important places in the code also get built-in checks (for example: "this price can never be negative") so problems show up right away.
- Small fixes: no extra agent — Claude writes the test itself, with the same "try to break it" mindset.
- Why: tests that really push the code make the app much harder to break. One agent doing both jobs (tests + check) keeps the agent count low.

**9.5 "Done" needs proof — never just a claim.**
- Every "done" or "fixed" comes with evidence: which test ran, its result, what was checked by hand.
- **Security fixes:** write a test that performs the attack, show it worked before the fix and is blocked after.
- Run the checks that match the task: small fix → the project's tests. Big feature → verifier + review (`code-review`, scaled to how much code changed) + security check.
- Why: the user doesn't have time to read all the code to check. Claude can be wrong while sounding sure — proof makes that visible.
- Example: "🔒 Fixed: anyone could see other users' orders. Proof: test `orders-access` tries to open order #5 as user B — before: allowed ❌, now: blocked ✅."

**9.6 Real content, never "lorem ipsum".**
- "Lorem ipsum" is fake Latin filler text ("Lorem ipsum dolor sit amet…") that designers drop in as a placeholder.
- Use real (or realistic) text instead: real names, real lengths, real headlines.
- Why: fake text hides real problems — a real title might be twice as long and break the layout.

**9.7 Accessibility: everyone must be able to read and use the app.**
- Readable text: strong contrast, big enough size.
- Colour-blind safe: never use colour alone (red/green) to show meaning — add an icon or a word too.
- Works with a keyboard, visible focus, alt text on images.
- **Exception:** art sites and some games, where the art itself can't meet every rule — still do everything that doesn't change the art (readable menus, text, buttons).
- Why: many people can't see some colours or read small, low-contrast text. Tools like writing apps must work for all of them.

**9.8 Visual work:** follow `rules/design-rules.md`.
