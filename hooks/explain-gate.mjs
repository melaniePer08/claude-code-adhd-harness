#!/usr/bin/env node
// PreToolUse (Bash|PowerShell): make sure risky commands are EXPLAINED before they can be approved.
//
// Rule 2.1 says every command that needs approval is explained part by part first. A rule that
// only lives in Claude's instructions gets forgotten, so this hook enforces it:
//
//   1. A command that is risky (deletes, installs, force-pushes, uploads, kills programs,
//      schedules jobs, deploys...) is refused ONCE, with a plain decoded breakdown of the command.
//   2. Claude must write the explanation in its message (explain-command skill), then run the
//      SAME command again. The second try goes through to the normal permission prompt, so the
//      user reads the explanation first and approves second.
//   3. Each distinct command is refused at most once per session (loop guard, rule 2.8).
//
// The hook cannot write the explanation itself — it has no idea what you are trying to achieve —
// but the decoded breakdown makes the part-by-part explanation accurate instead of from memory.
// Harmless commands (git status, ls, reading files, running tests...) are never interrupted.

import crypto from 'node:crypto';
import path from 'node:path';
import { readInput, deny, askUser, stripNoise, splitSegments, tokenize, loadState, saveState, harnessSetting, riskOf, decode, userExplanation } from './lib.mjs';

// ------------------------------------------------------------------------ main

const input = await readInput();
const cmd = input?.tool_input?.command;
if (typeof cmd !== 'string' || !cmd.trim()) process.exit(0);

const clean = stripNoise(cmd);
const segments = splitSegments(clean);
const risky = [];
for (const seg of segments) {
  const reason = riskOf(tokenize(seg), seg);
  if (reason) risky.push({ seg, reason });
}
if (!risky.length && /\|\s*(?:sh|bash|zsh|pwsh|powershell|iex)\b/i.test(clean)) risky.push({ seg: clean.slice(0, 140), reason: 'pipes downloaded text straight into a shell' });

// The user also asked (EXPLAIN_SCRIPTS, default yes): multi-line commands, heredocs and inline
// scripts are explained before they run too — and code changes should go through the Edit/Write
// tool, so the user can review a diff instead of a script. Plain git add/commit/status are exempt.
const SCRIPTISH = /\b(?:node(?:\.exe)?\s+(?:-e|--eval|-p|--print)\b|python[0-9.]*(?:\.exe)?\s+(?:-c\b|-\s*(?:<<|$))|(?:bash|sh|zsh)\s+-c\b|(?:powershell|pwsh)(?:\.exe)?\b[^\n]*\s-(?:Command|c)\b)/i;
const simpleGit = segments.length > 0 && segments.every((seg) => /^git\s+(?:add|commit|status|log|diff|push|pull|fetch|show|branch|switch|stash\s+list)\b/.test(seg));
const scriptish = String(harnessSetting('EXPLAIN_SCRIPTS', 'yes')).toLowerCase() !== 'no' && !simpleGit &&
  (clean.includes('\n') || clean.includes('<<heredoc>>') || SCRIPTISH.test(clean));
const realRisk = risky.length > 0; // a real risk, not just "this is a script"
if (!risky.length && scriptish) risky.push({ seg: clean.slice(0, 140), reason: 'is a multi-line command or an inline script (heredoc, node -e, python -c, pipes)' });
if (!risky.length) process.exit(0);

// Loop guard: each distinct command is stopped once per session. On the retry, a risky command
// goes to the user as an approval prompt that carries the plain-language explanation ITSELF, so
// the person can decide even if Claude's message was short or missing. (Scripts alone just pass.)
const key = crypto.createHash('sha1').update(cmd.trim()).digest('hex').slice(0, 16);
const st = loadState(input?.session_id, 'explain');
st.seen = Array.isArray(st.seen) ? st.seen : [];
if (st.seen.includes(key)) {
  if (realRisk) askUser(userExplanation(cmd, input?.cwd, risky.map((r) => r.reason)));
  process.exit(0);
}
st.seen = [...st.seen, key].slice(-200);
saveState(input?.session_id, st, 'explain');

const breakdown = segments.map((s) => decode(s, input?.cwd)).filter(Boolean).join('\n');
deny(
  'Held until it is explained. This command ' + risky.map((r) => `${r.reason}`).filter((v, i, a) => a.indexOf(v) === i).join('; ') + '.\n\n' +
    'Before running it, write the explanation in your message to the user (explain-command skill, rule 2.1): the command, then ' +
    'one short line per part IN ORDER (each piece joined by && ; | is a separate action; say what every flag does; name the exact files, ' +
    'folders, branches or addresses; say what is created / changed / deleted / overwritten / sent off this computer; say what cannot be undone; ' +
    'translate jargon), and finish with one line: "If you say yes: …".\n\n' +
    `Decoded from the command, as raw material (check it, do not just paste it):\n${breakdown}\n\n` +
    'Then run the SAME command again, unchanged — the second try shows the user an approval prompt that already contains the plain explanation. ' +
    (scriptish ? 'For code changes, prefer the Edit or Write tool over an inline script, so the user can review a diff. If you still use a script, also explain the heredoc, pipe and grep parts.\n' : '') +
    'Do not reword or split the command to avoid this check.'
);
process.exit(0);
