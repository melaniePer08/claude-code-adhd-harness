import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ROOT, HOOKS, fake } from './helpers.mjs';

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
let tracked = [];
try {
  tracked = git('ls-files').split('\n').filter(Boolean);
} catch {
  /* not a git checkout (a downloaded zip): the git-based tests below skip themselves */
}
const textFiles = tracked.filter((f) => !/\.(png|jpe?g|gif|webp|ico)$/i.test(f));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('no tracked file holds a secret, a personal path or an e-mail address', async (t) => {
  if (!tracked.length) return t.skip('not a git checkout');
  const lib = await import(`file://${path.join(HOOKS, 'lib.mjs').replace(/\\/g, '/').replace(/^\//, '/')}`);
  // Built from pieces so this test file does not contain what it searches for.
  const personal = [new RegExp(`Users[/\\\\]${'mel'}${'an'}\\b`, 'i'), new RegExp(`${'gm'}${'ail'}\\.com`, 'i'), /\bjarvis\b/i];
  const problems = [];
  for (const f of textFiles) {
    for (const finding of lib.scanFile(path.join(ROOT, f), f)) problems.push(`${f}: ${finding.rule}`);
    const text = read(f);
    for (const re of personal) if (re.test(text)) problems.push(`${f}: matches ${re}`);
  }
  assert.deepEqual(problems, []);
});

test('no tracked file is a secrets file, a log, a backup or build output', (t) => {
  if (!tracked.length) return t.skip('not a git checkout');
  const bad = tracked.filter((f) => /(^|\/)\.env($|\.)(?!example)|\.pem$|\.key$|\.log$|\.bak|node_modules\/|owner-answers\.json|(^|\/)\.shots\//.test(f));
  assert.deepEqual(bad, []);
});

test('.gitignore keeps secrets and tool output out of git', (t) => {
  if (!tracked.length) return t.skip('not a git checkout');
  for (const f of ['.env', '.env.local', 'node_modules/x.js', '.shots/a.png', 'docs/owner-answers.json', 'id_rsa', 'service-account-key.json']) {
    const r = spawnSync('git', ['check-ignore', '-q', f], { cwd: ROOT });
    assert.equal(r.status, 0, `${f} should be ignored`);
  }
  assert.notEqual(spawnSync('git', ['check-ignore', '-q', '.env.example'], { cwd: ROOT }).status, 0, '.env.example must stay committable');
});

test('no stray control characters (backspace, zero-width) anywhere: they once broke a regex', (t) => {
  if (!tracked.length) return t.skip('not a git checkout');
  const bad = [];
  for (const f of textFiles) {
    const b = fs.readFileSync(path.join(ROOT, f));
    if ([...b].some((c) => c < 32 && c !== 9 && c !== 10 && c !== 13)) bad.push(`${f}: control character`);
    if (b.includes(Buffer.from(String.fromCharCode(0x200b)))) bad.push(`${f}: zero-width space`);
  }
  assert.deepEqual(bad, []);
});

test('every .mjs file passes a syntax check', (t) => {
  if (!tracked.length) return t.skip('not a git checkout');
  for (const f of tracked.filter((x) => x.endsWith('.mjs'))) {
    const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f}: ${r.stderr.slice(0, 200)}`);
  }
});

test('shell scripts and hooks start with a plain LF shebang', (t) => {
  if (!tracked.length) return t.skip('not a git checkout');
  for (const f of tracked.filter((x) => x.startsWith('hooks/') && x.endsWith('.mjs'))) {
    const head = fs.readFileSync(path.join(ROOT, f), 'utf8').slice(0, 40);
    if (head.startsWith('#!')) assert.ok(!head.includes('\r'), `${f} has a CRLF shebang line`);
  }
});

// ------------------------------------------------------------------ skills
const skillNames = fs.readdirSync(path.join(ROOT, 'skills'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const ruleIds = new Set();
for (const f of fs.readdirSync(path.join(ROOT, 'rules'))) {
  for (const m of fs.readFileSync(path.join(ROOT, 'rules', f), 'utf8').matchAll(/^\*\*(\d{1,2}\.\d{1,2}[a-z]?)[ .]/gm)) ruleIds.add(m[1]);
}

test('there are 27 skills, as the README says', () => {
  assert.equal(skillNames.length, 27);
});

for (const name of skillNames) {
  test(`skill ${name}: valid frontmatter, real rule numbers, no broken references`, () => {
    const raw = fs.readFileSync(path.join(ROOT, 'skills', name, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw);
    assert.ok(fm, 'frontmatter block missing');
    const lines = fm[1].split('\n');
    const get = (k) => lines.find((l) => l.startsWith(`${k}:`))?.slice(k.length + 1).trim();
    assert.equal(get('name'), name, 'name must equal the folder name');
    const desc = get('description');
    assert.ok(desc && desc.length > 40, 'description missing or too short');
    assert.ok(desc.length <= 1024, `description too long (${desc.length})`);
    assert.ok(/\buse\b/i.test(desc), 'description must say when to use the skill');
    // A plain YAML value may not contain ": " or " #" — a strict parser then drops the whole skill.
    assert.ok(!desc.includes(': '), 'description contains ": " (invalid plain YAML — the skill may silently not load)');
    assert.ok(!desc.includes(' #'), 'description contains " #" (starts a YAML comment)');
    assert.ok(!/^["'\[{&*!|>%@`]/.test(desc), 'description starts with a YAML special character');
    for (const l of lines) assert.ok(/^[a-z-]+:/.test(l), `unexpected frontmatter line: ${l}`);

    const body = raw.slice(fm[0].length);
    for (const m of body.matchAll(/rules?\s+((?:\d{1,2}\.\d{1,2}[a-z]?(?:\s*[,–-]\s*|\s+and\s+|\s*\+\s*)?)+)/gi)) {
      for (const id of m[1].match(/\d{1,2}\.\d{1,2}[a-z]?/g) || []) assert.ok(ruleIds.has(id), `cites rule ${id}, which does not exist`);
    }
    for (const m of body.matchAll(/`([a-z]+(?:-[a-z]+)+)`(?:\s+skill)/g)) assert.ok(skillNames.includes(m[1]), `mentions skill ${m[1]}, which does not exist`);
    for (const m of body.matchAll(/`((?:rules|skills|tools|hooks|assets)\/[A-Za-z0-9_./-]+)`/g)) {
      if (/[<*{]/.test(m[1])) continue;
      assert.ok(fs.existsSync(path.join(ROOT, m[1].replace(/\/$/, ''))), `references ${m[1]}, which does not exist`);
    }
  });
}

// ------------------------------------------------------------- docs match reality
test('the README and STARTER-PACK match what is really in the repo', () => {
  const readme = read('README.md');
  const pack = read('STARTER-PACK.md');
  const template = JSON.parse(read('hooks/settings.example.json'));
  const hookNames = new Set();
  for (const groups of Object.values(template.hooks)) for (const g of groups) for (const h of g.hooks) hookNames.add(path.basename(h.args[0], '.mjs'));
  assert.ok(new RegExp(`skills-${skillNames.length}-`).test(readme), `README skills badge should say ${skillNames.length}`);
  assert.ok(new RegExp(`hooks-${hookNames.size}-`).test(readme), `README hooks badge should say ${hookNames.size}`);
  for (const n of skillNames) assert.ok(readme.includes(`\`${n}\``), `README does not list skill ${n}`);
  for (const n of hookNames) assert.ok(readme.includes(`\`${n}\``), `README does not list hook ${n}`);
  for (const n of skillNames) assert.ok(pack.includes(`\`${n}\``), `STARTER-PACK does not list skill ${n}`);
  for (const n of hookNames) assert.ok(pack.includes(`\`${n}\``), `STARTER-PACK does not list hook ${n}`);
});

test('every setting the hooks read exists in harness-settings.md', () => {
  const settings = read('harness-settings.md');
  const used = new Set();
  for (const f of fs.readdirSync(HOOKS).filter((x) => x.endsWith('.mjs'))) {
    for (const m of fs.readFileSync(path.join(HOOKS, f), 'utf8').matchAll(/harness(?:Setting|Number)\('([A-Z_]+)'/g)) used.add(m[1]);
  }
  for (const m of fs.readFileSync(path.join(HOOKS, 'status.mjs'), 'utf8').matchAll(/fallback|setting: '([A-Z_]+)'/g)) if (m[1]) used.add(m[1]);
  for (const k of used) assert.ok(settings.includes(`\`${k}\``), `${k} is read by a hook but missing from harness-settings.md`);
});

test('the secret-scan detector pattern list does not flag a harmless sentence (false-positive guard)', async () => {
  const lib = await import(`file://${path.join(HOOKS, 'lib.mjs').replace(/\\/g, '/').replace(/^\//, '/')}`);
  assert.equal(lib.scanLine('Use sk- keys, figd_ tokens and AKIA ids carefully.', 'a.md').length, 0);
  assert.ok(lib.scanLine(`x ${fake('sk_live_', 30, 'aB3')}`, 'a.js').length > 0);
});
