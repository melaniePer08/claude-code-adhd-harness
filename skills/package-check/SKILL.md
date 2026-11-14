---
name: package-check
description: Check a package (library) is safe and allowed BEFORE suggesting or installing it — official name (no typo look-alike), downloads, release age against PACKAGE_WAIT_DAYS, real source repo, install scripts, known vulnerabilities, licence (commercial use, credit). Use every time a new dependency or a version update is about to be proposed; also for fonts, icons, images and copied code (licence part).
---

# Package check

Rules this follows: 2.3a (verified, still ask), 6.4a (`PACKAGE_WAIT_DAYS`), 6.6 (licences + `CREDITS.md`), 6.1 (risky packages), 2.1 (explain commands), `PACKAGE_WAIT_DAYS` in `harness-settings.md`.

Attackers publish fake, typo-named and hijacked packages that steal keys and passwords, and even popular ones get taken over. A package that is good saves real work — so check, tell the user what you found, **ask, then install**. Never install without a yes (rule 2.3).

All checks below only **read** public information (`npm view`, the registry web API, the repo page). They install nothing and run no package code.

## Step 0 — Do you need it?

Can the standard library or a package **already in the project** do this? (search first, rule 5.1) Fewer dependencies = less risk. Say so if so.

## Step 1 — Identify the exact package

- Official name and spelling: `lodash` not `lodahs`, `@scope/name` is the real scope. Compare with the project's own docs/README link. Watch for look-alikes (`expresss`, `react-dom-utils`), swapped letters, extra suffixes.
- Ecosystem: npm / PyPI / crates / Go / etc. The commands below use npm; use the equivalent for others (`pip index versions`, `cargo info`, `pkg.go.dev`).

## Step 2 — Gather facts

For npm (Windows-friendly, each is read-only):

```bash
npm view <pkg> name version license repository.url homepage maintainers --json
npm view <pkg> time --json            # release dates for every version
npm view <pkg> dist-tags
npm view <pkg>@<version> scripts --json   # install scripts: preinstall / install / postinstall
npm view <pkg>@<version> dependencies --json
```
Downloads: `https://api.npmjs.org/downloads/point/last-week/<pkg>`.

Check:

| Check | Good | Warning sign |
|---|---|---|
| **Name** | exactly the documented name | one letter off, odd scope |
| **Downloads** | thousands+/week for a common need | near-zero for something "popular" |
| **Age of the version** | released **more than `PACKAGE_WAIT_DAYS` days ago** (default 7) | newer → use the previous version |
| **History** | several versions over time, active maintainers | brand-new package, one version, sudden new owner |
| **Source repo** | `repository.url` points to a real repo with matching name, stars, recent commits | none, or repo doesn't match the package |
| **Install scripts** | none (`preinstall`/`install`/`postinstall` absent) | scripts that download/run something — **read them**, or avoid |
| **Dependencies** | few, well known | many unknown ones for a tiny job |
| **Vulnerabilities** | none known; `npm audit` clean after adding | high/critical |
| **Licence** | see Step 3 | none / unclear |
| **Maintenance** | updated within the last year, or "finished" small utility | abandoned and has open security issues |

**Version age (rule 6.4a):** compute the release date of the version you'd install from `time`. If it's newer than `PACKAGE_WAIT_DAYS`, pick the newest version that is older and say so: "`axios` 1.8.0 is 2 days old — too new. Using 1.7.9 (5 weeks). I'll suggest 1.8.0 again next week." Only exception: a fix for a hole being attacked right now — explain the risk both ways and ask.

**Built-in age gate (better):** with the user's yes (config change), set the package manager's own minimum release age — npm `min-release-age=7` in `.npmrc` (days, npm ≥ 11.10), pnpm `minimumReleaseAge=10080` (minutes, ≥ 10.16), Yarn `npmMinimalAgeGate: 7d` (≥ 4.10), Bun `install.minimumReleaseAge = 604800` (seconds, ≥ 1.3). Check the installed version supports it first (`npm -v`, …). Units differ — double-check.

## Step 3 — Licence (rule 6.6)

Ask **once per project**: "Will this project ever be sold or used for business?" Save the answer in the project notes.

- **Permissive** (MIT, ISC, BSD, Apache-2.0): commercial use OK; credit needed → add to `CREDITS.md` (name, author, licence, link) **automatically**.
- **Credit-required content licences** (CC-BY): add to `CREDITS.md`.
- **Share-alike / copyleft** (GPL, AGPL, LGPL, CC-BY-SA): **warn first** — can force parts of your project to be open-source. Fine for tools you only *run*; careful when linking or copying code.
- **No licence / "all rights reserved" / unclear:** don't use it; suggest an alternative.
- **Non-commercial only (CC-BY-NC, some free tiers):** not for a commercial project.
Same check for **fonts, icon sets, images, copied code snippets**.

## Step 4 — Tell the user, then ask

Short, plain, with the evidence (rule 2.3a):

```
I'd like `zod` (input-checking library, ~30M downloads/week).
✅ Official name · ✅ version 3.23.8 released 5 weeks ago (limit: 7 days) · ✅ no install scripts
✅ source: github.com/colinhacks/zod, active · ✅ MIT licence (commercial use OK; credit added to CREDITS.md)
✅ no known vulnerabilities · It won't see your keys.
Install command: `npm install zod@3.23.8` — adds one folder to node_modules and two lines to package.json
and package-lock.json. Undo: `npm uninstall zod`. OK to install?
```

Explain the install command part by part (`explain-command`). **Ask again before any package is given access to API keys or passwords** (rule 2.3a). Then wait.

## Step 5 — After install

- Run the project's tests and `npm audit`; report.
- Add `CREDITS.md` line if needed. Commit `package.json` + lockfile together.
- The dependency-check hook will also report known-vulnerable packages — tell the user, **never run an automatic fix** or upgrade on your own (rule 6.4).

## Never
- Never install, run `npm install`, `pip install`, or execute package code to "inspect" it.
- Never pick a package only because it came first in a search.
- Never install a version newer than `PACKAGE_WAIT_DAYS`.
