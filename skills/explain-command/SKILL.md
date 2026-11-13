---
name: explain-command
description: Explain a shell command part by part, in plain language, BEFORE the user is asked to approve it. Use every time a command needs approval (permission prompt, hook confirmation, anything destructive, outward-facing, or unfamiliar), including ones already explained earlier in the session.
---

# Explain command

Rules this follows: 2.1 (explain before approving), 2.3 (always-ask list). The user should make a real decision, not click "yes" on trust.

**Write the explanation in the message BEFORE the command runs.** Once the permission prompt is on screen it is too late.

## The format

1. Show the command in a code block.
2. Go through it **in order, one short line per part**.
3. Finish with one line: what changes on the computer if the user says yes.
4. If only part of it is risky, say so and offer to run only the safe part.

### What every line must cover

- **Joined commands** (`&&`, `;`, `|`, `||`): each piece is a separate action — explain each one separately.
- **Flags**: say what each one does. Never leave `-rf`, `--force`, `-i`, `--hard`, `-y`, `-g` unexplained.
- **Exact targets**: the real file, folder, branch, URL or package name — never "some files".
- **Effect**: say plainly what is **created, changed, deleted, overwritten, or sent off this computer**.
- **Irreversible parts**: say which, and what would be lost if it goes wrong.
- **Jargon**: translate it in the same line ("staged = chosen to be included in the next save", "HEAD = the commit you're on now", "upstream = the copy on GitHub", "piped = the output of the left command is fed into the right one").
- **Why it is (or isn't) safe**: never write "safe" without the reason.

If you are not sure what a command does, **say that** instead of guessing. Accuracy beats sounding confident. Run `--help` or read the script first if that settles it.

## Rules about the command itself

- Never rephrase or split a command to avoid a permission prompt or a hook. The prompt exists so the user can decide (rule 2.8).
- A second time in the same session, a shorter explanation is fine — but never silent.
- Commands that send something off the computer (upload, deploy, API call, `git push` to somewhere new): name where it goes and what exactly is sent.
- Commands that touch money, a database, or files outside the project: say so first, in the first line.

## Template

````
`<full command>`

- `<part 1>` — <what it does, in plain words>
- `<part 2>` — <…>
- `<flag>` — <what the flag changes>
- Target: `<exact path / branch / URL>`
- ⚠️ Irreversible: <what can't be undone> (or: nothing — everything here can be undone by …)

**If you say yes:** <one line — what changes on your computer>
````

## Examples

**Push to GitHub**

`git push origin main`

- `git push` — uploads your saved commits (snapshots of your work) to GitHub.
- `origin` — the nickname for your GitHub repo (`https://github.com/melaniePer08/claude-code-adhd-harness`).
- `main` — the branch being uploaded.
- Nothing is deleted or overwritten; GitHub just gets the commits it doesn't have yet.

**If you say yes:** your 3 unpushed commits appear on GitHub. Nothing on your computer changes.

**Delete a folder (risky — be loud about it)**

`rm -rf ./dist && npm run build`

- `rm` — deletes files.
- `-r` — also go inside folders. `-f` — don't ask, and ignore files that don't exist.
- `./dist` — the `dist` folder inside this project (the old build output).
- ⚠️ Irreversible: it does not go to the recycle bin. `dist` is generated, so it can be rebuilt, which is why this is low-risk here.
- `&&` — only continue if the delete worked.
- `npm run build` — runs the project's own build script from `package.json`; recreates `dist`.

**If you say yes:** `dist` is deleted and rebuilt from your source. Source files are untouched.

**Install a package (needs a yes + `package-check` first)**

`npm install zod`

- `npm install` — downloads a package from the public npm registry (internet) and puts it in `node_modules`.
- `zod` — a small input-checking library; see the package check result for its age, downloads, licence and install scripts.
- Changes: `package.json` and `package-lock.json` get a new line; `node_modules/` gets a new folder.
- Runs no install script (checked) — so it cannot run code on install.

**If you say yes:** one new folder and two edited files inside this project. Undo with `npm uninstall zod`.
