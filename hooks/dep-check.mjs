#!/usr/bin/env node
// PostToolUse (Edit|Write): when dependencies change, check them for known holes.
//
// Runs the auditor the ecosystem already ships (npm audit, pip-audit) and only speaks
// up for high/critical findings. Throttled per project so it never turns into a tax on
// editing package.json, and silent when it cannot run (no lockfile, offline, no tool).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readInput, out, projectDir, loadState, saveState, repoKey, readJson, harnessNumber, HOME } from './lib.mjs';

const THROTTLE_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 60000;
const WAIT_DAYS = harnessNumber('PACKAGE_WAIT_DAYS', 7);
const MANIFESTS = new Set(['package.json', 'requirements.txt', 'pyproject.toml']);
const NPM_CLI = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');

function capture(cmd, args, cwd, timeout = TIMEOUT_MS) {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout,
      maxBuffer: 24 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, NO_COLOR: '1' },
    });
  } catch (e) {
    // Auditors exit non-zero precisely when they find something.
    return typeof e?.stdout === 'string' && e.stdout.trim() ? e.stdout : null;
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

function auditNpm(dir) {
  const hasLock = ['package-lock.json', 'npm-shrinkwrap.json'].some((f) => fs.existsSync(path.join(dir, f)));
  if (!hasLock || !fs.existsSync(NPM_CLI)) return null;
  const raw = capture(process.execPath, [NPM_CLI, 'audit', '--json'], dir);
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const meta = data?.metadata?.vulnerabilities || {};
  const serious = (meta.high || 0) + (meta.critical || 0);
  if (!serious) return null;
  const names = Object.entries(data.vulnerabilities || {})
    .filter(([, v]) => v?.severity === 'high' || v?.severity === 'critical')
    .slice(0, 8)
    .map(([name, v]) => `  - ${name} (${v.severity})`);
  return { serious, names, fix: 'npm audit fix', tool: 'npm audit' };
}

function auditPython(dir) {
  if (!onPath('pip-audit')) return null;
  const raw = capture('pip-audit', ['-f', 'json', '--progress-spinner', 'off'], dir);
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const deps = Array.isArray(data) ? data : data?.dependencies || [];
  const hits = deps.filter((d) => Array.isArray(d?.vulns) && d.vulns.length);
  if (!hits.length) return null;
  return {
    serious: hits.length,
    names: hits.slice(0, 8).map((d) => `  - ${d.name} ${d.version || ''} (${d.vulns.map((v) => v.id).slice(0, 3).join(', ')})`),
    fix: 'pip-audit --fix',
    tool: 'pip-audit',
  };
}

// Rule 6.4a: a package version must be older than PACKAGE_WAIT_DAYS. Only dependencies that are
// new or changed since the last run are looked up (max 10), so this stays quick and read-only.
function lockedVersion(dir, name) {
  const lock = readJson(path.join(dir, 'package-lock.json'));
  return lock?.packages?.[`node_modules/${name}`]?.version || null;
}

function tooNewPackages(dir) {
  if (!fs.existsSync(NPM_CLI)) return [];
  const pkg = readJson(path.join(dir, 'package.json'));
  if (!pkg) return [];
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const key = repoKey(dir);
  const seen = loadState(key, 'depver').seen || {};
  const changed = Object.entries(deps).filter(([name, range]) => seen[name] !== range).slice(0, 10);
  const found = [];
  for (const [name] of changed) {
    const version = lockedVersion(dir, name);
    if (!version) continue;
    const raw = capture(process.execPath, [NPM_CLI, 'view', name, 'time', '--json'], dir, 8000);
    if (!raw) continue;
    let times;
    try {
      times = JSON.parse(raw);
    } catch {
      continue;
    }
    const released = Date.parse(times?.[version]);
    if (!Number.isFinite(released)) continue;
    const days = (Date.now() - released) / 86400000;
    if (days < WAIT_DAYS) found.push(`  - ${name} ${version} (released ${Math.max(0, Math.floor(days))} day(s) ago)`);
  }
  saveState(key, { seen: deps }, 'depver');
  return found;
}

const input = await readInput();
const file = input?.tool_input?.file_path;
if (!file) process.exit(0);

const abs = path.isAbsolute(file) ? file : path.resolve(input?.cwd || HOME, file);
const base = path.basename(abs).toLowerCase();
if (!MANIFESTS.has(base)) process.exit(0);

const dir = projectDir(path.dirname(abs));
if (!dir) process.exit(0);

const key = repoKey(dir);
const st = loadState(key, 'dep');
if (Date.now() - (Number(st.lastRun) || 0) < THROTTLE_MS) process.exit(0);
saveState(key, { lastRun: Date.now() }, 'dep');

const result = base === 'package.json' ? auditNpm(dir) : auditPython(dir);
const young = base === 'package.json' ? tooNewPackages(dir) : [];
if (!result && !young.length) process.exit(0);

const parts = [];
if (result) {
  parts.push(
    `Dependency check in ${dir} found ${result.serious} high/critical issue(s):\n${result.names.join('\n')}\n\n` +
      `Tell the user, in two lines: what is affected and that \`${result.fix}\` is the usual fix. ` +
      'Safe updates may be done by you (rule 6.4): patch or minor versions, older than the wait time, with the project tests passing afterwards. ' +
      'Never run a blanket auto-fix, never do a major upgrade, and never touch keys or accounts — those are the user\'s call.'
  );
}
if (young.length) {
  parts.push(
    `These dependencies are newer than PACKAGE_WAIT_DAYS (${WAIT_DAYS} days) — too new to trust yet (rule 6.4a):\n${young.join('\n')}\n` +
      'Use the previous version that is older than the wait time, tell the user which you used and why, and offer the newer one again next week.'
  );
}

out({
  systemMessage: [
    result ? `${result.tool}: ${result.serious} high/critical vulnerabilit${result.serious === 1 ? 'y' : 'ies'} in ${path.basename(dir)}.` : '',
    young.length ? `${young.length} dependenc${young.length === 1 ? 'y is' : 'ies are'} newer than ${WAIT_DAYS} days.` : '',
  ].filter(Boolean).join(' '),
  hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: parts.join('\n\n') },
});
process.exit(0);
