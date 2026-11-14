#!/usr/bin/env node
// PostToolUse (Bash|PowerShell): after a commit, push once 5 commits have piled up.
// Refuses to push commits that look like they contain secrets.

import { execFileSync } from 'node:child_process';
import { readInput, out, git, repoRoot, unpushed, gitBusy, scanDiff, describeFindings, stripNoise, commandCwd, maskRemote, diffSize, harnessNumber, HOME } from './lib.mjs';

// Rule 8.4: a small single fix is pushed right away; bigger work is pushed in batches.
// PUSH_EVERY (harness-settings.md) is the batch size, default 5. A "small fix" is one unpushed
// commit whose message starts with fix/typo/docs and that touches at most 3 files and 40 lines.
const THRESHOLD = harnessNumber('PUSH_EVERY', 5);
const SMALL_FIX_FILES = 3;
const SMALL_FIX_LINES = 40;
const SMALL_FIX_MSG = /^(?:fix|typo|docs?)\b/i;

function isSmallFix(root, u) {
  if (u.count !== 1) return false;
  const subject = (git(root, ['log', '-1', '--format=%s']) || '').trim();
  if (!SMALL_FIX_MSG.test(subject)) return false;
  const size = diffSize(root, ['HEAD~1', 'HEAD']);
  return !!size && size.files <= SMALL_FIX_FILES && size.lines <= SMALL_FIX_LINES;
}

function push(root, u) {
  const args = u.upstream ? ['push'] : ['push', '-u', 'origin', u.branch];
  try {
    const stdout = execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 100000,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return { ok: true, text: maskRemote(String(stdout || '')).trim() };
  } catch (e) {
    const text = [e?.stderr, e?.stdout, e?.message].filter(Boolean).join('\n');
    return { ok: false, text: maskRemote(String(text)).trim().slice(-700) };
  }
}

const input = await readInput();
const cmd = input?.tool_input?.command;
if (typeof cmd !== 'string' || !cmd.trim()) process.exit(0);

const clean = stripNoise(cmd);
if (!/\bgit\b[^;&|\n]*\bcommit\b/.test(clean)) process.exit(0);

const root = repoRoot(commandCwd(clean, input.cwd || HOME));
if (!root || gitBusy(root)) process.exit(0);

const u = unpushed(root);
if (!u || !u.range || u.count < 1) process.exit(0);
if (u.count < THRESHOLD && !isSmallFix(root, u)) process.exit(0);

const findings = scanDiff(git(root, ['log', '-p', '-U0', '--no-color', '--format=', ...u.range]) || '');
if (findings.length) {
  out({
    systemMessage: `Auto-push skipped: ${u.count} unpushed commits look like they contain a secret.`,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext:
        `Auto-push was skipped: the ${u.count} unpushed commits contain what looks like a secret.\n${describeFindings(findings)}\n` +
        'Remove it from those commits before anything is pushed, and tell the user what you found.',
    },
  });
  process.exit(0);
}

const target = u.upstream || `origin/${u.branch}`;
const res = push(root, u);
if (res.ok) {
  out({
    systemMessage: `Auto-pushed ${u.count} commits to ${target}.`,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `Auto-push: ${u.count} commits pushed to ${target}. Nothing is left unpushed in ${root}.`,
    },
  });
} else {
  out({
    systemMessage: `Auto-push to ${target} failed.`,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext:
        `Auto-push of ${u.count} commits to ${target} failed:\n${res.text}\n\n` +
        'Tell the user this error and what it needs (for example `gh auth login` when GitHub credentials are missing). Do not force-push.',
    },
  });
}
process.exit(0);
