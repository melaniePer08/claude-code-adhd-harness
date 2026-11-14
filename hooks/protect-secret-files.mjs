#!/usr/bin/env node
// PreToolUse (Read|Edit|Write|NotebookEdit|Grep|Bash|PowerShell):
// keep real secret files out of the conversation.
//
// Claude may still create the *skeleton*: an .env.example with placeholder values and
// an .env whose values are empty. Once the user fills in real values, the file is
// protected — no reading, editing, copying, moving or deleting it.

import path from 'node:path';
import fs from 'node:fs';
import { readInput, deny, HOME, isSecretishFile, isExampleName, isDotenvName, secretFileState, dotenvHasRealValue, scanLine, splitSegments } from './lib.mjs';

const ADVICE =
  'What to do instead:\n' +
  '  - To add a new setting: put its NAME with a placeholder value in `.env.example`, then tell the user which value to add to the real file.\n' +
  '  - To check whether a variable is set: run code that prints only true/false, never the value itself.\n' +
  '  - If the user wants the file changed, ask them to edit it themselves — they hold the secrets.';

function absOf(p, cwd) {
  const s = String(p || '');
  if (!s) return null;
  return path.isAbsolute(s) ? path.resolve(s) : path.resolve(cwd, s);
}

function denyRead(file) {
  deny(`\`${path.basename(file)}\` holds the user's real secrets, so this hook blocks reading or searching it.\n\n${ADVICE}`);
}

function denyWrite(file, why) {
  deny(`\`${path.basename(file)}\` is a secrets file. ${why}\n\n${ADVICE}`);
}

// A skeleton Claude is allowed to write: .env-style with no real values, or any
// other secrets file as long as it carries no key material.
function contentIsSafe(file, content) {
  const text = String(content ?? '');
  if (isDotenvName(path.basename(file))) return !dotenvHasRealValue(text);
  for (const line of text.split('\n')) {
    if (scanLine(line, file).length) return false;
  }
  return true;
}

const SECRET_TOKEN_RE =
  /(?:^|[\s"'=(:,><|])((?:[\w.$~-]*[/\\])*(?:\.env(?:\.[\w-]+)*|id_(?:rsa|dsa|ecdsa|ed25519)|\.?credentials(?:\.json)?|secrets?\.(?:json|ya?ml|toml|env|txt)|[\w.-]+\.(?:pem|key|p12|pfx|jks|keystore|ppk)))(?=$|[\s"';:,)&|<>])/g;

// Uses of a secrets file that never expose its contents.
const SAFE_FRAGMENTS = [
  /--env-file[=\s]\S+/gi,
  /\bdotenv[\w.-]*/gi,
  /\bgit\s+check-ignore[^;&|\n]*/gi,
  /\bgit\s+status[^;&|\n]*/gi,
  /\bgit\s+ls-files[^;&|\n]*/gi,
  /\bTest-Path[^;&|\n]*/gi,
  /\btest\s+-[a-z]+\s+\S+/gi,
  /\[\s+-[a-z]+\s+[^\]]*\]/gi,
  /\bls\b[^;&|\n]*/gi,
  /\bdir\b[^;&|\n]*/gi,
  /\bGet-ChildItem\b[^;&|\n]*/gi,
];

function checkCommand(cmd, cwd) {
  let text = String(cmd || '');
  if (!text.trim()) return;
  for (const re of SAFE_FRAGMENTS) text = text.replace(re, ' ');
  SECRET_TOKEN_RE.lastIndex = 0;
  let m;
  const seen = new Set();
  while ((m = SECRET_TOKEN_RE.exec(text)) !== null) {
    const ref = m[1];
    const base = path.basename(ref);
    if (isExampleName(base) || seen.has(ref)) continue;
    seen.add(ref);
    const abs = absOf(ref, cwd);
    if (!abs) continue;
    if (secretFileState(abs) === 'protected') {
      deny(
        `This command touches \`${base}\`, which holds the user's real secrets. Reading, printing, copying, moving, deleting or overwriting it is blocked.\n\n${ADVICE}`
      );
      process.exit(0);
    }
  }
}

const input = await readInput();
const tool = input?.tool_name;
const ti = input?.tool_input || {};
const cwd = input?.cwd || HOME;

if (tool === 'Bash' || tool === 'PowerShell') {
  checkCommand(ti.command, cwd);
  process.exit(0);
}

let file = null;
let mode = null;
let content = null;
if (tool === 'Read') {
  file = ti.file_path;
  mode = 'read';
} else if (tool === 'Grep') {
  file = ti.path;
  mode = 'read';
} else if (tool === 'Edit') {
  file = ti.file_path;
  mode = 'write';
  content = ti.new_string;
} else if (tool === 'Write') {
  file = ti.file_path;
  mode = 'write';
  content = ti.content;
} else if (tool === 'NotebookEdit') {
  file = ti.notebook_path;
  mode = 'write';
  content = ti.new_source;
}

if (!file || !isSecretishFile(file)) process.exit(0);

const abs = absOf(file, cwd);
if (!abs) process.exit(0);
if (mode === 'read') {
  try {
    if (fs.statSync(abs).isDirectory()) process.exit(0);
  } catch {
    process.exit(0);
  }
}

const state = secretFileState(abs);

if (mode === 'read') {
  if (state === 'protected') denyRead(abs);
  process.exit(0);
}

if (state === 'protected') {
  denyWrite(abs, 'It already holds real values, so overwriting or editing it could destroy them.');
} else if (!contentIsSafe(abs, content)) {
  denyWrite(
    abs,
    'The content you are writing contains real secret values. Write the variable NAMES with empty values here and put placeholders in the `.example` file — the user fills in the real values.'
  );
}
process.exit(0);
