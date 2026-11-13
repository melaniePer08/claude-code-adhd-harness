---
name: verify
description: The verifier — tries to BREAK new code (bad input, empty fields, huge values, attacks) and checks that what was built really matches what was asked. Use after any big feature, before merging or publishing, and whenever "done" needs proof. Small fixes get the same mindset without a separate agent.
---

# Verify

Rules this follows: 9.4a (verifier), 9.5 (done needs proof), 9.4 (**never weaken tests**), 3.4 (verifier = 1 agent, big features only), 3.5–3.7 (cheapest model, full brief, check its work), 6.5 (fake data only).

**Why a separate verifier:** the agent that wrote the code tends to write easy tests its own code passes. The verifier reads the code with one goal: **break it**. It also asks the other question: *did we build what was asked?*

## Step 1 — Choose the size

| Change | How |
|---|---|
| **Small fix / small change** | **No agent.** You write the test yourself, with the break-it mindset (Step 3). |
| **Big feature** (new area, many files, anything with logins, money, uploads, personal data) | **One verifier agent**, listed in the start card (rule 3.1). Sonnet usually — it writes tests. |

## Step 2 — Brief the verifier (big features)

Every agent brief includes (rule 3.6):
- **Job:** read the feature's code and the original request; write break-it tests; run them; report.
- **Done when:** every requirement is marked ✅/❌/⚠️ with evidence, and the tests have run.
- **Limits:** 20 minutes, report under 40 lines.
- **Read-only except `tests/`** (or the project's test folder) and `docs/verify-report.md`. It must **not edit the code it is testing** — it reports problems, someone else fixes them.
- Read `PROJECT_MAP.md` → "How code is written here" and match the test style.
- The original request, copied exactly (not your summary of it).
- Fake data only, never real people's data (rule 6.5). No keys, no `.env`.
- Short bullet report first, details after.

## Step 3 — The break-it checklist

For each thing the feature accepts or does, try:
- **Empty / missing:** empty string, `null`, missing field, empty list, no file.
- **Wrong type or format:** text where a number goes, negative numbers, `0`, decimals, emoji, very long text (10,000 chars), unusual characters (`'` `"` `<script>` `../`), different languages, spaces only.
- **Limits:** the biggest and smallest allowed value, one past each limit, huge numbers.
- **Order and repetition:** double-click / submit twice, steps out of order, refresh in the middle, two users at once.
- **Access:** can user B read, change or delete user A's data? Not logged in? Logged in as a normal user doing an admin action? (rule 6.1)
- **Money:** can the price, quantity or total come from the browser? Negative quantity? Rounding?
- **Failure:** the network is down, the database is empty, the service returns an error. Does the user see a clear message, and is nothing half-saved?
- **Security basics:** injection in every input, XSS in anything displayed, upload of the wrong type or size, URLs the server would fetch (rule 6.1).
- **Old behaviour:** run the project's existing tests — did anything that worked break?

Put important invariants into the code as **built-in checks** too ("a price can never be negative", "an order always has an owner") so problems show up immediately, not later.

## Step 4 — Compare with the request

Make a table, one row per thing asked for:

| Requirement (from the request) | Built? | Evidence |
|---|---|---|
| "Show the total on the Pay button" | ✅ | `checkout.test.js › shows total`, screenshot |
| "Works on phones" | ⚠️ | checked 390 px; tablet not tested |
| "Send a confirmation email" | ❌ | not implemented |

Anything the user asked for that is missing is a finding, as serious as a bug. Anything built that wasn't asked for is noted too (rule 5.5).

## Step 5 — Run it and report

1. Run the new tests and the project's whole suite (plus type check / build, whichever exist).
2. Report **honestly** — rule 1.6:
   ```
   ✅ 14 tests pass, 3 new bugs found by the break-it tests:
   ❌ Quantity -5 gives a negative total (cart.js:41)
   ❌ Whole-number price field accepts "1e9"
   ⚠️ Not tested: email sending (no mail server here)
   ```
3. Findings go to whoever wrote the code; after fixes, **re-run** the verifier's tests.

## Step 6 — Check the verifier yourself (rule 3.7)

Before reporting done: spot-check 2–3 of its claims (run a failing test, read one test to see it really asserts something). Reject tests that always pass, that assert nothing, or that mock away the thing being tested.

## Never
- **Never weaken, skip, delete or loosen a test to make it pass** (rule 9.4, the finish check hook enforces this). If a test is genuinely wrong, say so and explain before changing it.
- Never claim "verified" for something that wasn't run. Say "untested: X, because Y".
- Never use real personal data in tests; delete test data afterwards.
- Security fixes: the proof is a test that **performs the attack** — allowed ❌ before the fix, blocked ✅ after.
