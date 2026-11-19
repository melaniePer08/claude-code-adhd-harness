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
  // Quote-aware: a |, ; or && INSIDE quotes (a grep pattern, a message) is text, not a new command.
  const s = String(cmd || '');
  const out = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      cur += c;
      if (c === '\\' && quote === '"' && i + 1 < s.length) cur += s[++i];
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '\\' && i + 1 < s.length) {
      cur += c + s[++i];
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if ((c === '&' && s[i + 1] === '&') || (c === '|' && s[i + 1] === '|')) {
      out.push(cur);
      cur = '';
      i++;
      continue;
    }
    if (c === ';' || c === '\n' || c === '|') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
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
  { name: 'OpenAI API key', re: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Slack token', re: /\bxox[abopsr]-[A-Za-z0-9-]{12,}/ },
  { name: 'SendGrid API key', re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/ },
  { name: 'npm token', re: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { name: 'Postgres/MySQL URL with password', re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/]+:[^\s:@/]{6,}@/ },
];

const SECRET_NAME_RE = /SECRET|PASSWORD|PASSWD|API_?KEY|APIKEY|PRIVATE_?KEY|ACCESS_?KEY|CLIENT_?SECRET|AUTH_?TOKEN|ACCESS_?TOKEN|CREDENTIAL/i;  // secret-scan: allow (a pattern, not a value)

// A value counts as a placeholder only when the WHOLE value is one. Matching just the start
// (the old rule) let real passwords like "mypassword123" or "nullable-Pass9" through unprotected.
const PLACEHOLDER_RE = new RegExp(
  [
    String.raw`\$\{[^}]*\}`, // ${VAR}
    String.raw`\$\([^)]*\)`, // $(command)
    String.raw`\{\{[^}]*\}\}`, // {{ template }}
    String.raw`<[^>]*>`, // <your-key-here>
    String.raw`(?:process\.env|import\.meta\.env|os\.environ|os\.getenv)\b[\w.\[\]'"()]*`, // reads from the environment
    String.raw`(?:your|my)[-_ ][A-Za-z_ -]*(?:key|token|secret|password|id|here|value)[A-Za-z_ -]*`, // your_api_key_here (letters only, no digits)
    String.raw`x{3,}|\*{3,}|\.{3,}`, // xxxx  ****  ...
    String.raw`sk_(?:live|test)_x+`,
    String.raw`(?:changeme|change-me|change_me|replace-?me|replace|insert|placeholder|example|sample|dummy|fake|none|null|nil|undefined|true|false|todo|tbd)(?:[-_ ](?:key|value|token|secret|password|here|me))*\d*`,
    String.raw`test[-_ ]?(?:key|value)\d*`,
    String.raw`localhost(?::\d+)?`,
    String.raw`https?:\/\/(?:localhost|127\.).*`,
  ]
    .map((p) => `(?:${p})`)
    .join('|')
    .replace(/^/, '^(?:')
    .concat(')$'),
  'i'
);
// $VAR must be ALL CAPS to count (case-sensitive), so a password like "$ecretValue123" is not mistaken for one.
const ENV_VAR_RE = /^\$[A-Z_][A-Z0-9_]*$/;
const isPlaceholder = (v) => PLACEHOLDER_RE.test(v) || ENV_VAR_RE.test(v);

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
    if (isPlaceholder(value)) continue;
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
    if (isPlaceholder(v)) continue;
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

// ------------------------------------------------------- explaining commands (moved from explain-gate)
// Shared so BOTH explain-gate and block-dangerous can put a plain explanation into the approval prompt.

// ------------------------------------------------------------------ vocabulary

const PROGRAM = {
  rm: 'deletes files for good (no recycle bin)',
  del: 'deletes files for good (no recycle bin)',
  erase: 'deletes files for good (no recycle bin)',
  rmdir: 'deletes folders',
  rd: 'deletes folders',
  'remove-item': 'deletes files or folders for good (no recycle bin)',
  ri: 'deletes files or folders for good (no recycle bin)',
  mv: 'moves or renames, replacing anything with the same name',
  move: 'moves or renames, replacing anything with the same name',
  'move-item': 'moves or renames, replacing anything with the same name',
  'rename-item': 'renames a file or folder',
  kill: 'stops a running program',
  pkill: 'stops running programs by name',
  killall: 'stops running programs by name',
  taskkill: 'stops running programs',
  'stop-process': 'stops running programs',
  curl: 'talks to a web address (downloads, or uploads if given data)',
  wget: 'downloads from a web address',
  iwr: 'talks to a web address (downloads, or uploads if given a body)',
  irm: 'talks to a web address and reads the answer',
  'invoke-webrequest': 'talks to a web address (downloads, or uploads if given a body)',
  'invoke-restmethod': 'talks to a web address and reads the answer',
  iex: 'RUNS text as a command — whatever it contains will execute',
  'invoke-expression': 'RUNS text as a command — whatever it contains will execute',
  sudo: 'runs the command with administrator rights',
  chmod: 'changes who may read, write or run files',
  chown: 'changes who owns files',
  icacls: 'changes file permissions on Windows',
  takeown: 'takes ownership of files on Windows',
  'set-executionpolicy': 'changes which PowerShell scripts Windows allows to run',
  reg: 'edits the Windows registry (system settings)',
  setx: 'permanently changes an environment variable',
  schtasks: 'creates or changes a scheduled (automatic, background) task',
  'register-scheduledtask': 'creates a scheduled (automatic, background) task',
  crontab: 'edits the list of scheduled (automatic, background) jobs',
  'start-process': 'starts another program (possibly hidden, running in the background)',
  nohup: 'keeps a program running in the background',
  docker: 'runs containers (isolated programs) — can use a lot of memory and disk',
  winget: 'installs, changes or removes programs on the computer',
  choco: 'installs, changes or removes programs on the computer',
  scoop: 'installs, changes or removes programs on the computer',
  brew: 'installs, changes or removes programs on the computer',
  apt: 'installs, changes or removes programs on the computer',
  'apt-get': 'installs, changes or removes programs on the computer',
  npm: 'the JavaScript package manager',
  pnpm: 'the JavaScript package manager',
  yarn: 'the JavaScript package manager',
  bun: 'the JavaScript runtime and package manager',
  npx: 'downloads a package and RUNS it right away',
  pip: 'the Python package manager',
  pip3: 'the Python package manager',
  cargo: 'the Rust package manager',
  gem: 'the Ruby package manager',
  git: 'the version-control tool (saves and shares your code history)',
  gh: 'the GitHub command-line tool',
  vercel: 'deploys to Vercel (puts a site online)',
  netlify: 'deploys to Netlify (puts a site online)',
  wrangler: 'deploys to Cloudflare (puts a site online)',
  firebase: 'deploys to Firebase (puts a site online)',
  scp: 'copies files to or from another computer over the network',
  rsync: 'copies and syncs files, possibly to another computer',
  ssh: 'runs commands on another computer',
};

const INSTALL_VERBS = new Set(['install', 'i', 'add', 'remove', 'rm', 'uninstall', 'un', 'update', 'upgrade', 'up', 'ci', 'publish', 'link', 'dlx', 'exec']);
const DEPLOY = new Set(['vercel', 'netlify', 'wrangler', 'firebase', 'scp', 'rsync']);

const FLAGS = {
  // rm / Remove-Item / del
  r: 'goes inside folders too',
  recurse: 'goes inside folders too',
  f: 'no questions asked; ignores missing or read-only files',
  force: 'no questions asked; overrides protections',
  i: 'asks before each deletion',
  v: 'lists each item as it goes',
  // git
  hard: 'throws away ALL uncommitted changes — cannot be undone',
  soft: 'moves the saved point back but keeps your changes',
  amend: 'rewrites the last commit',
  'force-with-lease': 'overwrites the remote branch if nobody else changed it',
  delete: 'deletes it',
  prune: 'permanently removes unreachable data',
  // npm and friends
  g: 'global: installs for the whole computer, not just this project',
  global: 'global: installs for the whole computer, not just this project',
  d: 'dev dependency (only needed while building)',
  y: 'answers "yes" to every question automatically',
  yes: 'answers "yes" to every question automatically',
  'save-dev': 'dev dependency (only needed while building)',
  // curl
  o: 'saves the answer to a file',
  outfile: 'saves the answer to a file',
  x: 'sets the request type (POST/PUT/DELETE send or change data)',
  method: 'sets the request type (POST/PUT/DELETE send or change data)',
  data: 'sends this data to the address',
  body: 'sends this data to the address',
  k: 'skips the safety check of the website certificate (unsafe)',
  l: 'follows redirects',
  s: 'quiet mode',
  // taskkill / kill
  im: 'stops every program with this name',
  t: 'also stops the programs it started',
  '9': 'forces the program to stop immediately',
};

// ------------------------------------------------------------------- risk rules

function gitRisk(t) {
  const sub = t.find((x, i) => i > 0 && !x.startsWith('-') && !/^-C$/i.test(t[i - 1]));
  const flags = t.filter((x) => x.startsWith('-'));
  const has = (...f) => flags.some((x) => f.includes(x));
  switch (sub) {
    case 'reset': return has('--hard') ? 'discards all uncommitted changes' : null;
    case 'push': return has('--force', '-f', '--force-with-lease', '--delete', '-d', '--mirror') || t.some((x) => /^\+/.test(x)) ? 'overwrites or deletes things on GitHub' : null;
    case 'clean': return has('-f', '-fd', '-fx', '-fdx', '--force') ? 'deletes untracked files for good' : null;
    case 'branch': return has('-D', '-d', '--delete', '-M', '-m') ? 'deletes or renames a branch' : null;
    case 'rebase': case 'filter-branch': case 'filter-repo': return 'rewrites history';
    case 'checkout': return t.includes('--') ? 'discards uncommitted changes in files' : null;
    case 'restore': return has('--staged') && !has('--worktree') ? null : 'discards uncommitted changes in files';
    case 'commit': return has('--amend') ? 'rewrites the last commit' : null;
    case 'stash': return t.includes('drop') || t.includes('clear') ? 'deletes saved stashes' : null;
    case 'tag': return has('-d', '--delete', '-f') ? 'deletes or moves a tag' : null;
    case 'reflog': case 'gc': return t.includes('expire') || has('--prune', '--prune=now') ? 'permanently removes recoverable history' : null;
    case 'remote': return t.includes('add') || t.includes('set-url') || t.includes('remove') ? 'changes where code is sent' : null;
    default: return null;
  }
}

// Leading VAR=value words only set a variable for this one command; the real program comes after them.
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;
const stripEnv = (t) => {
  let i = 0;
  while (i < t.length && ENV_ASSIGN.test(t[i])) i++;
  return t.slice(i);
};
// Redirections (2>&1, > file, >> file, < file) say where output goes; they are not arguments.
const REDIRECT = /^(?:&>>?|\d*>&\d+|\d*>&-|\d*>>?|\d*<)(.*)$/;

export function riskOf(t0, raw) {
  const t = stripEnv(t0);
  const prog = path.basename(t[0] || '').toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, '');
  const rest = t.slice(1);
  const lower = rest.map((x) => x.toLowerCase());
  const has = (...w) => lower.some((x) => w.includes(x));
  if (['rm', 'del', 'erase', 'rmdir', 'rd', 'remove-item', 'ri'].includes(prog)) return 'deletes files or folders';
  if (['mv', 'move', 'move-item', 'rename-item'].includes(prog)) return has('-f', '-force') ? 'moves and overwrites' : null;
  if (['kill', 'pkill', 'killall', 'taskkill', 'stop-process'].includes(prog)) return 'stops running programs';
  if (['iex', 'invoke-expression'].includes(prog)) return 'runs text as a command';
  if (['curl', 'wget', 'iwr', 'irm', 'invoke-webrequest', 'invoke-restmethod'].includes(prog)) {
    const sends = lower.some((x) => ['-d', '--data', '--data-raw', '--data-binary', '-f', '--form', '-t', '--upload-file', '-body', '-infile', '--post-data'].includes(x)) ||
      lower.some((x, i) => ['-x', '--request', '-method'].includes(x) && /^(post|put|delete|patch)$/.test(lower[i + 1] || ''));
    return sends ? 'sends data to an online service' : null;
  }
  if (['sudo', 'set-executionpolicy', 'reg', 'setx', 'icacls', 'takeown', 'schtasks', 'register-scheduledtask', 'crontab', 'nohup'].includes(prog)) return PROGRAM[prog];
  if (prog === 'chmod' || prog === 'chown') return has('-r', '--recursive') ? 'changes permissions on many files' : null;
  if (prog === 'start-process') return has('-windowstyle') && has('hidden') ? 'starts a hidden background program' : null;
  if (DEPLOY.has(prog)) return 'sends files to an outside service';
  if (['winget', 'choco', 'scoop', 'brew', 'apt', 'apt-get'].includes(prog)) return has('install', 'uninstall', 'upgrade', 'remove', 'update') ? 'installs or removes programs' : null;
  if (['npm', 'pnpm', 'yarn', 'bun'].includes(prog)) {
    const verb = lower.find((x) => !x.startsWith('-'));
    if (verb === 'publish') return 'publishes a package for the whole world';
    return INSTALL_VERBS.has(verb) && !['exec', 'dlx', 'link'].includes(verb) ? 'installs, changes or removes packages' : verb === 'exec' || verb === 'dlx' ? 'downloads and runs a package' : null;
  }
  if (prog === 'npx') return 'downloads a package and runs it';
  if (['pip', 'pip3'].includes(prog)) return has('install', 'uninstall') ? 'installs or removes packages' : null;
  if (prog === 'cargo') return has('install', 'add', 'publish') ? 'installs packages' : null;
  if (prog === 'gem') return has('install', 'uninstall') ? 'installs packages' : null;
  if (prog === 'go') return has('install') ? 'installs a program' : null;
  if (prog === 'docker') return has('rm', 'rmi', 'prune', 'push', 'run', 'up', 'build', 'compose') ? 'runs or removes containers or images' : null;
  if (prog === 'gh') return (lower[0] === 'repo' && has('delete', 'create', 'edit')) || (lower[0] === 'release') || (lower[0] === 'api' && lower.some((x, i) => ['-x', '--method'].includes(x) && /^(post|put|delete|patch)$/.test(lower[i + 1] || ''))) ? 'changes things on GitHub' : null;
  if (prog === 'git') return gitRisk(t);
  if (/\|\s*(?:sh|bash|zsh|pwsh|powershell|iex)\b/i.test(raw)) return 'pipes downloaded text straight into a shell';
  return null;
}

// -------------------------------------------------------------------- decoding

const GIT_FLAGS = { D: 'deletes the branch even if it is not merged', d: 'deletes the branch (only if it is merged)', f: 'force: overrides safety checks', n: 'dry run: only shows what would happen' };

function decodeFlag(tok, prog) {
  const out = [];
  const lookup = (ch) => (prog === 'git' && GIT_FLAGS[ch]) || FLAGS[ch] || FLAGS[ch.toLowerCase()];
  if (tok.startsWith('--')) {
    const name = tok.slice(2).split('=')[0].toLowerCase();
    out.push([tok, FLAGS[name]]);
  } else if (/^-[A-Za-z]{2,}$/.test(tok) && ['rm', 'git', 'curl', 'ls', 'cp', 'mv', 'kill', 'chmod', 'npm'].includes(prog)) {
    for (const ch of tok.slice(1)) out.push([`-${ch}`, lookup(ch)]);
  } else if (tok.startsWith('-')) {
    out.push([tok, lookup(tok.slice(1))]);
  }
  return out.filter(([, d]) => d);
}

function explainRedirect(tok, dest, cwd) {
  const outside = (p) => {
    if (!p || !/^(?:~|[A-Za-z]:|\/|\\|\.\.)/.test(p) || p === '/dev/null') return '';
    const abs = p.startsWith('~') ? path.join(HOME, p.slice(1)) : path.resolve(cwd || HOME, p);
    const rel = path.relative(cwd || HOME, abs);
    return rel.startsWith('..') || path.isAbsolute(rel) ? '  ⚠️ outside the project folder' : '';
  };
  if (/^\d*>&\d+$/.test(tok)) return `    \`${tok}\` — error messages are merged into the normal output`;
  if (dest === '/dev/null' || /^nul$/i.test(dest || '')) return `    \`${tok} ${dest}\` — the output is thrown away`;
  if (/>>$/.test(tok)) return `    \`${tok} ${dest || ''}\` — adds the output to the END of that file${outside(dest)}`;
  if (/>$/.test(tok)) return `    \`${tok} ${dest || ''}\` — writes the output into that file, REPLACING it if it already exists${outside(dest)}`;
  if (/<$/.test(tok)) return `    \`${tok} ${dest || ''}\` — reads the input from that file${outside(dest)}`;
  return `    \`${tok}\` — a redirection`;
}

// What the "action" word after a program really does, in plain words. Key = family:verb.
const PKG_FAMILY = { npm: 'npm', pnpm: 'npm', yarn: 'npm', bun: 'npm' };
const ACTION_PROGRAMS = new Set(['git', 'npm', 'pnpm', 'yarn', 'bun', 'pip', 'pip3', 'cargo', 'docker', 'gh', 'winget', 'choco', 'scoop', 'brew', 'apt', 'apt-get', 'gem', 'go']);
const ACTIONS = {
  'npm:install': 'downloads packages from the npm website into the node_modules folder and edits package.json and the lock file',
  'npm:i': 'short for install: downloads packages into node_modules and edits package.json and the lock file',
  'npm:add': 'downloads a package into node_modules and adds it to package.json',
  'npm:ci': 'installs exactly what the lock file says, deleting node_modules first',
  'npm:uninstall': 'removes a package from node_modules and package.json',
  'npm:remove': 'removes a package from node_modules and package.json',
  'npm:update': 'upgrades packages to newer versions (changes node_modules and the lock file)',
  'npm:upgrade': 'upgrades packages to newer versions (changes node_modules and the lock file)',
  'npm:publish': 'uploads this project as a public package for the whole world',
  'npm:exec': 'downloads a package and runs it immediately',
  'npm:dlx': 'downloads a package and runs it immediately',
  'npm:run': 'runs one of the scripts defined in this project\'s package.json',
  'npm:test': 'runs this project\'s tests',
  'npm:start': 'starts this project',
  'npm:audit': 'checks installed packages against a list of known security problems (read-only unless "fix" is added)',
  'git:add': 'marks files to be included in the next save point (commit)',
  'git:commit': 'saves a snapshot of the marked files into the project history (local only)',
  'git:push': 'uploads your commits to GitHub',
  'git:pull': 'downloads new commits from GitHub and merges them into your files',
  'git:fetch': 'downloads new commits from GitHub without changing your files',
  'git:clone': 'downloads a whole copy of a repository into a new folder',
  'git:checkout': 'switches branch, or restores files from the history',
  'git:switch': 'switches to another branch',
  'git:restore': 'restores files to an earlier state (can throw away your unsaved edits)',
  'git:reset': 'moves the branch pointer back; with --hard it also throws away unsaved edits',
  'git:clean': 'deletes files git does not track',
  'git:stash': 'puts unsaved edits aside (or brings them back)',
  'git:rebase': 'rewrites commits to replay them on top of another branch',
  'git:merge': 'combines another branch into the current one',
  'git:branch': 'lists, creates, renames or deletes branches',
  'git:remote': 'shows or changes which GitHub address this project sends code to',
  'git:tag': 'lists, creates or deletes named markers on commits',
  'git:init': 'turns this folder into a git repository (creates a hidden .git folder)',
  'git:status': 'shows what changed (read-only)',
  'git:log': 'shows the history (read-only)',
  'git:diff': 'shows the exact changes (read-only)',
  'git:config': 'reads or changes git settings (name, email, ...)',
  'pip:install': 'downloads Python packages from the internet and installs them',
  'pip3:install': 'downloads Python packages from the internet and installs them',
  'pip:uninstall': 'removes Python packages',
  'winget:install': 'downloads and installs a program on the whole computer',
  'winget:uninstall': 'removes a program from the whole computer',
  'winget:upgrade': 'updates installed programs',
  'choco:install': 'downloads and installs a program on the whole computer',
  'scoop:install': 'downloads and installs a program',
  'brew:install': 'downloads and installs a program',
  'apt:install': 'downloads and installs a program on the whole computer',
  'apt-get:install': 'downloads and installs a program on the whole computer',
  'cargo:install': 'downloads and builds a Rust program, then installs it',
  'gem:install': 'downloads and installs a Ruby package',
  'go:install': 'downloads, builds and installs a Go program',
  'docker:run': 'starts a container (an isolated mini-computer); can use a lot of memory',
  'docker:build': 'builds a container image from a Dockerfile (uses disk and time)',
  'docker:rm': 'deletes containers',
  'docker:rmi': 'deletes container images',
  'docker:prune': 'deletes all unused containers, images or volumes',
  'docker:compose': 'starts or stops a group of containers',
  'gh:repo': 'works with a GitHub repository (create, edit, delete, view)',
  'gh:pr': 'works with pull requests (proposed changes) on GitHub',
  'gh:issue': 'works with issues on GitHub',
  'gh:run': 'looks at GitHub Actions runs (the automatic test robot)',
  'gh:api': 'sends a request straight to the GitHub web service',
  'gh:auth': 'logs in to or out of GitHub',
  'gh:release': 'publishes a release on GitHub',
  '*:update': 'updates something to a newer version',
  '*:upgrade': 'updates something to a newer version',
  '*:remove': 'removes something',
  '*:uninstall': 'removes something',
  '*:install': 'downloads and installs something',
};

/**
 * The text a person sees in the approval prompt: what the command does, piece by piece,
 * in plain words. Does not depend on Claude having written an explanation.
 */
export function userExplanation(cmd, cwd, reasons = []) {
  const clean = stripNoise(cmd);
  const parts = splitSegments(clean).map((s) => decode(s, cwd)).filter(Boolean).map(redact);
  const why = [...new Set(reasons.filter(Boolean))];
  return [
    'WHAT THIS COMMAND DOES, IN PLAIN WORDS (each line is one piece, in order):',
    ...parts,
    '',
    why.length ? `WHAT IT CHANGES: it ${why.join('; ')}.` : '',
    'Only say yes if this is what you expected. If you are not sure, say NO and ask Claude: "why do you need this, and what exactly will change on my computer?"',
  ].filter((x) => x !== '').join('\n');
}

export function decode(seg, cwd) {
  const all = tokenize(seg);
  if (!all.length) return null;
  const lines = [`• \`${seg.length > 140 ? `${seg.slice(0, 140)}…` : seg}\``];
  let start = 0;
  while (start < all.length && ENV_ASSIGN.test(all[start])) {
    lines.push(`    sets \`${all[start].split('=')[0]}\` for this one command only`);
    start++;
  }
  const t = all.slice(start);
  if (!t.length) return lines.join('\n');
  const prog = path.basename(t[0]).toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, '');
  lines.push(`    program \`${t[0]}\` — ${PROGRAM[prog] || 'a program (look at --help or the docs if unsure)'}`);
  const pkgSet = new Set();
  const verb = t[1] && /^[a-z][a-z-]*$/i.test(t[1]) && ACTION_PROGRAMS.has(prog) ? t[1].toLowerCase() : null;
  if (verb) {
    const fam = PKG_FAMILY[prog] || prog;
    lines.push(`    action \`${t[1]}\` — ${ACTIONS[`${fam}:${verb}`] || ACTIONS[`*:${verb}`] || `one of ${prog}'s commands; it is not in the built-in glossary, so run \`${prog} ${verb} --help\` to see what it does`}`);
    // Package names after "install" are the actual things being downloaded: name each one.
    if (PKG_FAMILY[prog] && ['install', 'i', 'add', 'update', 'upgrade', 'up', 'remove', 'uninstall', 'un'].includes(verb) || ['pip', 'pip3', 'winget', 'choco', 'scoop', 'brew', 'apt', 'apt-get', 'cargo', 'gem'].includes(prog) && /^(?:install|add|uninstall|remove)$/.test(verb)) {
      const pkgs = t.slice(2).filter((x) => x && !x.startsWith('-') && !REDIRECT.test(x));
      for (const p of pkgs.slice(0, 8)) {
        pkgSet.add(p);
        lines.push(`    package \`${p}\` — code written by someone else, downloaded from the internet. It will run on your computer. Check the name is spelled exactly right (look-alike names are a known trick).`);
      }
      if (!pkgs.length && /^(?:install|i|ci)$/.test(verb) && PKG_FAMILY[prog]) lines.push('    no package named, so it installs everything this project already lists in package.json');
    }
  }
  const flagNotes = [];
  const targets = [];
  const redirects = [];
  for (let k = 1; k < t.length; k++) {
    const tok = t[k];
    const r = REDIRECT.exec(tok);
    if (r) {
      let dest = r[1];
      if (!dest && /^(?:&>>?|\d*>>?|\d*<)$/.test(tok)) dest = t[++k];
      redirects.push(explainRedirect(tok, dest, cwd));
      continue;
    }
    if ((/^[-/][A-Za-z-]/.test(tok) && !/^\/[A-Za-z0-9_.~-]+\//.test(tok)) || tok.startsWith('--')) {
      for (const [f, d] of decodeFlag(tok, prog)) flagNotes.push(`    ${f} — ${d}`);
    } else if (!pkgSet.has(tok) && (!/^[a-z]+$/i.test(tok) || tok.includes('/') || tok.includes('.') || tok.includes(path.sep))) {
      targets.push(tok);
    }
  }
  lines.push(...flagNotes);
  for (const target of targets.slice(0, 6)) {
    let note = '';
    if (/^(?:~|[A-Za-z]:|\/|\\)/.test(target) || target.startsWith('..')) {
      const abs = target.startsWith('~') ? path.join(HOME, target.slice(1)) : path.resolve(cwd || HOME, target);
      const rel = path.relative(cwd || HOME, abs);
      if (rel.startsWith('..') || path.isAbsolute(rel)) note = '  ⚠️ outside the project folder';
    }
    if (/^(?:\.|\*)$|^\*/.test(target)) note += '  ⚠️ matches many things';
    lines.push(`    target \`${target}\`${note}`);
  }
  lines.push(...redirects);
  return lines.join('\n');
}
