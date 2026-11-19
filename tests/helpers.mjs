// Shared helpers for the test suite. Plain Node, no packages:  node --test
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// HARNESS_HOOKS_DIR lets the same tests run against an INSTALLED copy (e.g. ~/.claude/hooks) to prove it works.
export const HOOKS = process.env.HARNESS_HOOKS_DIR ? path.resolve(process.env.HARNESS_HOOKS_DIR) : path.join(ROOT, 'hooks');

/** A fresh throwaway folder. Remove with rm(). */
export function tmp(prefix = 'cch-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
export const rm = (dir) => fs.rmSync(dir, { recursive: true, force: true });

/**
 * Run one hook script the way Claude Code does: JSON on stdin, results on stdout.
 * `home` replaces the user's home folder so tests never touch the real ~/.claude.
 */
export function runHook(script, input, home, env = {}) {
  const file = path.isAbsolute(script) ? script : path.join(HOOKS, `${script}.mjs`);
  // The tests must not depend on the machine they run on: a NO_COLOR / FORCE_COLOR set by the
  // caller (a terminal, a CI job, a hook runner) would change what the status line prints.
  const base = { ...process.env };
  delete base.NO_COLOR;
  delete base.FORCE_COLOR;
  const r = spawnSync(process.execPath, [file], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: 60000,
    windowsHide: true,
    env: { ...base, USERPROFILE: home, HOME: home, CC_NO_TOAST: '1', ...env },
  });
  let json = null;
  try {
    json = r.stdout.trim() ? JSON.parse(r.stdout) : null;
  } catch {
    /* leave null; callers assert on `raw` */
  }
  return { status: r.status, raw: r.stdout || '', stderr: r.stderr || '', json };
}

/** A git repo in a temp folder, optionally with a local bare "remote". */
export function makeRepo({ remote = false } = {}) {
  const dir = tmp('cch-repo-');
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe', encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('config', 'core.autocrlf', 'false');
  let bare = null;
  if (remote) {
    bare = tmp('cch-remote-');
    execFileSync('git', ['init', '-q', '--bare', bare], { stdio: 'pipe' });
    git('remote', 'add', 'origin', bare);
    fs.writeFileSync(path.join(dir, 'first.txt'), 'first\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'feat: first');
    git('push', '-q', '-u', 'origin', 'main');
  } else {
    git('remote', 'add', 'origin', 'https://example.invalid/test.git');
  }
  const commit = (file, content, message) => {
    fs.writeFileSync(path.join(dir, file), content);
    git('add', '-A');
    git('commit', '-q', '-m', message);
  };
  return { dir, bare, git, commit, cleanup: () => { rm(dir); if (bare) rm(bare); } };
}

export const readLog = (home) => {
  const d = path.join(home, '.claude', 'logs');
  try {
    return fs.readdirSync(d).filter((f) => f.startsWith('work-')).map((f) => fs.readFileSync(path.join(d, f), 'utf8')).join('\n');
  } catch {
    return '';
  }
};

/** Build a fake token at run time so no secret-looking text ever sits in this repo. */
export const fake = (prefix, n, chars = 'Ab9_') => prefix + chars.repeat(Math.ceil(n / chars.length)).slice(0, n);
