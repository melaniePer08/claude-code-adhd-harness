import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runHook, makeRepo, tmp, rm, HOOKS, ROOT } from './helpers.mjs';

const VALID_TOP = new Set(['continue', 'stopReason', 'suppressOutput', 'systemMessage', 'decision', 'reason', 'hookSpecificOutput']);

// Every hook, with a realistic event, must exit cleanly and print valid hook JSON (or nothing).
const MATRIX = [
  ['block-dangerous', 'PreToolUse', { tool_name: 'Bash', tool_input: { command: 'git status' } }],
  ['secret-scan', 'PreToolUse', { tool_name: 'Bash', tool_input: { command: 'git status' } }],
  ['secret-scan', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'git status' } }],
  ['protect-secret-files', 'PreToolUse', { tool_name: 'Read', tool_input: { file_path: 'README.md' } }],
  ['commit-guard', 'PreToolUse', { tool_name: 'Edit', tool_input: { file_path: 'README.md' } }],
  ['commit-guard', 'Stop', {}],
  ['command-log', 'PreToolUse', { tool_name: 'Bash', tool_input: { command: 'echo hi' } }],
  ['protect-config', 'PreToolUse', { tool_name: 'Edit', tool_input: { file_path: 'README.md' } }],
  ['require-remote', 'PreToolUse', { tool_name: 'Edit', tool_input: { file_path: 'README.md' } }],
  ['auto-push', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } }],
  ['auto-format', 'PostToolUse', { tool_name: 'Edit', tool_input: { file_path: 'README.md' } }],
  ['review-gate', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } }],
  ['dep-check', 'PostToolUse', { tool_name: 'Edit', tool_input: { file_path: 'README.md' } }],
  ['notify', 'UserPromptSubmit', { prompt: 'hello' }],
  ['notify', 'Stop', {}],
  ['finish-check', 'UserPromptSubmit', { prompt: 'hello' }],
  ['finish-check', 'Stop', {}],
  ['github-check', 'SessionStart', { source: 'startup' }],
  ['session-log', 'SessionStart', { source: 'startup' }],
  ['session-log', 'SessionEnd', {}],
  ['session-log', 'Stop', {}],
  ['rules-refresh', 'SessionStart', { source: 'compact' }],
  ['explain-gate', 'PreToolUse', { tool_name: 'Bash', tool_input: { command: 'git status' } }],
  ['ram-check', 'PreToolUse', { tool_name: 'Bash', tool_input: { command: 'git status' } }],
  ['session-start', 'SessionStart', { source: 'startup' }],
  ['mistake-log', 'UserPromptSubmit', { prompt: 'please add a footer' }],
  ['status-update', 'SessionStart', { source: 'startup' }],
  ['status-update', 'UserPromptSubmit', { prompt: 'x' }],
  ['status-update', 'PostToolUse', { tool_name: 'Bash' }],
  ['status-update', 'Notification', { message: 'x', notification_type: 'permission_prompt' }],
  ['status-update', 'Stop', {}],
  ['status-update', 'SessionEnd', {}],
];

test('every hook runs cleanly and prints valid hook JSON', () => {
  const repo = makeRepo();
  const home = tmp();
  try {
    for (const [name, event, extra] of MATRIX) {
      const r = runHook(name, { hook_event_name: event, session_id: 'test-session', cwd: repo.dir, ...extra }, home);
      assert.ok(r.status === 0 || r.status === 2, `${name}/${event} exited ${r.status}: ${r.stderr.slice(0, 200)}`);
      if (r.raw.trim()) {
        assert.ok(r.json, `${name}/${event} printed something that is not JSON: ${r.raw.slice(0, 100)}`);
        const bad = Object.keys(r.json).filter((k) => !VALID_TOP.has(k));
        assert.deepEqual(bad, [], `${name}/${event} printed unknown keys ${bad}`);
        const hs = r.json.hookSpecificOutput;
        if (hs?.hookEventName) assert.equal(hs.hookEventName, event, `${name} names the wrong event`);
      }
    }
  } finally {
    repo.cleanup();
    rm(home);
  }
});

test('every hook file is covered: each .mjs in hooks/ is a registered hook or a known helper', () => {
  const template = JSON.parse(fs.readFileSync(path.join(HOOKS, 'settings.example.json'), 'utf8'));
  const registered = new Set();
  for (const groups of Object.values(template.hooks)) for (const g of groups) for (const h of g.hooks) registered.add(path.basename(h.args[0], '.mjs'));
  const helpers = new Set(['lib', 'toast', 'status', 'statusline', 'install']);
  for (const f of fs.readdirSync(HOOKS).filter((x) => x.endsWith('.mjs'))) {
    const n = f.replace(/\.mjs$/, '');
    assert.ok(registered.has(n) || helpers.has(n), `${f} is neither registered in settings.example.json nor a known helper`);
  }
  for (const n of registered) assert.ok(fs.existsSync(path.join(HOOKS, `${n}.mjs`)), `settings.example.json registers ${n}.mjs, which does not exist`);
});

test('block-dangerous asks before a force-push and is quiet for git status', () => {
  const home = tmp();
  try {
    const ask = runHook('block-dangerous', { hook_event_name: 'PreToolUse', tool_name: 'Bash', cwd: ROOT, tool_input: { command: 'git push --force origin main' } }, home);
    assert.equal(ask.json?.hookSpecificOutput?.permissionDecision, 'ask');
    const quiet = runHook('block-dangerous', { hook_event_name: 'PreToolUse', tool_name: 'Bash', cwd: ROOT, tool_input: { command: 'git status' } }, home);
    assert.equal(quiet.raw.trim(), '');
  } finally {
    rm(home);
  }
});

test('protect-secret-files blocks reading a .env that holds a real value, and allows an empty one', () => {
  const home = tmp();
  const dir = tmp();
  try {
    const env = path.join(dir, '.env');
    fs.writeFileSync(env, 'API_KEY=\n');
    const empty = runHook('protect-secret-files', { hook_event_name: 'PreToolUse', tool_name: 'Read', cwd: dir, tool_input: { file_path: env } }, home);
    assert.equal(empty.json?.hookSpecificOutput?.permissionDecision ?? 'allow', 'allow', 'an empty .env skeleton may be touched');
    fs.writeFileSync(env, `API_KEY=${'q7Zx'.repeat(8)}\n`);
    const real = runHook('protect-secret-files', { hook_event_name: 'PreToolUse', tool_name: 'Read', cwd: dir, tool_input: { file_path: env } }, home);
    assert.equal(real.json?.hookSpecificOutput?.permissionDecision, 'deny', 'a .env with a real value must not be readable');
    assert.ok(!real.raw.includes('q7Zx'), 'the secret must never be printed');
  } finally {
    rm(home);
    rm(dir);
  }
});

test('commit-guard sends Claude back to commit changes made during the turn', () => {
  const repo = makeRepo();
  const home = tmp();
  try {
    const base = { session_id: 'cg', cwd: repo.dir };
    runHook('commit-guard', { ...base, hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: path.join(repo.dir, 'new.txt') } }, home);
    fs.writeFileSync(path.join(repo.dir, 'new.txt'), 'hello\n');
    const stop = runHook('commit-guard', { ...base, hook_event_name: 'Stop', stop_hook_active: false }, home);
    assert.equal(stop.json?.decision, 'block');
    assert.match(stop.json.reason, /new\.txt/);
    const again = runHook('commit-guard', { ...base, hook_event_name: 'Stop', stop_hook_active: true }, home);
    assert.equal(again.raw.trim(), '', 'fires at most once per turn (loop guard)');
  } finally {
    repo.cleanup();
    rm(home);
  }
});
