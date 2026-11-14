#!/usr/bin/env node
// PreToolUse (Edit|Write|NotebookEdit|Bash|PowerShell): ask before changing the setup itself.
//
// Reading is always fine. Writing to the files that define how Claude behaves on this
// machine — settings, global instructions, hooks, skills, tools, and git's own hook
// directory — goes through you first, so nothing quietly rewrites its own guardrails.

import path from 'node:path';
import { readInput, askUser, norm, toWinPath, HOME } from './lib.mjs';

const PROTECTED = [
  { re: /\/\.claude\/settings(?:\.local)?\.json$/, what: 'your Claude Code settings (hooks, permissions, model)' },
  { re: /\/\.claude\/claude\.md$/, what: 'your global instructions file' },
  { re: /\/\.claude\/hooks\//, what: 'a hook script that enforces your rules' },
  { re: /\/\.claude\/skills\//, what: 'one of your installed skills' },
  { re: /\/\.claude\/tools\//, what: 'one of your installed tools' },
  { re: /\/\.claude\/(?:agents|commands)\//, what: 'one of your agents or slash commands' },
  { re: /\/\.git\/hooks\//, what: "git's own hook directory (runs on every commit)" },
];

// Anything that could change a file, in bash or PowerShell.
const MUTATES =
  /(?:^|[\s;&|(])(?:rm|del|erase|unlink|mv|move|cp|copy|tee|truncate|touch|chmod|attrib|install|ln)\b|>>?|\bsed\s+-i|\b(?:Set|Add|Clear|Remove|Move|Copy|New|Rename)-(?:Content|Item|ItemProperty)\b|\bOut-File\b|\bgit\s+(?:checkout|restore|clean|apply)\b|\bnode\s+-e\b|\bpython\s+-c\b/i;

function classify(p) {
  const n = norm(toWinPath(String(p || '').replace(/^~(?=[/\\]|$)/, HOME)));
  if (!n) return null;
  for (const rule of PROTECTED) if (rule.re.test(n)) return rule;
  return null;
}

const input = await readInput();
const tool = input?.tool_name || '';
const ti = input?.tool_input || {};
const cwd = input?.cwd || HOME;

const ask = (hit, target) =>
  askUser(
    `This changes ${hit.what}:\n  ${target}\n\n` +
      'That is part of your setup, not project code. Approve only if you asked for this change. ' +
      'If it is unexpected, deny it and ask what the change was for.'
  );

if (tool === 'Bash' || tool === 'PowerShell') {
  const cmd = String(ti.command || '');
  if (!cmd.trim()) process.exit(0);
  if (!/\.claude[/\\]|\.git[/\\]hooks/i.test(cmd)) process.exit(0);
  if (!MUTATES.test(cmd)) process.exit(0); // reading config is fine
  for (const raw of cmd.match(/(?:[A-Za-z]:)?[~./\\][^\s"';|&<>]*/g) || []) {
    const abs = path.isAbsolute(raw) || /^[~/]/.test(raw) ? raw : path.resolve(cwd, raw);
    const hit = classify(abs);
    if (hit) ask(hit, raw);
  }
  process.exit(0);
}

const target = ti.file_path || ti.notebook_path;
if (!target) process.exit(0);
const abs = path.isAbsolute(target) ? target : path.resolve(cwd, target);
const hit = classify(abs);
if (hit) ask(hit, abs);
process.exit(0);
