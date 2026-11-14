#!/usr/bin/env node
// PreToolUse (Bash|PowerShell): ask the user before destructive or outward-facing commands.
// Nothing is blocked outright — the user gets a confirmation prompt and can approve.

import path from 'node:path';
import { readInput, askUser, stripNoise, splitSegments, tokenize, toWinPath, norm, HOME, isProtectedDir, repoRoot } from './lib.mjs';

const RULES = [
  [/\bgit\b[^;&|\n]*\bpush\b[^;&|\n]*(?:--force\b|--force-with-lease\b|\s-[a-zA-Z]*f(?:\s|$)|\s\+[^\s]+:)/, 'force-push, which overwrites history already on GitHub'],
  [/\bgit\b[^;&|\n]*\bpush\b[^;&|\n]*(?:--delete\b|\s-d\s|\s:[A-Za-z0-9._\/-]+)/, 'delete a branch or tag on GitHub'],
  [/\bgit\b[^;&|\n]*\breset\b[^;&|\n]*--hard\b/, 'throw away uncommitted work (git reset --hard)'],
  [/\bgit\b[^;&|\n]*\bclean\b[^;&|\n]*\s-[a-zA-Z]*f/, 'delete untracked files (git clean -f)'],
  [/\bgit\b[^;&|\n]*\bstash\s+(?:drop|clear)\b/, 'delete stashed work'],
  [/\bgit\b[^;&|\n]*\bbranch\b[^;&|\n]*\s-D(?:\s|$)/, 'force-delete a branch'],
  [/\bgit\b[^;&|\n]*\b(?:filter-branch|filter-repo)\b/, 'rewrite the whole git history'],
  [/\bgit\b[^;&|\n]*\breflog\b[^;&|\n]*\b(?:delete|expire)\b/, 'delete the git reflog (your safety net for recovering lost commits)'],
  [/\bgh\s+repo\s+(?:delete|archive)\b/, 'delete or archive a GitHub repository'],
  [/\bgh\s+repo\s+(?:edit|create)\b[^;&|\n]*(?:--visibility\s+public|--public)\b/, 'make a GitHub repository public'],
  [/\b(?:curl|wget)\b[^;&|\n]*\|\s*(?:sudo\s+)?(?:ba|z|k)?sh\b/, 'run a script downloaded from the internet'],
  [/\b(?:iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^;&|\n]*\|\s*(?:iex|Invoke-Expression)\b/i, 'run a script downloaded from the internet'],
  [/\b(?:prisma\s+migrate\s+reset|drizzle-kit\s+drop)\b/i, 'wipe the database'],
  [/\bdrop\s+(?:database|schema|table)\b|\btruncate\s+table\b/i, 'delete database tables or data'],
  [/\b(?:npm|yarn|pnpm)\s+publish\b/, 'publish a package publicly to the npm registry'],
  [/\b(?:shutdown|Stop-Computer|Restart-Computer)\b/i, 'shut down or restart the computer'],
  [/\bformat(?:-volume)?\s+[a-zA-Z]:/i, 'format a drive'],
  [/\bgit\s+config\b[^;&|\n]*\buser\.(?:email|name)\b[^;&|\n]*--global/, 'change your global git identity'],
  [/\bshot\.mjs\b[^;&|\n]*--allow-remote\b/, 'open a website that is not on this computer in the screenshot browser'],
];

const REMOVE_VERBS = new Set(['rm', 'del', 'erase', 'rd', 'rmdir', 'unlink', 'remove-item', 'ri']);
const RECURSIVE_RE = /^(?:-[a-zA-Z]*[rR][a-zA-Z]*|--recursive|-recurse|\/s)$/;

function isFlag(t) {
  return /^-/.test(t) || /^\/[a-zA-Z]$/.test(t);
}

function resolveTarget(raw, cwd) {
  let s = String(raw).replace(/^["']|["']$/g, '');
  const bare = s.replace(/\*/g, '').replace(/[/\\]+$/, '');
  if (['', '.', '..', '~', '$HOME', '${HOME}', '$env:USERPROFILE', '%USERPROFILE%', '$PWD'].includes(bare)) return { abs: cwd, always: true };
  if (/^[a-zA-Z]:$/.test(bare) || bare === '/') return { abs: bare, always: true };
  let abs = bare;
  if (/^~[/\\]?/.test(bare)) abs = path.join(HOME, bare.slice(1));
  else if (/^\/[a-zA-Z]\//.test(bare)) abs = toWinPath(bare);
  else if (!path.isAbsolute(abs)) abs = path.resolve(cwd, bare);
  return { abs, always: false };
}

function checkRemoval(seg, cwd) {
  const tokens = tokenize(seg);
  if (!tokens.length) return null;
  let i = 0;
  if (/^(?:sudo|command|&)$/i.test(tokens[0])) i = 1;
  const verb = String(tokens[i] || '').toLowerCase().replace(/\.exe$/, '');
  if (!REMOVE_VERBS.has(verb)) return null;
  const rest = tokens.slice(i + 1);
  const recursive = rest.some((t) => RECURSIVE_RE.test(t)) || verb === 'rd' || verb === 'rmdir';
  if (!recursive) return null;

  const targets = rest.filter((t) => !isFlag(t));
  if (!targets.length) return null;
  const project = repoRoot(cwd) || cwd;
  const projectN = norm(project);
  const cwdN = norm(cwd);
  for (const t of targets) {
    const { abs, always } = resolveTarget(t, cwd);
    if (always) return `recursively delete ${t} (which resolves to your current folder or a drive root)`;
    const n = norm(abs);
    if (!n) continue;
    if (isProtectedDir(abs)) return `recursively delete ${abs}, a protected folder (home, Desktop, Documents, Downloads or a drive root)`;
    if (cwdN && (n === cwdN || cwdN.startsWith(`${n}/`))) return `recursively delete ${abs}, which contains the folder you are working in`;
    if (/\/\.git$/.test(n)) return `delete the .git folder at ${abs} — the entire history of the project`;
    if (projectN && n !== projectN && !n.startsWith(`${projectN}/`)) return `recursively delete ${abs}, which is outside the current project`;
  }
  return null;
}

const input = await readInput();
const cmd = input?.tool_input?.command;
if (typeof cmd !== 'string' || !cmd.trim()) process.exit(0);

const clean = stripNoise(cmd);
const cwd = input.cwd || HOME;

let what = null;
for (const [re, label] of RULES) {
  if (re.test(clean)) {
    what = label;
    break;
  }
}
if (!what) {
  for (const seg of splitSegments(clean)) {
    const hit = checkRemoval(seg, cwd);
    if (hit) {
      what = hit;
      break;
    }
  }
}

if (what) {
  askUser(
    `This command would ${what}.\n\n` +
      `Approve only if that is really what you want. If you are not sure, deny it and ask Claude to explain what the command does first.`
  );
}
process.exit(0);
