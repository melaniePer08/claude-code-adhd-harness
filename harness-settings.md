# Your harness settings

This file is yours. Updates to the harness never overwrite it.
If a value is empty, Claude asks you before the first task (the `first-run-setup` skill) and saves the answer here.

| Setting | Value | Meaning |
|---|---|---|
| `PLAN` | | Your Claude plan (Pro / Max) — lower plans mean more careful token use |
| `START_RAM_GB` | 4 | Don't start heavy work with less free memory than this |
| `STOP_RAM_GB` | 3 | Stop heavy work if free memory drops below this |
| `MAX_AGENTS` | 3 | Most helper agents normally suggested for one task |
| `PLAN_FIRST` | yes | Show the start card and wait for a yes (strongly recommended) |
| `PACKAGE_WAIT_DAYS` | 7 | Never install a package version newer than this many days |
| `FORM_AFTER` | 5 | More questions than this → offer the question form |
| `QUESTION_FORM` | ask | `ask` (offer each time) / `always` / `never` — the form costs extra tokens |

## Look of the question form and report/summary pages
Asked once by `first-run-setup`, used by `owner-form` and `write-up` for every page they build.

| Setting | Value | Meaning |
|---|---|---|
| `PAGE_THEME` | | `light` / `dark` / `follow computer` |
| `PAGE_ACCENT` | | One accent colour you like (name or hex) |
| `PAGE_TEXT_SIZE` | | `normal` / `large` |
| `PAGE_DETAIL` | | `short` (bullets only) / `both` (bullets, then details) |
| `PAGE_LANGUAGE` | | Language for page text (you can still answer in any language) |
| `PAGE_EXTRAS` | | Anything else: e.g. "no emojis", "show screenshots big", "colour-blind safe colours" |
