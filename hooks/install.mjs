#!/usr/bin/env node
// Install the harness hooks safely.
//
//   node hooks/install.mjs                       dry run: shows exactly what would change, changes nothing
//   node hooks/install.mjs --only a,b            only these hooks (names without .mjs), e.g. secret-scan,auto-push
//   node hooks/install.mjs --apply               really do it
//   node hooks/install.mjs --home DIR            use DIR instead of your home folder (for testing)
//
// What --apply does, and nothing else:
//   1. copies the chosen hook scripts (+ lib.mjs, which they all share) into <home>/.claude/hooks/
//   2. backs up <home>/.claude/settings.json to settings.json.bak-<timestamp>
//   3. ADDS the hook entries to settings.json. It never removes or edits what is already there,
//      and running it twice adds nothing twice.
// It does not touch .env files, tokens, or any other setting. No network access, no packages.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};

const APPLY = flag('apply');
const HOME = path.resolve(value('home') || os.homedir());
const ONLY = value('only') ? new Set(value('only').split(',').map((s) => s.trim().replace(/\.mjs$/, '')).filter(Boolean)) : null;
const TARGET_DIR = path.join(HOME, '.claude', 'hooks');
const SETTINGS = path.join(HOME, '.claude', 'settings.json');
const fwd = (p) => p.split(path.sep).join('/'); // settings.json is happier with forward slashes

const template = JSON.parse(fs.readFileSync(path.join(HERE, 'settings.example.json'), 'utf8').replace(/^﻿/, ''));
const scriptOf = (h) => {
  const a = Array.isArray(h.args) ? h.args : [];
  const hit = a.find((x) => String(x).endsWith('.mjs'));
  return hit ? path.basename(String(hit), '.mjs') : null;
};

// Which scripts are wanted?
const all = new Set();
for (const groups of Object.values(template.hooks)) for (const g of groups) for (const h of g.hooks) if (scriptOf(h)) all.add(scriptOf(h));
const unknown = ONLY ? [...ONLY].filter((n) => !all.has(n)) : [];
if (unknown.length) {
  console.error(`Unknown hook name(s): ${unknown.join(', ')}\nAvailable: ${[...all].sort().join(', ')}`);
  process.exit(1);
}
const wanted = ONLY ? new Set([...ONLY]) : all;

// Existing settings (never modified unless --apply)
let settings = {};
let settingsExisted = false;
if (fs.existsSync(SETTINGS)) {
  settingsExisted = true;
  try {
    settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    console.error(`Cannot read ${SETTINGS} as JSON (${e.message}). Nothing was changed. Fix or move that file, then run again.`);
    process.exit(1);
  }
}
settings.hooks = settings.hooks || {};

const registered = (event, script) =>
  (settings.hooks[event] || []).some((g) => (g.hooks || []).some((h) => scriptOf(h) === script && String(h.args || '').includes('.claude/hooks')));

const toAdd = [];
for (const [event, groups] of Object.entries(template.hooks)) {
  for (const g of groups) {
    const hooks = g.hooks.filter((h) => wanted.has(scriptOf(h)) && !registered(event, scriptOf(h)));
    if (!hooks.length) continue;
    const entry = JSON.parse(JSON.stringify({ ...g, hooks }).replaceAll('{{HOOKS_DIR}}', fwd(TARGET_DIR)));
    toAdd.push({ event, entry, scripts: hooks.map(scriptOf) });
  }
}

// Files to copy
// lib.mjs and toast.mjs are shared helpers the hooks import, so they always come along.
const files = [...wanted, 'lib', 'toast'].map((n) => `${n}.mjs`);
const copyPlan = files.map((f) => {
  const from = path.join(HERE, f);
  const to = path.join(TARGET_DIR, f);
  let state = 'new';
  if (fs.existsSync(to)) state = fs.readFileSync(from).equals(fs.readFileSync(to)) ? 'same' : 'differs';
  return { f, from, to, state };
});

console.log(APPLY ? 'INSTALLING' : 'DRY RUN (nothing is changed — add --apply to do it)');
console.log(`Hooks folder:  ${TARGET_DIR}`);
console.log(`Settings file: ${SETTINGS}${settingsExisted ? '' : '  (does not exist yet; would be created)'}\n`);
console.log('Files to copy:');
for (const c of copyPlan) console.log(`  ${c.state === 'same' ? '=' : c.state === 'differs' ? '!' : '+'} ${c.f}  (${c.state === 'differs' ? 'a different file exists — it would be replaced; the old one is kept as .bak' : c.state})`);
console.log('\nSettings entries to add:');
if (!toAdd.length) console.log('  (none — everything chosen is already registered)');
for (const t of toAdd) console.log(`  + ${t.event}  [${t.entry.matcher || '*'}]  ${t.scripts.join(', ')}`);

if (!APPLY) process.exit(0);

fs.mkdirSync(TARGET_DIR, { recursive: true });
for (const c of copyPlan) {
  if (c.state === 'same') continue;
  if (c.state === 'differs') fs.copyFileSync(c.to, `${c.to}.bak`);
  fs.copyFileSync(c.from, c.to);
}

if (toAdd.length) {
  if (settingsExisted) {
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    fs.copyFileSync(SETTINGS, `${SETTINGS}.bak-${stamp}`);
    console.log(`\nBackup: ${SETTINGS}.bak-${stamp}`);
  } else {
    fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  }
  for (const t of toAdd) {
    settings.hooks[t.event] = settings.hooks[t.event] || [];
    settings.hooks[t.event].push(t.entry);
  }
  const tmp = `${SETTINGS}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, SETTINGS);
}
console.log('\nDone. Start a new Claude Code session so the hooks load. To undo: restore the backup file above and delete the copied scripts.');
