# Two prompts to paste

Copy-paste prompts that use the harness. Both rely on the `lawyer` skill (`skills/lawyer/`).

## Prompt 1 — paste at the start of every project (short)

```
Before you start: check git remote, read CLAUDE.md, and run the lawyer skill (start-of-project version).
If the skill doesn't exist on this machine, create it first (ask me to approve).
Then work in short steps. After each step: tests, lint, a security check, one commit.
Keep the report to short bullets with a TL;DR on top.
Put what I must do (keys, accounts, decisions) in a separate list.
```

## Prompt 2 — run the skill on a project

```
Run the lawyer skill on this project.
1. List every piece of personal data the app collects, stores or sends out.
2. Check where it goes: browser storage, database, AI API, analytics.
3. Check privacy settings: delete data, export data, consent, logging.
4. Write or update the Privacy Policy and Terms from what the code really does.
5. Report short bullets: what's fine, what's wrong, what I must do.
Don't promise anything the code doesn't do.
```

## Good to know

- Creating the skill touches `~/.claude/skills/`, so the config-protection hook asks you to approve it. That is expected.
- The skill is US-focused and writes a first draft. It is **not legal advice**; for payments, health, school records, children or many users, have a real lawyer read the pages before launch.
- Install the skill with the rest of the harness: `node install.mjs --apply --skills all` (the installer previews first and changes nothing without `--apply`).
