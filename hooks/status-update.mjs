#!/usr/bin/env node
// Every event: keep this terminal's status file up to date (see status.mjs and tools/status-board.mjs).
//
//   SessionStart        -> waiting  ("new session — your turn")
//   UserPromptSubmit    -> working
//   PostToolUse         -> working  (after you approve something, Claude is busy again)
//   Notification        -> waiting  (Claude is asking for an answer or an approval)
//   Stop                -> waiting  ("done — your turn"), unless a hook just flagged a problem (alert)
//   SessionEnd          -> the status file is removed
//
// A "red" alert is set by the hooks that stop Claude (finish-check, secret-scan, ram-check) through
// setStatus(); it stays until your next prompt. Optional and EXPERIMENTAL (STATUS_TERMINAL_TITLE = yes):
// also try to put "● project" into the terminal tab title. Claude Code rewrites that title itself,
// so this may not stick — the status line and the board are the reliable ways to see the state.

import fs from 'node:fs';
import { readInput, harnessSetting } from './lib.mjs';
import { setStatus, clearStatus, readStatus, shortName, STATES } from './status.mjs';

const ALERT_HOLD_MS = 2 * 60 * 1000;

function tryTabTitle(name, state) {
  if (String(harnessSetting('STATUS_TERMINAL_TITLE', 'no')).toLowerCase() !== 'yes') return;
  const text = `${STATES[state].symbol} ${name}`.replace(/[\x00-\x1f\x7f]/g, '');
  const seq = `\x1b]2;${text}\x07`;
  for (const target of process.platform === 'win32' ? ['\\\\.\\CONOUT$'] : ['/dev/tty']) {
    try {
      const fd = fs.openSync(target, 'w');
      fs.writeSync(fd, seq);
      fs.closeSync(fd);
      return;
    } catch {
      /* no terminal reachable from here — fine */
    }
  }
}

const input = await readInput();
const sid = input?.session_id;
const cwd = input?.cwd;
if (!sid) process.exit(0);

const event = input?.hook_event_name;
let state = null;
let detail = '';

switch (event) {
  case 'SessionStart':
    state = 'waiting';
    detail = 'new session — your turn';
    break;
  case 'UserPromptSubmit':
    state = 'working';
    break;
  case 'PostToolUse':
    state = 'working';
    break;
  case 'Notification': {
    state = 'waiting';
    const type = String(input?.notification_type || '');
    detail = /permission/i.test(type) ? 'waiting for your approval' : /idle/i.test(type) ? 'waiting for your next message' : String(input?.message || 'needs you');
    break;
  }
  case 'Stop': {
    const prev = readStatus(sid);
    if (prev?.state === 'alert' && Date.now() - (prev.updatedAt || 0) < ALERT_HOLD_MS) process.exit(0); // keep the red
    state = 'waiting';
    detail = 'done — your turn';
    break;
  }
  case 'SessionEnd':
    clearStatus(sid);
    process.exit(0);
  default:
    process.exit(0);
}

// Do not let a routine "working" tick wipe a fresh alert before the user has seen it.
if (state === 'working' && event === 'PostToolUse') {
  const prev = readStatus(sid);
  if (prev?.state === 'alert' && Date.now() - (prev.updatedAt || 0) < ALERT_HOLD_MS) process.exit(0);
}

setStatus(sid, state, { cwd, detail });
tryTabTitle(shortName(cwd), state);
process.exit(0);
