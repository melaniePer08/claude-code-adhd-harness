# Resources — good tools by topic

Claude reads this when a task fits a topic and suggests 1–2 options (`resources-finder` skill).
**Nothing here is installed without your yes** (rules 2.3, 2.3a), and every package still
goes through `package-check`: real name, age ≥ `PACKAGE_WAIT_DAYS`, licence OK.

⭐ = stars on GitHub · 🕒 = last update · Numbers from the GitHub API on **2026-11-15**.
Refresh the numbers any time with `node tools/refresh-resources.mjs` (a dry run until you add `--apply`); it also warns about archived or abandoned projects.

> **Licence notes:** ⚠️ *copyleft* licences (GPL, AGPL, LGPL, CC-BY-SA) can add duties when you
> copy or ship their code — fine for tools you only *run*, check first before copying their code (rule 6.6).

<!-- RESOURCES:START -->

## 🎨 Design — components and design systems

| Project | What it does | Licence | ⭐ | 🕒 |
|---|---|---|---|---|
| [shadcn/ui](https://github.com/shadcn-ui/ui) | Accessible React components you copy into your project and own | MIT | ~128k | Nov 2026 |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | Style with small utility classes instead of writing CSS files | MIT | ~99k | Nov 2026 |
| [Radix Primitives](https://github.com/radix-ui/primitives) | Unstyled, accessible building blocks (menus, dialogs, tabs) | MIT | ~20k | Oct 2026 |
| [daisyUI](https://github.com/saadeghi/daisyui) | Ready-made Tailwind components and themes | MIT | ~43k | Nov 2026 |
| [MUI](https://github.com/mui/material-ui) | Complete Material Design component library for React | MIT | ~99k | Nov 2026 |
| [Storybook](https://github.com/storybookjs/storybook) | Build and preview each component on its own, outside the app | MIT | ~92k | Nov 2026 |

More design sources (inspiration sites, animation, fonts, colour) are in `skills/design-research/references/sources.md`.

## 🛡️ Security — checklists and scanners

| Project | What it does | Licence | ⭐ | 🕒 |
|---|---|---|---|---|
| [OWASP Cheat Sheet Series](https://github.com/OWASP/CheatSheetSeries) | Short, trusted guides for writing secure code (login, uploads, input…) | CC-BY-SA-4.0 ⚠️ | ~34k | Nov 2026 |
| [OWASP ASVS](https://github.com/OWASP/ASVS) | A checklist of what a secure web app must do | CC-BY-SA-4.0 ⚠️ | ~3.8k | Nov 2026 |
| [Gitleaks](https://github.com/gitleaks/gitleaks) | Finds keys and passwords in your code and git history | MIT | ~31k | Oct 2026 |
| [TruffleHog](https://github.com/trufflesecurity/trufflehog) | Finds leaked secrets and checks if they still work | AGPL-3.0 ⚠️ | ~29k | Nov 2026 |
| [Semgrep](https://github.com/semgrep/semgrep) | Scans code for security bugs using rules | LGPL-2.1 ⚠️ | ~18k | Nov 2026 |
| [Trivy](https://github.com/aquasecurity/trivy) | Scans packages, containers and config for known vulnerabilities | Apache-2.0 | ~39k | Nov 2026 |

## ✨ Better code — formatters and linters

| Project | What it does | Licence | ⭐ | 🕒 |
|---|---|---|---|---|
| [Prettier](https://github.com/prettier/prettier) | Formats code the same way every time | MIT | ~52k | Nov 2026 |
| [ESLint](https://github.com/eslint/eslint) | Finds bugs and bad patterns in JavaScript/TypeScript | MIT | ~28k | Nov 2026 |
| [Biome](https://github.com/biomejs/biome) | Very fast formatter + linter in one tool | Apache-2.0 / MIT | ~26k | Nov 2026 |
| [Oxc (oxlint)](https://github.com/oxc-project/oxc) | Very fast JavaScript/TypeScript linter | MIT | ~23k | Nov 2026 |
| [Ruff](https://github.com/astral-sh/ruff) | Very fast Python linter and formatter | MIT | ~51k | Nov 2026 |

## 🌿 Managing code — commits, releases, git hooks

| Project | What it does | Licence | ⭐ | 🕒 |
|---|---|---|---|---|
| [Conventional Commits](https://github.com/conventional-commits/conventionalcommits.org) | A simple standard for commit messages ("fix: …", "feat: …") | MIT | ~9.4k | Mar 2026 (stable spec) |
| [commitlint](https://github.com/conventional-changelog/commitlint) | Checks commit messages follow the standard | MIT | ~19k | Nov 2026 |
| [Changesets](https://github.com/changesets/changesets) | Version numbers and changelogs, step by step | MIT | ~13k | Nov 2026 |
| [release-please](https://github.com/googleapis/release-please) | Release notes and versions made from your commits | Apache-2.0 | ~7.8k | Nov 2026 |
| [semantic-release](https://github.com/semantic-release/semantic-release) | Fully automatic versioning and publishing | MIT | ~24k | Nov 2026 |
| [Lefthook](https://github.com/evilmartians/lefthook) | Fast manager for git hooks (checks before commit/push) | MIT | ~9.0k | Nov 2026 |

## 🧩 Connecting design tools to a site

| Project | What it does | Licence | ⭐ | 🕒 |
|---|---|---|---|---|
| [Figma MCP server guide](https://github.com/figma/mcp-server-guide) | Official guide to letting AI agents read Figma designs | not stated | ~2.2k | Nov 2026 |
| [Figma Code Connect](https://github.com/figma/code-connect) | Links Figma components to your real code components | MIT | ~1.6k | Oct 2026 |
| [Figma-Context-MCP](https://github.com/GLips/Figma-Context-MCP) | Community tool giving AI agents Figma layout data | MIT | ~16k | Oct 2026 |
| [Style Dictionary](https://github.com/style-dictionary/style-dictionary) | Turns design tokens (colours, sizes) into CSS and app code | Apache-2.0 | ~4.9k | Nov 2026 |
| [Tokens Studio](https://github.com/tokens-studio/figma-plugin) | Manage design tokens inside Figma | MIT | ~1.6k | Nov 2026 |

This harness also has its own read-only Figma reader: `tools/figma.mjs`.

## 🤖 Claude Code ecosystem

| Project | What it does | Licence | ⭐ | 🕒 |
|---|---|---|---|---|
| [anthropics/claude-code](https://github.com/anthropics/claude-code) | Official repo: releases and issues | Anthropic terms | ~156k | Nov 2026 |
| [anthropics/skills](https://github.com/anthropics/skills) | Official example skills (skill-creator, frontend-design…) | mixed — check each | ~195k | Nov 2026 |
| [claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | Official plugin directory | Apache-2.0 | ~47k | Nov 2026 |
| [mattpocock/skills](https://github.com/mattpocock/skills) | Skills collection, incl. `grill-me` (inspiration for ours) | MIT | ~325k | Nov 2026 |
| [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | Curated list of skills, hooks and commands | custom | ~58k | Nov 2026 |
| [wshobson/agents](https://github.com/wshobson/agents) | Collection of subagents and plugins | MIT | ~43k | Nov 2026 |

<!-- RESOURCES:END -->

---

Read community skills, hooks and agents before installing — they run with your permissions
(see `DISCLAIMERS.md`). Star counts show popularity, not safety or quality.
