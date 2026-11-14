#!/usr/bin/env node
// PreToolUse (Edit|Write|NotebookEdit): no file changes in a project that is not
// connected to GitHub.
//
// CLAUDE.md section 21 says to stop and ask for a repo link before changing files
// in an unconnected project. That was advice, and advice gets skipped — flowday-main
// reached 16 commits that exist nowhere but this computer. This enforces it.
//
// Escape hatch: if the user explicitly wants a project kept local, the marker file
// .git/claude-local-only turns this off for that project, permanently.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readInput, deny, isProtectedDir, existingDir, HOME } from './lib.mjs';

const MARKER = 'claude-local-only';
const PROJECT_MARKERS = [
  'package.json', 'pyproject.toml', 'requirements.txt', 'go.mod', 'Cargo.toml',
  'pom.xml', 'build.gradle', 'Gemfile', 'composer.json', 'index.html', 'src',
];

function git(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10000,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
    });
  } catch {
    return null;
  }
}

const ASK =
  'Stop and say exactly this to the user:\n' +
  '  "Before I start, please create a GitHub repo for this project and send me the link: https://github.com/new"\n\n' +
  'Do NOT create the repo yourself. Do NOT keep editing. Do NOT work around this by using Bash to write the file.\n' +
  'When they send the link: `git init -b main` if needed, `git remote add origin <link>`, commit, push, then continue.\n\n' +
  'Only if the user explicitly says they want this project kept local (not "go ahead", but actually declining GitHub) ' +
  'may you create the empty marker file `.git/claude-local-only`, which turns this check off for this project for good.';

const input = await readInput();
const ti = input?.tool_input || {};
const target = ti.file_path || ti.notebook_path;
if (!target) process.exit(0);

const cwd = input?.cwd || HOME;
const abs = path.isAbsolute(target) ? target : path.resolve(cwd, target);
const dir = existingDir(path.dirname(abs));
if (!dir) process.exit(0);

// Never police scratch space, temp files, or the user's own folders.
if (isProtectedDir(dir)) process.exit(0);
if (/[/\\](?:AppData|Temp|tmp|node_modules|\.venv|venv)[/\\]/i.test(abs)) process.exit(0);

const top = git(dir, ['rev-parse', '--show-toplevel']);

if (!top) {
  // Not a repository at all. Only speak up if this looks like a real project.
  const looksLikeProject = PROJECT_MARKERS.some((m) => fs.existsSync(path.join(dir, m)));
  if (!looksLikeProject || isProtectedDir(dir)) process.exit(0);
  deny(`This project is not a git repository and has no GitHub remote:\n  ${dir}\n\n${ASK}`);
  process.exit(0);
}

const root = path.resolve(top.trim());
if (isProtectedDir(root)) process.exit(0);

const gitDirRaw = git(root, ['rev-parse', '--absolute-git-dir']);
const gitDir = gitDirRaw ? path.resolve(gitDirRaw.trim()) : path.join(root, '.git');
if (fs.existsSync(path.join(gitDir, MARKER))) process.exit(0); // user chose local-only

const remotes = (git(root, ['remote']) || '').trim();
if (remotes) process.exit(0); // connected — carry on

const commits = (git(root, ['rev-list', '--count', 'HEAD']) || '0').trim();
const stranded = Number(commits) > 0 ? `\n${commits} commit(s) here exist only on this computer.` : '';

deny(`This project has no GitHub remote:\n  ${root}${stranded}\n\n${ASK}`);
process.exit(0);
