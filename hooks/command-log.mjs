#!/usr/bin/env node
// PreToolUse (Bash|PowerShell): write down every command Claude runs.
//
// One line of JSON per command in ~/.claude/logs/commands-<date>.log, so you can
// always answer "what did it actually do?" after the fact. Never blocks anything.
// Anything that looks like a credential is masked before it is written.

import { readInput, appendLog, pruneLogs, redact, stamp, HOME } from './lib.mjs';

const input = await readInput();
const cmd = input?.tool_input?.command;
if (typeof cmd !== 'string' || !cmd.trim()) process.exit(0);

const entry = {
  t: new Date().toISOString(),
  s: String(input?.session_id || '').slice(0, 8),
  tool: input?.tool_name || '',
  cwd: input?.cwd || HOME,
  cmd: redact(cmd).slice(0, 2000),
};

appendLog(`commands-${stamp()}.log`, JSON.stringify(entry));
if (Math.random() < 0.02) pruneLogs(); // keep a month, cheaply
process.exit(0);
