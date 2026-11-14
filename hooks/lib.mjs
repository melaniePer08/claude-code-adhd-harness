// lib.mjs — shared helpers for the Claude Code hooks in this folder.
//
// Rules every hook here follows:
//   1. Never break a session. Unexpected errors exit 0 and stay silent.
//   2. Never print a secret. Values read from disk stay inside this process;
//      only file names, rule names and masked snippets are ever emitted.
//   3. Be cheap. Fast string checks first, git calls only when they matter.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const HOME = os.homedir();
export const STATE_DIR = path.join(HOME, '.claude', 'hooks', 'state');

// ---------------------------------------------------------------- input/output

export function readInput(timeoutMs = 2000) {
  return new Promise((resolve) => {
    let data = '';
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    };
    const timer = setTimeout(finish, timeoutMs);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => {
      if (data.length < 8 * 1024 * 1024) data += c;
    });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      finish();
    });
    process.stdin.on('error', () => {
      clearTimeout(timer);
      finish();
    });
  });
}

export function out(obj) {
  process.stdout.write(JSON.stringify(obj));
}

/** PreToolUse: refuse the call outright. */
export function deny(reason) {
  out({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  });
}

/** PreToolUse: force a confirmation prompt for the user. */
export function askUser(reason) {
  out({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  });
}

// ---------------------------------------------------------------------- paths

export function norm(p) {
  try {
    return path.resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  } catch {
    return '';
  }
}

/** Git Bash style /c/Users/... -> C:/Users/... */
export function toWinPath(p) {
  const m = /^\/([a-zA-Z])\/(.*)$/.exec(p);
  return m ? `${m[1].toUpperCase()}:/${m[2]}` : p;
}

const HOME_N = norm(HOME);
const NEVER_A_PROJECT = new Set(
  [
    HOME,
    path.join(HOME, 'Desktop'),
    path.join(HOME, 'Documents'),
    path.join(HOME, 'Downloads'),
    path.join(HOME, 'Pictures'),
    path.join(HOME, 'Music'),
    path.join(HOME, 'Videos'),
    path.join(HOME, '.claude'),
    path.join(HOME, 'OneDrive'),
    path.join(HOME, 'AppData'),
  ].map(norm)
);

/** Home, a well-known user folder, or a drive root — never treat as a project. */
export function isProtectedDir(p) {
  const n = norm(p);
  if (!n) return true;
  if (NEVER_A_PROJECT.has(n)) return true;
  if (/^[a-z]:$/.test(n) || n === '/') return true;
  return false;
}

/** Nearest existing directory at or above p. */
export function existingDir(p) {
  let d = path.resolve(p);
  for (let i = 0; i < 40; i++) {
    try {
      if (fs.statSync(d).isDirectory()) return d;
    } catch {
      /* keep walking up */
    }
    const parent = path.dirname(d);
    if (parent === d) return null;
    d = parent;
  }
  return null;
}

// ------------------------------------------------------------------------ git

export function git(cwd, args, opts = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: opts.maxBuffer ?? 32 * 1024 * 1024,
      timeout: opts.timeout ?? 20000,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
    });
  } catch {
    return null;
  }
}

export function repoRoot(dir) {
  const d = existingDir(dir);
  if (!d) return null;
  const top = git(d, ['rev-parse', '--show-toplevel']);
  if (!top) return null;
  const root = path.resolve(top.trim());
  return isProtectedDir(root) ? null : root;
}

export function gitDir(root) {
  const d = git(root, ['rev-parse', '--absolute-git-dir']);
  return d ? path.resolve(d.trim()) : path.join(root, '.git');
}

/** Mid-merge / mid-rebase / mid-cherry-pick: leave the repo alone. */
export function gitBusy(root) {
  const d = gitDir(root);
  return ['MERGE_HEAD', 'REBASE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply'].some((f) =>
    fs.existsSync(path.join(d, f))
  );
}

/** Parsed `git status --porcelain -z` entries. */
export function statusEntries(root) {
  const raw = git(root, ['status', '--porcelain=v1', '-uall', '-z']);
  if (raw === null) return null;
  const parts = raw.split('\0');
  const entries = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p || p.length < 4) continue;
    const xy = p.slice(0, 2);
    const file = p.slice(3);
    if (xy[0] === 'R' || xy[0] === 'C' || xy[1] === 'R' || xy[1] === 'C') i++; // skip the original path
    entries.push({ xy, file });
  }
  return entries;
}

/** Cheap content-sensitive signature of the working tree. */
export function fingerprint(root) {
  const entries = statusEntries(root);
  if (entries === null) return null;
  const parts = [];
  for (const e of entries.slice(0, 5000)) {
    let stat = 'gone';
    try {
      const st = fs.statSync(path.join(root, e.file));
      stat = `${st.size}:${Math.round(st.mtimeMs)}`;
    } catch {
      /* deleted */
    }
    parts.push(`${e.xy} ${e.file} ${stat}`);
  }
  return crypto.createHash('sha1').update(parts.join('\n')).digest('hex');
}

/** Unpushed commit count plus how to name that range to git. */
export function unpushed(root) {
  const branch = (git(root, ['symbolic-ref', '--short', '-q', 'HEAD']) || '').trim();
  if (!branch) return null; // detached HEAD
  const upstream = (git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']) || '').trim();
  if (upstream) {
    const c = parseInt((git(root, ['rev-list', '--count', `${upstream}..HEAD`]) || '0').trim(), 10);
    return { branch, upstream, count: Number.isFinite(c) ? c : 0, range: [`${upstream}..HEAD`] };
  }
  const origin = git(root, ['remote', 'get-url', 'origin']);
  if (!origin) return { branch, upstream: null, count: 0, range: null, noRemote: true };
  const c = parseInt((git(root, ['rev-list', '--count', 'HEAD', '--not', '--remotes=origin']) || '0').trim(), 10);
  return { branch, upstream: null, count: Number.isFinite(c) ? c : 0, range: ['HEAD', '--not', '--remotes=origin'] };
}

/** https://user:token@github.com/x -> https://github.com/x */
export function maskRemote(url) {
  return String(url || '').replace(/\/\/[^/@\s]+@/, '//');
}

// ---------------------------------------------------------------- session state

export function stateFile(sessionId, kind = 'git') {
  const id = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'unknown';
  return path.join(STATE_DIR, `${id}.${kind}.json`);
}

export function loadState(sessionId, kind = 'git') {
  try {
    return JSON.parse(fs.readFileSync(stateFile(sessionId, kind), 'utf8'));
  } catch {
    return {};
  }
}

export function saveState(sessionId, state, kind = 'git') {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    const target = stateFile(sessionId, kind);
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, target);
  } catch {
    /* state is best effort */
  }
}

export function pruneState(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  try {
    const now = Date.now();
    for (const f of fs.readdirSync(STATE_DIR)) {
      const p = path.join(STATE_DIR, f);
      try {
        if (now - fs.statSync(p).mtimeMs > maxAgeMs) fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* no state dir yet */
  }
}

// -------------------------------------------------------------- shell commands

/** Drop heredoc bodies and -m "..." message text so their contents can't trip pattern matches. */
export function stripNoise(cmd) {
  let s = String(cmd || '');
  s = s.replace(/<<-?\s*'?"?([A-Za-z_][A-Za-z0-9_]*)'?"?[\s\S]*?^\s*\1\s*$/gm, ' <<heredoc>> ');
  s = s.replace(/(-m|--message|-am)\s+"(?:[^"\\]|\\.)*"/g, '$1 "msg"');
  s = s.replace(/(-m|--message|-am)\s+'(?:[^'\\]|\\.)*'/g, "$1 'msg'");
  return s;
}

/** Split a command line into separately-executed pieces. */
export function splitSegments(cmd) {
  return String(cmd || '')
    .split(/&&|\|\||[;\n|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Minimal shell-ish tokenizer: keeps quoted paths in one piece. */
export function tokenize(seg) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(String(seg || ''))) !== null) tokens.push(m[1] ?? m[2] ?? m[3]);
  return tokens;
}

/** Where a shell command actually runs: honours `git -C <dir>` and a leading `cd <dir> &&`. */
export function commandCwd(clean, cwd) {
  const pick = (m) => (m ? m[1] || m[2] || m[3] : null);
  const p =
    pick(/\bgit\s+-C\s+(?:"([^"]+)"|'([^']+)'|(\S+))/.exec(clean)) ||
    pick(/(?:^|[;&|]\s*)cd\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*(?:&&|;)/.exec(clean));
  if (!p) return cwd;
  if (/^~/.test(p)) return path.join(HOME, p.slice(1));
  if (/^\/[a-zA-Z]\//.test(p)) return toWinPath(p);
  return path.isAbsolute(p) ? p : path.resolve(cwd, p);
}

// ------------------------------------------------------------ secret detection

export const SECRET_PATTERNS = [
  { name: 'private key block', re: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/ },
  { name: 'AWS access key id', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/ },
  { name: 'Stripe secret key', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b/ },
  { name: 'Stripe webhook secret', re: /\bwhsec_[A-Za-z0-9]{24,}\b/ },
  { name: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{30,}/ },
  { name: 'Figma access token', re: /\bfigd_[A-Za-z0-9_-]{30,}/ },
  { name: 'Google service-account key file', re: /"type"\s*:\s*"service_account"/ },
  { name: 'GitLab token', re: /\bglpat-[A-Za-z0-9_-]{20,}/ },
  { name: 'Hugging Face token', re: /\bhf_[A-Za-z0-9]{34,}\b/ },
  { name: 'Notion token', re: /\b(?:ntn_[A-Za-z0-9]{30,}|secret_[A-Za-z0-9]{43})\b/ },
  { name: 'Supabase token', re: /\bsbp_[a-f0-9]{40}\b/ },
  { name: 'OpenAI API key', re: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9]{32,}/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Slack token', re: /\bxox[abopsr]-[A-Za-z0-9-]{12,}/ },
  { name: 'SendGrid API key', re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/ },
  { name: 'npm token', re: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { name: 'Postgres/MySQL URL with password', re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/]+:[^\s:@/]{6,}@/ },
];

const SECRET_NAME_RE = /SECRET|PASSWORD|PASSWD|API_?KEY|APIKEY|PRIVATE_?KEY|ACCESS_?KEY|CLIENT_?SECRET|AUTH_?TOKEN|ACCESS_?TOKEN|CREDENTIAL/i;  // secret-scan: allow (a pattern, not a value)

const PLACEHOLDER_RE =
  /^(?:\$|\{|<|\(|process\.env|import\.meta|os\.environ|env\[|your[-_ ]?|my[-_ ]?|x{3,}|\*{3,}|\.{3,}|change[-_ ]?me|placeholder|example|sample|dummy|fake|test[-_ ]?(?:key|value)|replace|insert|todo|tbd|none|null|nil|undefined|true|false|localhost|https?:\/\/(?:localhost|127\.)|sk_test_xxx)/i;

const LOCKFILE_RE = /(?:^|[/\\])(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Cargo\.lock|composer\.lock|Gemfile\.lock|go\.sum)$/i;

export function isExampleName(base) {
  const b = String(base || '').toLowerCase();
  return /(?:\.|-|_)(?:example|examples|sample|samples|template|templates|dist|default|defaults|tpl)(?:\.[\w-]+)?$/.test(b) || b.includes('example');
}

export function isDotenvName(base) {
  const b = String(base || '').toLowerCase();
  return /^\.env(?:\.[\w-]+)*$/.test(b) && !isExampleName(b);
}

/** File names that should never reach a commit. */
export function isSecretFilename(p) {
  const b = path.basename(String(p || '')).toLowerCase();
  if (!b || isExampleName(b)) return false;
  if (isDotenvName(b)) return true;
  if (/^id_(?:rsa|dsa|ecdsa|ed25519)$/.test(b)) return true;
  if (/\.(?:p12|pfx|jks|keystore)$/.test(b)) return true;
  if (/^\.?credentials(?:\.json)?$/.test(b)) return true;
  if (/^secrets?\.(?:json|ya?ml|toml|env|txt)$/.test(b)) return true;
  if (/^service[-_]?account.*\.json$/.test(b)) return true;
  if (/firebase[-_]?adminsdk.*\.json$/.test(b)) return true;
  return false;
}

/** Files worth protecting from reads/edits (adds key material to the list above). */
export function isSecretishFile(p) {
  const b = path.basename(String(p || '')).toLowerCase();
  return isSecretFilename(p) || (/\.(?:pem|key|ppk|asc)$/.test(b) && !isExampleName(b));
}

function mask(line, matched) {
  const text = String(line).trim().slice(0, 160);
  const hit = String(matched || '');
  const safe = hit.length > 6 ? `${hit.slice(0, 3)}***${hit.slice(-2)}` : '***';
  return (hit ? text.split(hit).join(safe) : text).slice(0, 120);
}

/** Scan one line. Returns findings with the secret itself masked. */
export function scanLine(text, file = '') {
  const line = String(text || '');
  if (!line.trim()) return [];
  if (/secret-scan:\s*allow|pragma:\s*allowlist secret/i.test(line)) return [];
  const findings = [];
  for (const { name, re } of SECRET_PATTERNS) {
    const m = re.exec(line);
    if (m) findings.push({ rule: name, file, snippet: mask(line, m[0]) });
  }
  if (findings.length) return findings;
  if (LOCKFILE_RE.test(file) || isExampleName(path.basename(file || ''))) return findings;

  const re = /([A-Za-z_][A-Za-z0-9_]{2,})\s*[:=]\s*(["'`]?)([^\s"'`,;#)}\]]{12,})\2/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const [, name, , value] = m;
    if (name !== name.toUpperCase()) continue; // CONSTANT_CASE only, keeps false positives down
    if (!SECRET_NAME_RE.test(name)) continue;
    if (PLACEHOLDER_RE.test(value)) continue;
    if (!/[0-9]/.test(value) && !/[a-z]/.test(value)) continue;
    findings.push({ rule: `hard-coded value for ${name}`, file, snippet: mask(line, value) });
    break;
  }
  return findings;
}

/** Scan unified diff text; only added lines count. */
export function scanDiff(diff) {
  const findings = [];
  const seenFiles = new Set();
  let file = '';
  for (const line of String(diff || '').split('\n')) {
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).trim();
      file = p === '/dev/null' ? '' : p.replace(/^b\//, '');
      if (file && !seenFiles.has(file) && isSecretFilename(file)) {
        seenFiles.add(file);
        findings.push({ rule: 'secrets file should never be committed', file, snippet: '' });
      }
      continue;
    }
    if (!file || line.startsWith('+++') || !line.startsWith('+')) continue;
    for (const f of scanLine(line.slice(1), file)) {
      if (findings.length < 25) findings.push(f);
    }
    if (findings.length >= 25) break;
  }
  return findings;
}

export function scanFile(abs, relName) {
  try {
    const st = fs.statSync(abs);
    if (!st.isFile() || st.size > 1024 * 1024) return [];
    const buf = fs.readFileSync(abs);
    if (buf.includes(0)) return []; // binary
    const findings = [];
    if (isSecretFilename(relName || abs)) findings.push({ rule: 'secrets file should never be committed', file: relName || abs, snippet: '' });
    for (const line of buf.toString('utf8').split('\n')) {
      for (const f of scanLine(line, relName || abs)) {
        if (findings.length < 25) findings.push(f);
      }
      if (findings.length >= 25) break;
    }
    return findings;
  } catch {
    return [];
  }
}

export function describeFindings(findings) {
  const seen = new Set();
  const lines = [];
  for (const f of findings) {
    const key = `${f.file}|${f.rule}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`  - ${f.file || '(file)'}: ${f.rule}${f.snippet ? `  [${f.snippet}]` : ''}`);
    if (lines.length >= 12) break;
  }
  return lines.join('\n');
}

/** Does a .env-style text hold a real value (not blank, not a placeholder)? */
export function dotenvHasRealValue(text) {
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    const q = /^(['"])([\s\S]*)\1$/.exec(v);
    if (q) v = q[2];
    else v = v.replace(/\s+#.*$/, '').trim();
    if (!v) continue;
    if (PLACEHOLDER_RE.test(v)) continue;
    return true;
  }
  return false;
}

// ------------------------------------------------------------- project shape

const PROJECT_MARKERS = [
  'package.json', 'pyproject.toml', 'requirements.txt', 'go.mod', 'Cargo.toml',
  'pom.xml', 'build.gradle', 'build.gradle.kts', 'Gemfile', 'composer.json', '.git',
];

export function findUpDir(from, test, limit = 25) {
  let dir = existingDir(from);
  if (!dir) return null;
  for (let i = 0; i < limit; i++) {
    try {
      if (test(dir)) return dir;
    } catch {
      /* unreadable directory */
    }
    if (norm(dir) === HOME_N) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

/** Nearest folder that looks like the root of a project. */
export function projectDir(dir) {
  return findUpDir(dir, (d) => PROJECT_MARKERS.some((m) => fs.existsSync(path.join(d, m))));
}

export function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** Stable short id for a repo, so state can outlive a single session. */
export function repoKey(root) {
  return crypto.createHash('sha1').update(norm(root)).digest('hex').slice(0, 16);
}

/** Generated or vendored paths — they say nothing about the quality of the work. */
export const NOISE_RE = /(?:^|[/\\])(?:node_modules|dist|build|out|coverage|\.next|\.nuxt|\.svelte-kit|vendor|\.venv|venv|__pycache__|\.min\.)/i;

export function isLockfile(p) {
  return LOCKFILE_RE.test(String(p || ''));
}

/** numstat path, with rename syntax (`a/{b => c}/d.js`) reduced to the new path. */
function numstatPath(raw) {
  let p = String(raw || '');
  if (p.includes('=>')) {
    p = p.replace(/\{([^{}]*)\s*=>\s*([^{}]*)\}/g, '$2').replace(/^.*\s=>\s/, '');
    p = p.replace(/\/{2,}/g, '/');
  }
  return p.trim();
}

/** Size of a diff range, ignoring lockfiles and build output. */
export function diffSize(root, range) {
  const raw = git(root, ['diff', '--numstat', '--no-color', ...range]);
  if (raw === null) return null;
  const paths = [];
  let lines = 0;
  for (const line of raw.split('\n')) {
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line.replace(/\r$/, ''));
    if (!m) continue;
    const file = numstatPath(m[3]);
    if (!file || isLockfile(file) || NOISE_RE.test(file)) continue;
    paths.push(file);
    lines += (parseInt(m[1], 10) || 0) + (parseInt(m[2], 10) || 0);
  }
  return { files: paths.length, lines, paths };
}

// -------------------------------------------------------------------- logging

export const LOG_DIR = path.join(HOME, '.claude', 'logs');

export function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Append a line to ~/.claude/logs/<name>. Never throws, never writes a secret. */
export function appendLog(name, text) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIR, name), `${text}\n`, 'utf8');
  } catch {
    /* logging is best effort */
  }
}

export function pruneLogs(maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
  try {
    const now = Date.now();
    for (const f of fs.readdirSync(LOG_DIR)) {
      const p = path.join(LOG_DIR, f);
      try {
        if (now - fs.statSync(p).mtimeMs > maxAgeMs) fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* no log dir yet */
  }
}

/** Replace anything that looks like a credential with a masked stand-in. */
export function redact(text) {
  let s = String(text || '');
  for (const { re } of SECRET_PATTERNS) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    s = s.replace(g, (m) => (m.length > 6 ? `${m.slice(0, 3)}***${m.slice(-2)}` : '***'));
  }
  s = s.replace(/((?:SECRET|PASSWORD|API_?KEY|TOKEN|CREDENTIAL)[A-Z0-9_]*\s*[:=]\s*)(["']?)([^\s"']{6,})\2/gi, '$1$2***$2');
  return s;
}

/**
 * How sensitive is this file right now?
 *   missing   - not on disk
 *   empty     - exists but holds no real secret (a skeleton Claude may write)
 *   protected - holds real secret material
 */
export function secretFileState(abs) {
  const base = path.basename(abs).toLowerCase();
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    return 'missing';
  }
  if (!st.isFile()) return 'none';
  if (st.size > 2 * 1024 * 1024) return 'protected';
  let text = '';
  try {
    const buf = fs.readFileSync(abs);
    if (buf.includes(0)) return 'protected'; // binary key material
    text = buf.toString('utf8');
  } catch {
    return 'protected';
  }
  if (isDotenvName(base)) return dotenvHasRealValue(text) ? 'protected' : 'empty';
  if (/\.(?:pem|key|ppk|asc)$/.test(base)) return /PRIVATE KEY|BEGIN OPENSSH/.test(text) ? 'protected' : 'none';
  return text.trim() ? 'protected' : 'empty';
}

// ------------------------------------------------------------ harness settings

/**
 * Read one value from harness-settings.md (a table row like: | `START_RAM_GB` | 4 | meaning |).
 * Looks in the installed location first, then next to the hooks. Returns `fallback` if the
 * value is empty or missing, so a half-filled settings file never breaks a hook.
 */
export function harnessSetting(name, fallback) {
  const candidates = [
    path.join(HOME, '.claude', 'harness', 'harness-settings.md'),
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'harness-settings.md'),
  ];
  for (const file of candidates) {
    try {
      const text = fs.readFileSync(file, 'utf8');
      // A table row such as:  | `START_RAM_GB` | 4 | meaning |   (\x60 is the backtick)
      const m = new RegExp(String.raw`\|\s*[\x60]${name}[\x60]\s*\|\s*([^|]*?)\s*\|`).exec(text);
      if (m && m[1]) return m[1];
    } catch {
      /* try the next place */
    }
  }
  return fallback;
}

export function harnessNumber(name, fallback) {
  const n = Number(harnessSetting(name, fallback));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ------------------------------------------------------------- mistakes log

export const HARNESS_DIR = path.join(HOME, '.claude', 'harness');

/**
 * Add one line to mistakes-log.md (rule 11.1): date · who · project · what went wrong.
 * Never throws, never records a secret (redacted first), keeps only the last ~100 lines.
 */
export function logMistake(what, cwd = '', who = 'hook') {
  try {
    fs.mkdirSync(HARNESS_DIR, { recursive: true });
    const file = path.join(HARNESS_DIR, 'mistakes-log.md');
    const project = cwd ? path.basename(String(cwd)) || '-' : '-';
    const line = `${stamp()} · ${who} · ${project} · ${redact(String(what)).replace(/\s+/g, ' ').slice(0, 200)}`;
    let lines = [];
    try {
      lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    } catch {
      /* first entry */
    }
    // The same blocked thing twice in a row is one mistake, not two.
    if (lines[lines.length - 1] === line) return;
    lines.push(line);
    fs.writeFileSync(file, `${lines.slice(-100).join('\n')}\n`, 'utf8');
  } catch {
    /* logging is best effort */
  }
}
