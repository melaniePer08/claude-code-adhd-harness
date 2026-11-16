#!/usr/bin/env node
// PreToolUse (Bash|PowerShell): make sure risky commands are EXPLAINED before they can be approved.
//
// Rule 2.1 says every command that needs approval is explained part by part first. A rule that
// only lives in Claude's instructions gets forgotten, so this hook enforces it:
//
//   1. A command that is risky (deletes, installs, force-pushes, uploads, kills programs,
//      schedules jobs, deploys...) is refused ONCE, with a plain decoded breakdown of the command.
//   2. Claude must write the explanation in its message (explain-command skill), then run the
//      SAME command again. The second try goes through to the normal permission prompt, so the
//      user reads the explanation first and approves second.
//   3. Each distinct command is refused at most once per session (loop guard, rule 2.8).
//
// The hook cannot write the explanation itself — it has no idea what you are trying to achieve —
// but the decoded breakdown makes the part-by-part explanation accurate instead of from memory.
// Harmless commands (git status, ls, reading files, running tests...) are never interrupted.

import crypto from 'node:crypto';
import path from 'node:path';
import { readInput, deny, stripNoise, splitSegments, tokenize, loadState, saveState, harnessSetting, HOME } from './lib.mjs';

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

function riskOf(t0, raw) {
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

function decode(seg, cwd) {
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
  if (t[1] && /^[a-z][a-z-]*$/i.test(t[1]) && ['git', 'npm', 'pnpm', 'yarn', 'bun', 'pip', 'pip3', 'cargo', 'docker', 'gh', 'winget', 'choco', 'scoop', 'brew', 'apt', 'apt-get'].includes(prog)) {
    lines.push(`    action \`${t[1]}\` — the part that says what it really does (look it up if unsure)`);
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
    } else if (!/^[a-z]+$/i.test(tok) || tok.includes('/') || tok.includes('.') || tok.includes(path.sep)) {
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

// ------------------------------------------------------------------------ main

const input = await readInput();
const cmd = input?.tool_input?.command;
if (typeof cmd !== 'string' || !cmd.trim()) process.exit(0);

const clean = stripNoise(cmd);
const segments = splitSegments(clean);
const risky = [];
for (const seg of segments) {
  const reason = riskOf(tokenize(seg), seg);
  if (reason) risky.push({ seg, reason });
}
if (!risky.length && /\|\s*(?:sh|bash|zsh|pwsh|powershell|iex)\b/i.test(clean)) risky.push({ seg: clean.slice(0, 140), reason: 'pipes downloaded text straight into a shell' });

// The user also asked (EXPLAIN_SCRIPTS, default yes): multi-line commands, heredocs and inline
// scripts are explained before they run too — and code changes should go through the Edit/Write
// tool, so the user can review a diff instead of a script. Plain git add/commit/status are exempt.
const SCRIPTISH = /\b(?:node(?:\.exe)?\s+(?:-e|--eval|-p|--print)\b|python[0-9.]*(?:\.exe)?\s+(?:-c\b|-\s*(?:<<|$))|(?:bash|sh|zsh)\s+-c\b|(?:powershell|pwsh)(?:\.exe)?\b[^\n]*\s-(?:Command|c)\b)/i;
const simpleGit = segments.length > 0 && segments.every((seg) => /^git\s+(?:add|commit|status|log|diff|push|pull|fetch|show|branch|switch|stash\s+list)\b/.test(seg));
const scriptish = String(harnessSetting('EXPLAIN_SCRIPTS', 'yes')).toLowerCase() !== 'no' && !simpleGit &&
  (clean.includes('\n') || clean.includes('<<heredoc>>') || SCRIPTISH.test(clean));
if (!risky.length && scriptish) risky.push({ seg: clean.slice(0, 140), reason: 'is a multi-line command or an inline script (heredoc, node -e, python -c, pipes)' });
if (!risky.length) process.exit(0);

// Loop guard: each distinct command is stopped once per session; the retry goes through.
const key = crypto.createHash('sha1').update(cmd.trim()).digest('hex').slice(0, 16);
const st = loadState(input?.session_id, 'explain');
st.seen = Array.isArray(st.seen) ? st.seen : [];
if (st.seen.includes(key)) process.exit(0);
st.seen = [...st.seen, key].slice(-200);
saveState(input?.session_id, st, 'explain');

const breakdown = segments.map((s) => decode(s, input?.cwd)).filter(Boolean).join('\n');
deny(
  'Held until it is explained. This command ' + risky.map((r) => `${r.reason}`).filter((v, i, a) => a.indexOf(v) === i).join('; ') + '.\n\n' +
    'Before running it, write the explanation in your message to the user (explain-command skill, rule 2.1): the command, then ' +
    'one short line per part IN ORDER (each piece joined by && ; | is a separate action; say what every flag does; name the exact files, ' +
    'folders, branches or addresses; say what is created / changed / deleted / overwritten / sent off this computer; say what cannot be undone; ' +
    'translate jargon), and finish with one line: "If you say yes: …".\n\n' +
    `Decoded from the command, as raw material (check it, do not just paste it):\n${breakdown}\n\n` +
    'Then run the SAME command again, unchanged — the second try goes through to the normal approval prompt. ' +
    (scriptish ? 'For code changes, prefer the Edit or Write tool over an inline script, so the user can review a diff. If you still use a script, also explain the heredoc, pipe and grep parts.\n' : '') +
    'Do not reword or split the command to avoid this check.'
);
process.exit(0);
