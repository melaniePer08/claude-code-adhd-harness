#!/usr/bin/env node
// One-step installer for the harness. A DRY RUN unless you add --apply.
//
//   node install.mjs                          preview the recommended set; changes nothing
//   node install.mjs --skills all --hooks all preview everything
//   node install.mjs --apply                  install the recommended set
//   node install.mjs --skills a,b --hooks none --no-tools --apply
//
// Options
//   --skills recommended|all|none|a,b,c   which skills to install      (default: recommended)
//   --hooks  recommended|all|none|a,b,c   which hooks to install       (default: recommended)
//   --no-rules                            skip the rules (CLAUDE.md, rules/, docs)
//   --no-tools                            skip tools/ (screenshots, Figma reader, refresher, status board)
//   --home DIR                            install into DIR/.claude instead of your real home (for testing)
//   --apply                               really do it
//
// Where things go (everything under <home>/.claude/):
//   harness/    CLAUDE.md, rules/, RESOURCES.md, STARTER-PACK.md, DISCLAIMERS.md   (NOT in rules/: Claude Code
//               loads that folder in every session, which would cost tokens all the time)
//               harness-settings.md is copied only if it does not exist — your values are never overwritten
//   skills/     one folder per skill
//   tools/      the .mjs tools
//   hooks/      the hook scripts, registered in settings.json by hooks/install.mjs (backup + additive merge)
//
// Safety: nothing is deleted. A file that already exists and differs is moved to
// <home>/.claude/backups/<timestamp>/ first (never next to the skills, where it would load as a duplicate skill).
// Your own ~/.claude/CLAUDE.md, .env files and tokens are never read or changed. No network access, no packages.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const value = (n) => {
  const i = args.indexOf(`--${n}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};

const APPLY = flag('apply');
const HOME = path.resolve(value('home') || os.homedir());
const CLAUDE = path.join(HOME, '.claude');
const STAMP = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const BACKUPS = path.join(CLAUDE, 'backups', STAMP);

const RECOMMENDED_SKILLS = [
  'secure-code', 'security-check', 'package-check',
  'design-research', 'design-system', 'design-review',
  'plan-first', 'explain-command', 'first-run-setup', 'debug', 'review-changes', 'write-up',
];
const RECOMMENDED_HOOKS = [
  'secret-scan', 'protect-secret-files', 'block-dangerous', 'explain-gate', 'commit-guard',
  'ram-check', 'session-start', 'mistake-log', 'rules-refresh', 'notify', 'status-update',
];

const listDirs = (d) => fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name);
const allSkills = listDirs(path.join(HERE, 'skills')).filter((n) => fs.existsSync(path.join(HERE, 'skills', n, 'SKILL.md')));
const allHooks = fs.readdirSync(path.join(HERE, 'hooks'))
  .filter((f) => f.endsWith('.mjs') && !['lib.mjs', 'toast.mjs', 'status.mjs', 'install.mjs'].includes(f) && !f.startsWith('statusline'))
  .map((f) => f.replace(/\.mjs$/, ''));

function pick(opt, recommended, all, kind) {
  const v = (value(opt) || 'recommended').trim();
  if (v === 'recommended') return recommended.filter((n) => all.includes(n));
  if (v === 'all') return all;
  if (v === 'none') return [];
  const names = v.split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = names.filter((n) => !all.includes(n));
  if (unknown.length) {
    console.error(`Unknown ${kind}: ${unknown.join(', ')}\nAvailable: ${all.join(', ')}`);
    process.exit(1);
  }
  return names;
}
const skills = pick('skills', RECOMMENDED_SKILLS, allSkills, 'skill(s)');
const hooks = pick('hooks', RECOMMENDED_HOOKS, allHooks, 'hook(s)');

// ---------------------------------------------------------------- file helpers
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const SKIP = new Set(['.DS_Store', 'Thumbs.db', 'node_modules', '.git']);

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/** Plan copying src (file or folder) to dest. Returns [{from,to,state}] with state new|same|differs. */
function plan(src, dest, only) {
  const items = [];
  const files = fs.statSync(src).isDirectory() ? walk(src) : [src];
  for (const f of files) {
    const rel = fs.statSync(src).isDirectory() ? path.relative(src, f) : '';
    const to = rel ? path.join(dest, rel) : dest;
    let state = 'new';
    if (fs.existsSync(to)) state = hash(f) === hash(to) ? 'same' : 'differs';
    if (only && !only(path.basename(to), state)) continue;
    items.push({ from: f, to, state });
  }
  return items;
}

const steps = []; // {label, items}
const add = (label, items) => steps.push({ label, items });

// ------------------------------------------------------------------- the plan
if (!flag('no-rules')) {
  const items = [
    ...plan(path.join(HERE, 'CLAUDE.md'), path.join(CLAUDE, 'harness', 'CLAUDE.md')),
    ...plan(path.join(HERE, 'rules'), path.join(CLAUDE, 'harness', 'rules')),
    ...['RESOURCES.md', 'STARTER-PACK.md', 'DISCLAIMERS.md'].flatMap((f) => plan(path.join(HERE, f), path.join(CLAUDE, 'harness', f))),
  ];
  // The user's own settings are never overwritten.
  const settingsDest = path.join(CLAUDE, 'harness', 'harness-settings.md');
  if (!fs.existsSync(settingsDest)) items.push(...plan(path.join(HERE, 'harness-settings.md'), settingsDest));
  add('rules and docs  -> harness/', items);
}
for (const name of skills) add(`skill ${name}  -> skills/${name}/`, plan(path.join(HERE, 'skills', name), path.join(CLAUDE, 'skills', name)));
if (!flag('no-tools')) {
  const toolFiles = fs.readdirSync(path.join(HERE, 'tools')).filter((f) => f.endsWith('.mjs'));
  add('tools  -> tools/', toolFiles.flatMap((f) => plan(path.join(HERE, 'tools', f), path.join(CLAUDE, 'tools', f))));
}

// -------------------------------------------------------------------- preview
console.log(APPLY ? 'INSTALLING' : 'DRY RUN (nothing is changed — add --apply to do it)');
console.log(`Into:   ${CLAUDE}`);
console.log(`Skills: ${skills.length ? skills.join(', ') : '(none)'}`);
console.log(`Hooks:  ${hooks.length ? hooks.join(', ') : '(none)'}\n`);

let toCopy = 0;
let toReplace = 0;
for (const s of steps) {
  const n = s.items.filter((i) => i.state === 'new').length;
  const d = s.items.filter((i) => i.state === 'differs').length;
  const same = s.items.filter((i) => i.state === 'same').length;
  toCopy += n;
  toReplace += d;
  console.log(`  ${s.label}: ${n} new, ${d} replaced (old copy backed up), ${same} already identical`);
}
console.log(`\nTotal: ${toCopy} new files, ${toReplace} replaced (originals go to ${path.join(CLAUDE, 'backups', STAMP)})`);

// -------------------------------------------------------------------- apply
if (APPLY) {
  for (const s of steps) {
    for (const it of s.items) {
      if (it.state === 'same') continue;
      if (it.state === 'differs') {
        const rel = path.relative(CLAUDE, it.to);
        const backup = path.join(BACKUPS, rel);
        fs.mkdirSync(path.dirname(backup), { recursive: true });
        fs.copyFileSync(it.to, backup);
      }
      fs.mkdirSync(path.dirname(it.to), { recursive: true });
      fs.copyFileSync(it.from, it.to);
    }
  }
}

// ------------------------------------------------------------------- hooks
if (hooks.length) {
  console.log('\nHooks (through hooks/install.mjs: settings.json is backed up and only ADDED to):');
  const r = spawnSync(process.execPath, [path.join(HERE, 'hooks', 'install.mjs'), '--home', HOME, '--only', hooks.join(','), ...(APPLY ? ['--apply'] : [])], { encoding: 'utf8' });
  process.stdout.write(r.stdout.split('\n').map((l) => (l ? `  ${l}` : l)).join('\n'));
  if (r.status !== 0) {
    process.stderr.write(r.stderr);
    process.exit(r.status || 1);
  }
}

console.log(APPLY
  ? `\nDone. Open Claude Code sessions picked up hooks and skills live in testing; if something does not show up, restart that session. Undo: copy back from ${BACKUPS} and delete what was added.`
  : '\nThis was a preview. Run again with --apply to install.');
