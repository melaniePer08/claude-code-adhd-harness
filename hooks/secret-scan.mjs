#!/usr/bin/env node
// Bash|PowerShell, PreToolUse + PostToolUse: keep secrets out of git.
//
//   before `git commit` : scan what is about to be committed  -> deny
//   before `git push`   : scan every unpushed commit          -> deny
//   after  `git commit` : scan the commit that was just made  -> tell Claude to undo it
//
// Findings are reported with the secret itself masked.

import path from 'node:path';
import { readInput, deny, out, git, repoRoot, unpushed, scanDiff, scanFile, describeFindings, logMistake, stripNoise, commandCwd, HOME } from './lib.mjs';

const FIX =
  'Fix before anything else:\n' +
  '  1. Move the real value out of the file (use `process.env.NAME` / a config lookup instead).\n' +
  '  2. Put only the NAME with a placeholder value in `.env.example`, and the real value in the git-ignored secrets file.\n' +
  '  3. Make sure the secrets file is listed in `.gitignore`.\n' +
  'If this is genuinely a fake or sample value, add `# secret-scan: allow` on that line and say so to the user.';

function scanStaged(root) {
  return scanDiff(git(root, ['diff', '--cached', '-U0', '--no-color']) || '');
}

function scanWorkingTree(root, clean) {
  const findings = [];
  const addsEverything = /\bgit\s+add\b[^;&|\n]*(?:\s-A\b|\s--all\b|\s\.(?:\s|$))/.test(clean) || /\bcommit\b[^;&|\n]*\s-[a-zA-Z]*a/.test(clean);
  if (addsEverything) {
    findings.push(...scanDiff(git(root, ['diff', '-U0', '--no-color']) || ''));
    const others = (git(root, ['ls-files', '--others', '--exclude-standard', '-z']) || '').split('\0').filter(Boolean);
    for (const rel of others.slice(0, 200)) {
      findings.push(...scanFile(path.join(root, rel), rel));
      if (findings.length >= 25) break;
    }
    return findings;
  }
  const m = /\bgit\s+add\b([^;&|\n]*)/.exec(clean);
  if (!m) return findings;
  for (const raw of m[1].split(/\s+/).filter((t) => t && !t.startsWith('-')).slice(0, 50)) {
    const rel = raw.replace(/^["']|["']$/g, '');
    findings.push(...scanFile(path.resolve(root, rel), rel));
    if (findings.length >= 25) break;
  }
  return findings;
}

function scanUnpushed(root) {
  const u = unpushed(root);
  if (!u || !u.range || !u.count) return [];
  return scanDiff(git(root, ['log', '-p', '-U0', '--no-color', '--format=', ...u.range]) || '');
}

const input = await readInput();
const cmd = input?.tool_input?.command;
if (typeof cmd !== 'string' || !cmd.trim()) process.exit(0);

const clean = stripNoise(cmd);
const isCommit = /\bgit\b[^;&|\n]*\bcommit\b/.test(clean);
const isPush = /\bgit\b[^;&|\n]*\bpush\b/.test(clean);
if (!isCommit && !isPush) process.exit(0);

const root = repoRoot(commandCwd(clean, input.cwd || HOME));
if (!root) process.exit(0);

if (input.hook_event_name === 'PreToolUse') {
  const findings = [];
  if (isCommit) {
    findings.push(...scanStaged(root));
    if (findings.length < 25) findings.push(...scanWorkingTree(root, clean));
  }
  if (isPush && findings.length < 25) findings.push(...scanUnpushed(root));
  if (findings.length) {
    logMistake('secret scanner blocked a commit or push that contained a secret', input?.cwd);
    deny(`Blocked: this would put secrets into git.\n${describeFindings(findings)}\n\n${FIX}`);
  }
  process.exit(0);
}

// PostToolUse — the commit already happened, so it has to be undone before it can be pushed.
if (isCommit) {
  const findings = scanDiff(git(root, ['show', 'HEAD', '-U0', '--no-color', '--format=']) || '');
  if (findings.length) {
    logMistake('secret scanner: a commit contained a secret and had to be undone', input?.cwd);
    out({
      decision: 'block',
      reason:
        `The commit you just made contains what looks like a secret:\n${describeFindings(findings)}\n\n` +
        'Undo it before anything else: `git reset --soft HEAD~1`, then unstage the file (`git restore --staged <file>`). ' +
        `Auto-push is blocked while these commits exist.\n\n${FIX}`,
      systemMessage: 'Secret scanner: the last commit looks like it contains a secret. Claude has been told to undo it.',
    });
  }
}
process.exit(0);
