#!/usr/bin/env node
// UserPromptSubmit + Stop: don't let a turn end on code that doesn't compile or pass.
//
// UserPromptSubmit records where the turn started. Stop works out what changed since
// then and, if real source files were touched, runs the project's OWN check scripts
// (nothing is installed, nothing is invented). Failures go back to Claude with the
// actual output. Passing checks are silent.
//
// It also reminds Claude to look at interface changes instead of assuming they render.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { notifyUser } from './toast.mjs';
import { setStatus } from './status.mjs';
import { readInput, out, git, repoRoot, gitBusy, statusEntries, projectDir, readJson, redact, logMistake, NOISE_RE, loadState, saveState, HOME } from './lib.mjs';

const PER_CHECK_MS = 90000;
const TOTAL_MS = 150000;
const MAX_BLOCKS_PER_CHECK = 2; // stop nagging if Claude can't fix it
const MAX_UI_REMINDERS = 3;

const CODE_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.vue', '.svelte', '.astro',
  '.py', '.go', '.rs', '.java', '.kt', '.rb', '.php', '.cs', '.c', '.h', '.cpp', '.hpp', '.swift',
]);
const UI_EXT = new Set(['.tsx', '.jsx', '.vue', '.svelte', '.astro', '.html', '.css', '.scss', '.sass', '.less', '.styl']);

const NPM_CLI = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');

function runNpm(cwd, args, timeout) {
  const opts = {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
    // CI=true makes vitest, react-scripts and friends run once instead of watching.
    env: { ...process.env, CI: 'true', FORCE_COLOR: '0', NO_COLOR: '1' },
  };
  try {
    if (fs.existsSync(NPM_CLI)) execFileSync(process.execPath, [NPM_CLI, ...args], opts);
    else execFileSync('npm', args, { ...opts, shell: true });
    return { ok: true };
  } catch (e) {
    if (e?.code === 'ENOENT' || e?.code === 'EINVAL') return { ok: true, skipped: true };
    const text = [e?.stdout, e?.stderr].filter(Boolean).join('\n').trim();
    return { ok: false, timedOut: e?.signal === 'SIGTERM', text };
  }
}

function runBin(cwd, cmd, args, timeout) {
  try {
    execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, CI: 'true', NO_COLOR: '1' },
    });
    return { ok: true };
  } catch (e) {
    if (e?.code === 'ENOENT') return { ok: true, skipped: true };
    const text = [e?.stdout, e?.stderr].filter(Boolean).join('\n').trim();
    return { ok: false, timedOut: e?.signal === 'SIGTERM', text };
  }
}

function onPath(cmd) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore', timeout: 5000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/** The checks this project already defines for itself. */
function plan(dir) {
  const checks = [];
  const pkg = readJson(path.join(dir, 'package.json'));
  if (pkg && pkg.scripts) {
    const s = pkg.scripts;
    const typeName = ['typecheck', 'type-check', 'check-types', 'tsc'].find((n) => typeof s[n] === 'string');
    if (typeName) checks.push({ label: `npm run ${typeName}`, run: () => runNpm(dir, ['run', '--silent', typeName], PER_CHECK_MS) });

    const t = typeof s.test === 'string' ? s.test : '';
    const isPlaceholder = /no test specified/i.test(t);
    const isWatch = /(?:^|\s)(?:--watch|-w)(?:\s|$)|\bwatch\b/.test(t) && !/\brun\b/.test(t);
    if (t && !isPlaceholder && !isWatch) {
      // vitest without an explicit mode still watches unless told otherwise.
      const args = /\bvitest\b/.test(t) && !/\brun\b/.test(t) ? ['test', '--', '--run'] : ['test'];
      checks.push({ label: 'npm test', run: () => runNpm(dir, args, PER_CHECK_MS) });
    }
  }
  if (!checks.length) {
    const py = fs.existsSync(path.join(dir, 'pyproject.toml')) || fs.existsSync(path.join(dir, 'pytest.ini')) || fs.existsSync(path.join(dir, 'setup.cfg'));
    const hasTests = fs.existsSync(path.join(dir, 'tests')) || fs.existsSync(path.join(dir, 'test'));
    if (py && hasTests && onPath('pytest')) checks.push({ label: 'pytest -q', run: () => runBin(dir, 'pytest', ['-q'], PER_CHECK_MS) });
  }
  return checks;
}

const input = await readInput();
const session = input?.session_id;
const cwd = input?.cwd || HOME;

// ---- UserPromptSubmit: mark where this turn starts -------------------------
if (input?.hook_event_name === 'UserPromptSubmit') {
  const st = loadState(session, 'check');
  const root = repoRoot(cwd);
  st.cwd = cwd;
  st.root = root || null;
  st.head = root ? (git(root, ['rev-parse', 'HEAD']) || '').trim() : null;
  st.startedAt = Date.now();
  saveState(session, st, 'check');
  process.exit(0);
}

// ---- Stop ------------------------------------------------------------------
if (input?.stop_hook_active) process.exit(0);

const st = loadState(session, 'check');
const root = st.root && fs.existsSync(st.root) ? st.root : repoRoot(st.cwd || cwd);
if (!root || gitBusy(root)) process.exit(0);

const changed = new Set();
if (st.head && git(root, ['cat-file', '-e', `${st.head}^{commit}`]) !== null) {
  for (const f of (git(root, ['diff', '--name-only', `${st.head}..HEAD`]) || '').split('\n')) {
    if (f.trim()) changed.add(f.trim());
  }
}
for (const e of statusEntries(root) || []) changed.add(e.file);

const files = [...changed].filter((f) => f && !NOISE_RE.test(f));
const head = (git(root, ['rev-parse', 'HEAD']) || '').trim();
st.head = head || st.head;
st.root = root;

const codeFiles = files.filter((f) => CODE_EXT.has(path.extname(f).toLowerCase()));
const uiFiles = files.filter((f) => UI_EXT.has(path.extname(f).toLowerCase()));

if (!codeFiles.length && !uiFiles.length) {
  saveState(session, st, 'check');
  process.exit(0);
}

const problems = [];
if (codeFiles.length) {
  const dir = projectDir(path.dirname(path.join(root, codeFiles[0]))) || root;
  const deadline = Date.now() + TOTAL_MS;
  st.blocks = st.blocks || {};
  for (const check of plan(dir)) {
    if (Date.now() >= deadline) break;
    const res = check.run();
    if (res.ok || res.skipped) continue;
    const seen = (st.blocks[check.label] || 0) + 1;
    st.blocks[check.label] = seen;
    if (seen > MAX_BLOCKS_PER_CHECK) {
      // Claude could not fix it after two nudges: stop nagging, but tell the user (rule 10.1, 2.8).
      if (seen === MAX_BLOCKS_PER_CHECK + 1) setStatus(input?.session_id, 'alert', { cwd: input?.cwd, detail: `${check.label} still failing` });
      if (seen === MAX_BLOCKS_PER_CHECK + 1) notifyUser('🔴 Claude stopped trying', `${check.label} is still failing after 2 attempts. Needs you.`, `finish:${check.label}`);
      continue;
    }
    const detail = res.timedOut
      ? `timed out after ${Math.round(PER_CHECK_MS / 1000)}s`
      : redact(String(res.text || '')).slice(-1600);
    problems.push(`--- ${check.label} (in ${dir}) failed ---\n${detail}`);
  }
}

let uiNote = '';
if (uiFiles.length && (st.uiReminders || 0) < MAX_UI_REMINDERS) {
  st.uiReminders = (st.uiReminders || 0) + 1;
  uiNote =
    `Interface files changed this turn:\n${uiFiles.slice(0, 10).map((f) => `  ${f}`).join('\n')}\n` +
    (uiFiles.length > 10 ? `  ...and ${uiFiles.length - 10} more\n` : '') +
    'Do not assume this renders correctly. Either:\n' +
    '  - screenshot it and look: `node ~/.claude/tools/shot.mjs <url> --out <folder>` ' +
    '(it prints the PNG paths and any console errors; then Read the PNG), or\n' +
    '  - if no dev server or URL is available, say in one line that the change was not visually verified and why.\n' +
    'If it looks wrong, fix it before finishing.';
}

saveState(session, st, 'check');

if (problems.length || uiNote) {
  const parts = [];
  if (problems.length) {
    parts.push(
      `The project's own checks are failing after this turn's changes:\n\n${problems.join('\n\n')}\n\n` +
        'Fix these before finishing. If a failure was already broken before your changes, say so in one line and leave it alone. ' +
        'Do not disable, skip or weaken a test to make it pass.'
    );
  }
  if (uiNote) parts.push(uiNote);
  if (problems.length) logMistake('finish check: the project checks were failing at the end of a turn', input?.cwd);
  out({ decision: 'block', reason: parts.join('\n\n') });
}
process.exit(0);
