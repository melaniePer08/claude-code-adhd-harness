import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmp, rm, ROOT } from './helpers.mjs';

const install = (home, ...args) => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'install.mjs'), '--home', home, ...args], { encoding: 'utf8', env: { ...process.env, CC_NO_TOAST: '1' } });
  return { status: r.status, out: r.stdout, err: r.stderr };
};
const settingsOf = (home) => JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'));
const homeWith = (settings) => {
  const home = tmp('cch-home-');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  if (settings) fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify(settings));
  return home;
};

test('a dry run (the default) changes nothing at all', () => {
  const home = homeWith({ model: 'x' });
  try {
    const before = fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8');
    const r = install(home, '--skills', 'all', '--hooks', 'all');
    assert.equal(r.status, 0);
    assert.match(r.out, /DRY RUN/);
    assert.deepEqual(fs.readdirSync(path.join(home, '.claude')), ['settings.json'], 'no new files or folders');
    assert.equal(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'), before);
  } finally {
    rm(home);
  }
});

test('--apply installs rules, skills, tools and hooks; a second run changes nothing (idempotent)', () => {
  const home = homeWith({ model: 'x' });
  try {
    const r = install(home, '--skills', 'all', '--hooks', 'all', '--apply');
    assert.equal(r.status, 0, r.err);
    const c = path.join(home, '.claude');
    assert.ok(fs.existsSync(path.join(c, 'harness', 'CLAUDE.md')));
    assert.ok(fs.existsSync(path.join(c, 'harness', 'rules', '02-permissions.md')));
    assert.ok(!fs.existsSync(path.join(c, 'rules')), 'rules must NOT go into ~/.claude/rules (loaded every session)');
    assert.ok(fs.existsSync(path.join(c, 'skills', 'plan-first', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(c, 'skills', 'owner-form', 'template', 'server.mjs')));
    assert.ok(fs.existsSync(path.join(c, 'tools', 'status-board.mjs')));
    for (const f of ['lib.mjs', 'toast.mjs', 'status.mjs', 'statusline.mjs', 'explain-gate.mjs']) assert.ok(fs.existsSync(path.join(c, 'hooks', f)), `${f} missing`);
    const s = settingsOf(home);
    assert.equal(s.model, 'x', 'existing settings are kept');
    assert.ok(s.statusLine?.command.includes('statusline.mjs'), 'status line registered');
    const before = JSON.stringify(s);
    const again = install(home, '--skills', 'all', '--hooks', 'all', '--apply');
    assert.match(again.out, /Total: 0 new files, 0 replaced/);
    assert.equal(JSON.stringify(settingsOf(home)), before, 'settings.json unchanged by a second run');
  } finally {
    rm(home);
  }
});

test('installed hooks run from the install folder (every import resolves)', () => {
  const home = homeWith();
  try {
    assert.equal(install(home, '--skills', 'none', '--hooks', 'all', '--apply').status, 0);
    for (const f of fs.readdirSync(path.join(home, '.claude', 'hooks')).filter((x) => x.endsWith('.mjs') && !['lib.mjs', 'toast.mjs', 'status.mjs', 'statusline.mjs'].includes(x))) {
      const r = spawnSync(process.execPath, [path.join(home, '.claude', 'hooks', f)], { input: JSON.stringify({ hook_event_name: 'Stop', session_id: 'i', cwd: home }), encoding: 'utf8', env: { ...process.env, USERPROFILE: home, HOME: home, CC_NO_TOAST: '1' } });
      assert.ok(r.status === 0 || r.status === 2, `installed ${f} failed: ${r.stderr.slice(0, 200)}`);
      assert.ok(!/Cannot find module|ERR_MODULE_NOT_FOUND/.test(r.stderr), `${f} is missing a helper file`);
    }
  } finally {
    rm(home);
  }
});

test('existing hooks and an existing status line of the user are never removed or replaced', () => {
  const home = homeWith({ statusLine: { type: 'command', command: 'echo mine' }, hooks: { Stop: [{ matcher: '*', hooks: [{ type: 'command', command: 'echo my-hook' }] }] } });
  try {
    install(home, '--skills', 'none', '--hooks', 'status-update,finish-check', '--apply');
    const s = settingsOf(home);
    assert.equal(s.statusLine.command, 'echo mine');
    assert.ok(JSON.stringify(s.hooks.Stop).includes('echo my-hook'));
    assert.ok(JSON.stringify(s.hooks.Stop).includes('finish-check'));
  } finally {
    rm(home);
  }
});

test('the old PostCompact registration of rules-refresh is migrated, nothing else under PostCompact is touched', () => {
  const home = homeWith({ hooks: { PostCompact: [
    { matcher: '*', hooks: [{ type: 'command', command: 'node', args: ['C:/old/.claude/hooks/rules-refresh.mjs'] }] },
    { matcher: '*', hooks: [{ type: 'command', command: 'echo keep-me' }] },
  ] } });
  try {
    install(home, '--skills', 'none', '--hooks', 'rules-refresh', '--apply');
    const s = settingsOf(home);
    assert.ok(!JSON.stringify(s.hooks.PostCompact).includes('rules-refresh'));
    assert.ok(JSON.stringify(s.hooks.PostCompact).includes('keep-me'));
    assert.ok(s.hooks.SessionStart.some((g) => g.matcher === 'compact'));
  } finally {
    rm(home);
  }
});

test('a changed file is backed up OUTSIDE the skills folder (so it never loads as a duplicate skill)', () => {
  const home = homeWith();
  try {
    install(home, '--skills', 'debug', '--hooks', 'none', '--no-tools', '--no-rules', '--apply');
    const skill = path.join(home, '.claude', 'skills', 'debug', 'SKILL.md');
    fs.writeFileSync(skill, 'my own edited version');
    const r = install(home, '--skills', 'debug', '--hooks', 'none', '--no-tools', '--no-rules', '--apply');
    assert.match(r.out, /1 replaced/);
    assert.deepEqual(fs.readdirSync(path.join(home, '.claude', 'skills')), ['debug'], 'no .bak folders next to the skills');
    const backups = path.join(home, '.claude', 'backups');
    const stamp = fs.readdirSync(backups)[0];
    assert.equal(fs.readFileSync(path.join(backups, stamp, 'skills', 'debug', 'SKILL.md'), 'utf8'), 'my own edited version');
  } finally {
    rm(home);
  }
});

test('harness-settings.md and the user\'s own CLAUDE.md are never overwritten', () => {
  const home = homeWith();
  try {
    fs.mkdirSync(path.join(home, '.claude', 'harness'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'harness', 'harness-settings.md'), '| `PLAN` | Max | mine |\n');
    fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'my personal rules');
    install(home, '--skills', 'none', '--hooks', 'none', '--apply');
    assert.match(fs.readFileSync(path.join(home, '.claude', 'harness', 'harness-settings.md'), 'utf8'), /Max/);
    assert.equal(fs.readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf8'), 'my personal rules');
  } finally {
    rm(home);
  }
});

test('an unknown skill or hook name is rejected before anything is changed', () => {
  const home = homeWith();
  try {
    assert.notEqual(install(home, '--skills', 'no-such-skill', '--apply').status, 0);
    assert.notEqual(install(home, '--hooks', 'no-such-hook', '--apply').status, 0);
    assert.deepEqual(fs.readdirSync(path.join(home, '.claude')), []);
  } finally {
    rm(home);
  }
});

test('a settings.json that is not valid JSON is left untouched', () => {
  const home = tmp('cch-home-');
  try {
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'settings.json'), '{ this is not json');
    const r = install(home, '--skills', 'none', '--hooks', 'secret-scan', '--apply');
    assert.notEqual(r.status, 0);
    assert.equal(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'), '{ this is not json');
  } finally {
    rm(home);
  }
});
