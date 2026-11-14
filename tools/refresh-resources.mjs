#!/usr/bin/env node
// Refresh the star counts and "last updated" months in RESOURCES.md from GitHub's public API.
//
//   node tools/refresh-resources.mjs            dry run: shows what would change, writes nothing
//   node tools/refresh-resources.mjs --apply    updates RESOURCES.md
//   node tools/refresh-resources.mjs --file X   a different file (default: RESOURCES.md next to tools/)
//
// What it does: reads every table row that links to a GitHub repo, asks api.github.com for that
// repo's public data (stars, last push, archived?, licence), and rewrites only the stars and the
// month columns plus the "Numbers from the GitHub API on <date>" line.
// What it never does: delete a row, change a description or licence text, read any token or .env,
// or contact anything except api.github.com. It reports problems instead of fixing them:
//   - archived repos, renamed/missing repos, no update for 12+ months, a licence that changed.
// Unauthenticated GitHub allows 60 requests per hour, which is plenty for this table.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const fileArg = args.indexOf('--file');
// In the repo, RESOURCES.md sits next to tools/. Once installed, tools live in ~/.claude/tools/ and the file in ~/.claude/harness/.
const DEFAULT_FILES = [path.join(HERE, '..', 'RESOURCES.md'), path.join(HERE, '..', 'harness', 'RESOURCES.md')];
const FILE = path.resolve(fileArg !== -1 && args[fileArg + 1] ? args[fileArg + 1] : DEFAULT_FILES.find((f) => fs.existsSync(f)) || DEFAULT_FILES[0]);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatStars = (n) => (n >= 10000 ? `~${Math.round(n / 1000)}k` : n >= 1000 ? `~${(n / 1000).toFixed(1)}k` : String(n));
const formatMonth = (iso) => {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const original = fs.readFileSync(FILE, 'utf8');
const text = original.replace(/\r\n/g, '\n');
const lines = text.split('\n');
const ROW = /^\| \[([^\]]+)\]\(https:\/\/github\.com\/([\w.-]+\/[\w.-]+?)\/?\)/;

const report = [];
let changed = 0;
let checked = 0;
let incomplete = false;

for (let i = 0; i < lines.length; i++) {
  const m = ROW.exec(lines[i]);
  if (!m) continue;
  const [, name, repo] = m;
  const cells = lines[i].split('|');
  // cells: ['', ' [name](url) ', ' what ', ' licence ', ' stars ', ' date ', '']
  if (cells.length < 7) continue;
  checked++;
  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${repo}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'claude-code-adhd-harness-refresh' } });
  } catch (e) {
    report.push(`⚠️  ${name} (${repo}): could not reach GitHub (${e.message}) — left unchanged`);
    continue;
  }
  if (res.status === 403 || res.status === 429) {
    report.push(`⛔ GitHub rate limit reached after ${checked - 1} repos — run again in an hour. Nothing after this point was changed, and the date line was left alone.`);
    incomplete = true;
    break;
  }
  if (res.status === 404 || res.status === 301) {
    report.push(`⚠️  ${name} (${repo}): not found or moved — check the link by hand`);
    continue;
  }
  if (!res.ok) {
    report.push(`⚠️  ${name} (${repo}): GitHub answered ${res.status} — left unchanged`);
    continue;
  }
  const data = await res.json();
  const stars = formatStars(data.stargazers_count);
  const month = formatMonth(data.pushed_at);
  const monthsOld = (Date.now() - Date.parse(data.pushed_at)) / (30.44 * 86400000);

  if (data.archived) report.push(`⚠️  ${name}: the project is ARCHIVED (read-only) — consider removing it`);
  if (monthsOld > 12) report.push(`⚠️  ${name}: no update for ${Math.floor(monthsOld)} months — may be abandoned`);
  const licenceId = data.license?.spdx_id;
  if (licenceId && licenceId !== 'NOASSERTION' && !cells[3].includes(licenceId.split('-')[0])) {
    report.push(`ℹ️  ${name}: table says "${cells[3].trim()}", GitHub says "${licenceId}" — check the licence by hand`);
  }

  const newStars = ` ${stars} `;
  const note = /\([^)]*\)\s*$/.exec(cells[5])?.[0]; // keep an annotation such as "(stable spec)"
  const newMonth = ` ${month}${note ? ` ${note.trim()}` : ''} `;
  if (cells[4] !== newStars || cells[5] !== newMonth) {
    changed++;
    report.push(`   ${name}: ${cells[4].trim()} / ${cells[5].trim()}  ->  ${stars} / ${month}`);
    cells[4] = newStars;
    cells[5] = newMonth;
    lines[i] = cells.join('|');
  }
}

const today = new Date().toISOString().slice(0, 10);
let out = lines.join('\n');
// Only stamp today's date when the WHOLE table was refreshed; a partial run must not claim it was.
if (!incomplete) out = out.replace(/(Numbers from the GitHub API on \*\*)(\d{4}-\d{2}-\d{2})(\*\*)/, `$1${today}$3`);
if (out === text) out = text;

console.log(`${APPLY ? 'UPDATING' : 'DRY RUN (nothing written — add --apply)'}: ${checked} repos checked, ${changed} rows would change.\n`);
console.log(report.length ? report.join('\n') : 'No changes and no problems.');

if (APPLY && out !== text) {
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(FILE, out.replace(/\n/g, eol), 'utf8');
  console.log(`\nWrote ${FILE}`);
}
