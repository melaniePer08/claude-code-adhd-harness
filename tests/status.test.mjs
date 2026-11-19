import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { runHook, tmp, rm, ROOT } from './helpers.mjs';

const readState = (home, sid) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(home, '.claude', 'status', `${sid}.json`), 'utf8'));
  } catch {
    return null;
  }
};
const fire = (home, sid, event, extra = {}, cwd = 'C:/work/appForWriters-main') => runHook('status-update', { hook_event_name: event, session_id: sid, cwd, ...extra }, home);

test('status-update follows a session through its life: new -> working -> needs you -> working -> done -> closed', () => {
  const home = tmp();
  try {
    fire(home, 's1', 'SessionStart');
    assert.equal(readState(home, 's1').state, 'waiting');
    assert.equal(readState(home, 's1').name, 'appForWriters', 'short project name drops -main');
    fire(home, 's1', 'UserPromptSubmit');
    assert.equal(readState(home, 's1').state, 'working');
    fire(home, 's1', 'Notification', { notification_type: 'permission_prompt' });
    assert.equal(readState(home, 's1').state, 'waiting');
    assert.match(readState(home, 's1').detail, /approval/);
    fire(home, 's1', 'PostToolUse');
    assert.equal(readState(home, 's1').state, 'working', 'after you approve, Claude is busy again');
    fire(home, 's1', 'Stop');
    assert.equal(readState(home, 's1').state, 'waiting');
    assert.match(readState(home, 's1').detail, /your turn/);
    fire(home, 's1', 'SessionEnd');
    assert.equal(readState(home, 's1'), null, 'the file is removed when the session ends');
  } finally {
    rm(home);
  }
});

test('a red alert survives routine events for 2 minutes, and the next prompt clears it', () => {
  const home = tmp();
  try {
    fire(home, 's2', 'UserPromptSubmit');
    // what finish-check / secret-scan / ram-check do:
    const file = path.join(home, '.claude', 'status', 's2.json');
    const st = readState(home, 's2');
    fs.writeFileSync(file, JSON.stringify({ ...st, state: 'alert', detail: 'tests still failing', updatedAt: Date.now() }));
    fire(home, 's2', 'PostToolUse');
    assert.equal(readState(home, 's2').state, 'alert', 'a working tick must not hide a fresh alert');
    fire(home, 's2', 'Stop');
    assert.equal(readState(home, 's2').state, 'alert', 'nor must the end of the turn');
    fire(home, 's2', 'UserPromptSubmit');
    assert.equal(readState(home, 's2').state, 'working', 'your next prompt clears it');
  } finally {
    rm(home);
  }
});

test('"since" only moves when the state changes', () => {
  const home = tmp();
  try {
    fire(home, 's3', 'UserPromptSubmit');
    const first = readState(home, 's3').since;
    fire(home, 's3', 'PostToolUse');
    assert.equal(readState(home, 's3').since, first);
  } finally {
    rm(home);
  }
});

test('the status line shows symbol, name and words (not colour alone) and honours chosen colours', () => {
  const home = tmp();
  try {
    fire(home, 'sl', 'UserPromptSubmit', {}, 'C:/work/gameNight');
    const line = (extraSettings = '') => {
      if (extraSettings) {
        fs.mkdirSync(path.join(home, '.claude', 'harness'), { recursive: true });
        fs.writeFileSync(path.join(home, '.claude', 'harness', 'harness-settings.md'), extraSettings);
      }
      return runHook('statusline', { session_id: 'sl', cwd: 'C:/work/gameNight', model: { display_name: 'Opus' } }, home).raw;
    };
    const plain = runHook('statusline', { session_id: 'sl', cwd: 'C:/work/gameNight' }, home, { NO_COLOR: '1' }).raw;
    assert.equal(plain, '● gameNight · working');
    assert.match(line(), /\x1b\[1;30;42m/, 'working is a solid green block by default');
    assert.match(line('| `STATUS_STYLE` | text | x |\n'), /\x1b\[1;32m/, 'STATUS_STYLE text gives coloured text instead of a block');
    assert.match(line('| `STATUS_COLOR_WORKING` | blue | x |\n'), /\x1b\[1;97;44m/, 'the chosen colour is used (white text on a blue block)');
    assert.match(line('| `STATUS_COLOR_WORKING` | notacolour | x |\n'), /\x1b\[1;30;42m/, 'a misspelt colour falls back to the default');
    assert.match(line(), /WORKING/, 'the words stay in the block, so colour is never the only signal');
    const noSession = runHook('statusline', { session_id: 'unknown', cwd: 'C:/work/other' }, home, { NO_COLOR: '1' }).raw;
    assert.match(noSession, /other/, 'still prints something sensible with no status file');
  } finally {
    rm(home);
  }
});

// ------------------------------------------------------------------ the board
function startBoard(home, port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'tools', 'status-board.mjs')], {
      env: { ...process.env, USERPROFILE: home, HOME: home, STATUS_BOARD_PORT: String(port), CC_NO_TOAST: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      if (out.includes('Status board:')) resolve(child);
    });
    child.stderr.on('data', (d) => reject(new Error(String(d))));
    child.on('error', reject);
    setTimeout(() => reject(new Error('board did not start')), 8000);
  });
}
const get = (port, urlPath, headers = {}, method = 'GET') =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, method, headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });

test('the status board lists sessions, sorted so the ones that need you come first, and is read-only and local', async () => {
  const home = tmp();
  const port = 41000 + Math.floor(Math.random() * 2000);
  let child;
  try {
    fire(home, 'a-working', 'UserPromptSubmit', {}, 'C:/work/alpha');
    fire(home, 'b-waiting', 'Stop', {}, 'C:/work/bravo');
    const alertFile = path.join(home, '.claude', 'status', 'c-alert.json');
    fs.writeFileSync(alertFile, JSON.stringify({ session: 'c-alert', name: 'charlie', cwd: 'x', state: 'alert', detail: 'tests failing', since: Date.now(), updatedAt: Date.now() }));
    fs.writeFileSync(path.join(home, '.claude', 'status', 'd-stuck.json'), JSON.stringify({ session: 'd-stuck', name: 'delta', cwd: 'x', state: 'working', detail: '', since: Date.now() - 3e6, updatedAt: Date.now() - 3e6 }));
    child = await startBoard(home, port);

    const api = await get(port, '/api/status', { Host: `127.0.0.1:${port}` });
    assert.equal(api.status, 200);
    const data = JSON.parse(api.body);
    assert.deepEqual(data.sessions.map((s) => s.name), ['charlie', 'bravo', 'alpha', 'delta'], 'blocked, needs you, working, then no-signal');
    assert.equal(data.sessions[0].state, 'alert');
    assert.equal(data.sessions[3].state, 'stale');
    assert.ok(data.sessions.every((s) => s.word && s.symbol && /^#[0-9a-f]{6}$/i.test(s.color)), 'every tile has a word, a symbol and a colour');

    const page = await get(port, '/', { Host: `127.0.0.1:${port}` });
    assert.equal(page.status, 200);
    assert.ok(!/innerHTML/.test(page.body), 'the page must not use innerHTML');
    assert.match(page.headers['content-security-policy'], /default-src 'none'/);

    assert.equal((await get(port, '/api/status', { Host: 'evil.example.com' })).status, 403, 'wrong Host header (DNS rebinding) is refused');
    assert.equal((await get(port, '/api/status', { Host: `127.0.0.1:${port}` }, 'POST')).status, 405, 'read-only: POST is refused');
    assert.equal((await get(port, '/../../etc/passwd', { Host: `127.0.0.1:${port}` })).status, 404);
  } finally {
    child?.kill();
    rm(home);
  }
});

test('the status board shows a helpful empty state and survives a damaged status file', async () => {
  const home = tmp();
  const port = 43000 + Math.floor(Math.random() * 2000);
  let child;
  try {
    fs.mkdirSync(path.join(home, '.claude', 'status'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'status', 'broken.json'), '{not json');
    child = await startBoard(home, port);
    const api = await get(port, '/api/status', { Host: `127.0.0.1:${port}` });
    assert.deepEqual(JSON.parse(api.body).sessions, []);
    const page = await get(port, '/', { Host: `127.0.0.1:${port}` });
    assert.match(page.body, /No open Claude Code sessions yet/);
    assert.match(page.body, /Cannot reach the status board/);
  } finally {
    child?.kill();
    rm(home);
  }
});
