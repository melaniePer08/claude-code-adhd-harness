#!/usr/bin/env node
// SessionStart + SessionEnd: a plain-language diary of what got done.
//
// Appends to ~/.claude/logs/work-<date>.md: which folder, how long, which commits,
// what is still uncommitted or unpushed. Sessions where nothing changed are skipped
// so the file stays readable.

import path from 'node:path';
import { readInput, git, repoRoot, statusEntries, unpushed, appendLog, stamp, loadState, saveState, HOME } from './lib.mjs';

const input = await readInput();
const session = input?.session_id;
const cwd = input?.cwd || HOME;

if (input?.hook_event_name === 'SessionStart') {
  const root = repoRoot(cwd);
  saveState(
    session,
    { startedAt: Date.now(), cwd, root: root || null, head: root ? (git(root, ['rev-parse', 'HEAD']) || '').trim() : null },
    'session'
  );
  process.exit(0);
}

// ---- SessionEnd ------------------------------------------------------------
const st = loadState(session, 'session');
const root = st.root || repoRoot(cwd);
if (!root) process.exit(0);

const commits = st.head && git(root, ['cat-file', '-e', `${st.head}^{commit}`]) !== null
  ? (git(root, ['log', '--format=- `%h` %s', `${st.head}..HEAD`]) || '').trim()
  : '';
const dirty = (statusEntries(root) || []).length;
if (!commits && !dirty) process.exit(0); // nothing happened worth writing down

// A resumed session ends more than once; log each stretch of commits only once.
const headNow = (git(root, ['rev-parse', 'HEAD']) || '').trim();
const logged = loadState(session, 'sessionlog');
if (logged.head === headNow && logged.dirty === dirty) process.exit(0);
saveState(session, { head: headNow, dirty }, 'sessionlog');

const started = Number(st.startedAt) || Date.now();
const mins = Math.max(1, Math.round((Date.now() - started) / 60000));
const u = unpushed(root);
const lines = [
  '',
  `## ${new Date().toLocaleTimeString()} — ${path.basename(root)} (${mins} min)`,
  `Folder: ${root}`,
];
if (commits) lines.push('', 'Committed:', commits);
if (dirty) lines.push('', `Still uncommitted: ${dirty} file${dirty === 1 ? '' : 's'}`);
if (u?.noRemote) lines.push('', 'No GitHub remote on this repo.');
else if (u?.count) lines.push('', `Unpushed commits: ${u.count}`);

appendLog(`work-${stamp()}.md`, lines.join('\n'));
process.exit(0);
