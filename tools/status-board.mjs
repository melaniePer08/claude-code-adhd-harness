#!/usr/bin/env node
// Status board: one coloured tile per open Claude Code terminal, so you can see at a glance which
// project is working, which needs you, and which is blocked.   Run:  node tools/status-board.mjs
// Then open http://127.0.0.1:4174 — on a spare screen, a pinned browser tab, or the side of your monitor.
//
// It only READS the small files the status-update hook writes to ~/.claude/status/. No packages, no network
// access, read-only (GET only), listens on 127.0.0.1 only, never reads project files or secrets.
// Colours come from harness-settings.md (STATUS_COLOR_WORKING / _WAITING / _ALERT).

import http from 'node:http';

const PORT = Number(process.env.STATUS_BOARD_PORT) || 4174;
const HOST = '127.0.0.1';
const STUCK_MS = 20 * 60 * 1000; // "working" with no sign of life for 20 minutes = probably a closed terminal

// The hooks folder sits next to tools/ both in the repo and once installed in ~/.claude/.
const status = await import(new URL('../hooks/status.mjs', import.meta.url));

function snapshot() {
  const now = Date.now();
  const sessions = status.listStatuses().map((s) => {
    const def = status.STATES[s.state];
    const stale = s.state === 'working' && now - (s.updatedAt || 0) > STUCK_MS;
    const color = stale ? { name: 'white', hex: status.COLORS.white.hex } : status.colorFor(s.state);
    return {
      id: s.session,
      name: s.name,
      state: stale ? 'stale' : s.state,
      word: stale ? 'no signal' : def.word,
      symbol: stale ? '○' : def.symbol,
      detail: stale ? 'no activity for 20+ minutes — maybe closed' : s.detail || '',
      color: color.hex,
      colorName: color.name,
      sinceSec: Math.max(0, Math.round((now - (s.since || now)) / 1000)),
      rank: stale ? 3 : def.rank,
    };
  });
  sessions.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return { sessions, at: now };
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claude status</title>
<style>
  :root { --bg:#F6F3EE; --surface:#FFFFFF; --text:#2B2622; --muted:#5F574E; --border:#CFC6BA; --radius:12px; }
  @media (prefers-color-scheme: dark) { :root { --bg:#171513; --surface:#23201D; --text:#EDE8E2; --muted:#B3A99D; --border:#4A423A; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:1rem/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { max-width: 1100px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 1.25rem; margin: 8px 0 4px; }
  .summary { color: var(--muted); margin: 0 0 16px; }
  .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
  .tile { background:var(--surface); border:1px solid var(--border); border-left-width: 14px; border-radius: var(--radius); padding: 16px; min-height: 120px; }
  .name { font-size: 1.5rem; font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; }
  .state { font-size: 1.1rem; margin-top: 6px; font-weight: 600; }
  .detail { color: var(--muted); font-size: .95rem; margin-top: 4px; overflow-wrap: anywhere; }
  .since { color: var(--muted); font-size: .85rem; margin-top: 8px; }
  .empty, .error { border:1px dashed var(--border); border-radius: var(--radius); padding: 24px; color: var(--muted); }
  .error { color: var(--text); border-color: #d64545; }
</style>
</head>
<body>
<main>
  <h1>Claude Code terminals</h1>
  <p class="summary" id="summary" role="status" aria-live="polite">Loading…</p>
  <div class="grid" id="grid"></div>
  <div id="note"></div>
</main>
<script>
var grid = document.getElementById('grid');
var summary = document.getElementById('summary');
var note = document.getElementById('note');

function ago(sec) {
  if (sec < 60) return sec + ' s';
  if (sec < 3600) return Math.floor(sec / 60) + ' min';
  return Math.floor(sec / 3600) + ' h ' + Math.floor((sec % 3600) / 60) + ' min';
}
function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function render(data) {
  note.replaceChildren();
  grid.replaceChildren();
  var s = data.sessions;
  var needs = s.filter(function (x) { return x.state === 'waiting' || x.state === 'alert'; }).length;
  var working = s.filter(function (x) { return x.state === 'working'; }).length;
  summary.textContent = s.length ? (needs + ' need you · ' + working + ' working · ' + s.length + ' open') : '';
  document.title = (needs ? '(' + needs + ') ' : '') + 'Claude status';
  if (!s.length) {
    note.append(el('div', 'empty', 'No open Claude Code sessions yet. Start one in a terminal and it will appear here.'));
    return;
  }
  s.forEach(function (x) {
    var tile = el('div', 'tile');
    tile.style.borderLeftColor = x.color;
    tile.append(el('div', 'name', x.name));
    tile.append(el('div', 'state', x.symbol + ' ' + x.word));
    if (x.detail) tile.append(el('div', 'detail', x.detail));
    tile.append(el('div', 'since', 'for ' + ago(x.sinceSec)));
    grid.append(tile);
  });
}
function tick() {
  var ctl = new AbortController();
  var t = setTimeout(function () { ctl.abort(); }, 3000);
  fetch('/api/status', { signal: ctl.signal, cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('bad status'); return r.json(); })
    .then(render)
    .catch(function () {
      grid.replaceChildren();
      summary.textContent = '';
      note.replaceChildren(el('div', 'error', 'Cannot reach the status board. Is it still running? Start it again with: node tools/status-board.mjs'));
    })
    .finally(function () { clearTimeout(t); });
}
tick();
setInterval(tick, 2000);
</script>
</body>
</html>`;

const hostOk = (req) => {
  const h = String(req.headers.host || '').toLowerCase();
  return h === `127.0.0.1:${PORT}` || h === `localhost:${PORT}`;
};

const send = (res, code, type, body) => {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
  });
  res.end(body);
};

export function createServer() {
  return http.createServer((req, res) => {
    if (!hostOk(req)) return send(res, 403, 'text/plain', 'Forbidden');
    if (req.method !== 'GET') return send(res, 405, 'text/plain', 'Read-only');
    const path = new URL(req.url, `http://${HOST}:${PORT}`).pathname;
    if (path === '/') return send(res, 200, 'text/html; charset=utf-8', PAGE);
    if (path === '/api/status') return send(res, 200, 'application/json', JSON.stringify(snapshot()));
    if (path === '/favicon.ico') {
      res.writeHead(204);
      return res.end();
    }
    return send(res, 404, 'text/plain', 'Not found');
  });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  createServer().listen(PORT, HOST, () => console.log(`Status board: http://${HOST}:${PORT}  (stop with Ctrl+C)`));
}
