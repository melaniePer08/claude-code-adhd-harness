// Regression tests for problems found in a code review (2026-11-19).
// Secret-looking text is built at run time so this file itself stays clean for the secret scanner.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { HOOKS, ROOT, tmp, rm, runHook } from './helpers.mjs';

const lib = await import(pathToFileURL(path.join(HOOKS, 'lib.mjs')).href);
const J = (...p) => p.join('');

test('a real password that merely STARTS like a placeholder word still counts as a real value', () => {
  for (const v of [J('my', 'password123'), J('My', 'secret!99'), J('null', 'able-Pass9'), J('true', 'Blue2024x'), J('$', 'ecretValue123'), J('example', '-prod-9fX2'), J('env', '.Passw0rd'), J('my-pass', 'word-Abc123')]) {
    assert.equal(lib.dotenvHasRealValue(`${J('DB_PASS', 'WORD')}=${v}`), true, `${v} should be treated as a real value`);
  }
});

test('genuine placeholders and empty values are still recognised as placeholders', () => {
  for (const v of ['', 'your_api_key_here', 'your-token', '<paste-key-here>', 'changeme', 'xxxxxxxx', '${OTHER_VAR}', '$OTHER_VAR', 'process.env.KEY', 'localhost', 'true', 'null', 'example', 'test-key', '{{ secret }}', '...']) {
    assert.equal(lib.dotenvHasRealValue(`${J('API_', 'KEY')}=${v}`), false, `"${v}" should be a placeholder`);
  }
});

test('the scanner flags a hard-coded value that starts like a placeholder word, but not a real placeholder', () => {
  const name = J('API_', 'KEY');
  assert.ok(lib.scanLine(`const ${name} = "${J('my', 'password1234567')}"`).length > 0);
  assert.equal(lib.scanLine(`const ${name} = "your_api_key_here_please"`).length, 0);
});

test('the scanner recognises new-style OpenAI keys that contain - and _', () => {
  const key = J('sk', '-proj-', 'abcDEF123456789012_', 'ghiJKL-mno345678901234567890');
  assert.ok(lib.scanLine(`x ${key}`).length > 0);
});

const asks = (command) =>
  runHook('block-dangerous', { tool_name: 'Bash', tool_input: { command }, cwd: ROOT }, tmp('cch-home-')).json?.hookSpecificOutput?.permissionDecision === 'ask';

test('block-dangerous asks about commands that destroy work in ways it used to miss', () => {
  for (const c of [
    'git push origin +main',
    'git push origin +HEAD',
    'git checkout -- .',
    'git checkout .',
    'git restore .',
    'git restore src/app.js',
    'find . -name "*.log" -delete',
    'find . -exec rm {} +',
    'bash -c "rm -rf ~/Documents"',
    'sh -c \'rm -rf ~\'',
    'ls | xargs rm -rf',
  ]) {
    assert.equal(asks(c), true, `should ask: ${c}`);
  }
});

test('block-dangerous stays quiet for safe look-alikes', () => {
  for (const c of [
    'git push origin main',
    'git restore --staged src/app.js',
    'git checkout -b my-branch',
    'git checkout main',
    'git status',
    'bash -c "echo hello"',
    'find . -name "*.js"',
    'xargs echo hi',
    'Remove-Item -Force notes.txt', // -Force only skips prompts; it is not recursive
  ]) {
    assert.equal(asks(c), false, `should stay quiet: ${c}`);
  }
});

test('everyday commands are explained in plain words, with no "look it up"', () => {
  const text = (cmd) => lib.userExplanation(cmd, ROOT, []);
  const a = text("git log --format='%ae' | sort | uniq -c");
  assert.match(a, /program `sort` — sorts lines of text/);
  assert.match(a, /-c — counts how often each line appears/);
  const b = text('ls LICENSE* 2>&1 | head -2');
  assert.match(b, /program `head` — shows the first lines of a file/);
  assert.match(b, /-2 — only 2 lines/);
  const c = text('grep -rn TODO src');
  assert.match(c, /-r — searches inside folders too/);
  assert.match(c, /-n — shows line numbers/);
  const d = text('sed -n 12,18p notes.md');
  assert.match(d, /program `sed` — edits or filters text/);
  assert.match(d, /-n — prints only what the script asks for/);
  const e = text("node -e 'console.log(1)'");
  assert.match(e, /-e — runs the following text as JavaScript/);
  for (const t of [a, b, c, d, e]) assert.ok(!/look at --help or the docs if unsure/.test(t), `unexplained program in:\n${t}`);
});
