#!/usr/bin/env node
// PreToolUse (file/shell tools) + Stop: never let a turn end with uncommitted work.
//
// PreToolUse records a "baseline" of the working tree the first time a turn touches
// a repo, so only changes made during that turn count. Stop compares against the
// baseline and, if anything changed and is still uncommitted, sends Claude back to
// commit it. `stop_hook_active` prevents a loop: the guard fires at most once per turn.

import path from 'node:path';
import fs from 'node:fs';
import { readInput, out, repoRoot, gitBusy, statusEntries, fingerprint, loadState, saveState, logMistake, HOME } from './lib.mjs';

const input = await readInput();
const session = input?.session_id;

if (input?.hook_event_name === 'PreToolUse') {
  const ti = input.tool_input || {};
  const cwd = input.cwd || HOME;
  const target = ti.file_path || ti.notebook_path;
  const dir = target ? path.dirname(path.isAbsolute(target) ? target : path.resolve(cwd, target)) : cwd;
  const root = repoRoot(dir);
  if (!root) process.exit(0);

  const st = loadState(session);
  st.repos = st.repos || {};
  const lastStopAt = st.lastStopAt || 0;
  const entry = st.repos[root];
  if (!entry || (entry.lastTouched || 0) <= lastStopAt) {
    // First touch of this repo in this turn: whatever is already on disk is not ours.
    st.repos[root] = { baseline: fingerprint(root), lastTouched: Date.now() };
  } else {
    entry.lastTouched = Date.now();
  }
  saveState(session, st);
  process.exit(0);
}

// ---- Stop -------------------------------------------------------------------
const st = loadState(session);
st.repos = st.repos || {};
const lastStopAt = st.lastStopAt || 0;
const dirty = [];

if (!input?.stop_hook_active) {
  for (const [root, info] of Object.entries(st.repos)) {
    if (!info || (info.lastTouched || 0) <= lastStopAt) continue;
    if (!fs.existsSync(root) || gitBusy(root)) continue;
    const entries = statusEntries(root);
    if (entries === null || entries.length === 0) continue;
    if (fingerprint(root) !== info.baseline) dirty.push({ root, entries });
  }
}

// Accept the current state either way, so the same changes are never raised twice.
st.lastStopAt = Date.now();
for (const info of Object.values(st.repos)) {
  if (info) info.lastTouched = Math.min(info.lastTouched || 0, st.lastStopAt);
}
for (const [root, info] of Object.entries(st.repos)) {
  if (!info || !fs.existsSync(root)) continue;
  const fp = fingerprint(root);
  if (fp) info.baseline = fp;
}
saveState(session, st);

if (dirty.length) {
  const lines = [];
  for (const { root, entries } of dirty) {
    lines.push(`${root}`);
    for (const e of entries.slice(0, 15)) lines.push(`  ${e.xy} ${e.file}`);
    if (entries.length > 15) lines.push(`  ...and ${entries.length - 15} more`);
  }
  logMistake('ended a turn with uncommitted changes', input?.cwd);
  out({
    decision: 'block',
    reason:
      `These changes from this turn are still uncommitted:\n${lines.join('\n')}\n\n` +
      'Per the git rules in ~/.claude/CLAUDE.md: commit them now, one logical change per commit, with a clear message describing what changed. ' +
      'Check first that nothing secret is being committed. ' +
      'If some of these changes are not yours or should not be committed yet, leave them alone and tell the user why in one line.',
  });
}
process.exit(0);
