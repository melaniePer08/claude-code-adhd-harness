// Owner question form — local only, no packages. Run: node scripts/owner-form/server.mjs
// Reads questions.json next to this file, serves the form on 127.0.0.1, and saves
// answers (autosave) to ../../docs/owner-answers.json. Rule 12 of the harness.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QUESTIONS = path.join(HERE, 'questions.json');
const IMAGES = path.join(HERE, 'images');
const ANSWERS = path.resolve(HERE, '..', '..', 'docs', 'owner-answers.json');
const PORT = Number(process.env.OWNER_FORM_PORT) || 4173;
const HOST = '127.0.0.1'; // never reachable from outside this computer
const MAX_BODY = 1_000_000;
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

const send = (res, code, type, body) => {
  res.writeHead(code, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self'",
  });
  res.end(body);
};
// Strips a leading BOM (Windows editors and PowerShell add one) before parsing.
const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch { return fallback; } };

// Only accept requests addressed to us (blocks DNS rebinding) and, for writes, from our own page.
const hostOk = (req) => { const h = (req.headers.host || '').toLowerCase(); return h === `127.0.0.1:${PORT}` || h === `localhost:${PORT}`; };
const originOk = (req) => { const o = req.headers.origin; return !o || o === `http://127.0.0.1:${PORT}` || o === `http://localhost:${PORT}`; };

http.createServer((req, res) => {
  if (!hostOk(req)) return send(res, 403, 'text/plain', 'Forbidden');
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (req.method === 'GET' && url.pathname === '/') return send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(path.join(HERE, 'index.html')));
  if (req.method === 'GET' && url.pathname === '/api/questions') return send(res, 200, 'application/json', JSON.stringify(readJson(QUESTIONS, { questions: [] })));
  if (req.method === 'GET' && url.pathname === '/api/answers') return send(res, 200, 'application/json', JSON.stringify(readJson(ANSWERS, { answers: {}, submitted: false })));

  if (req.method === 'GET' && url.pathname.startsWith('/images/')) {
    let file;
    try { file = path.resolve(IMAGES, decodeURIComponent(url.pathname.slice('/images/'.length))); } catch { return send(res, 400, 'text/plain', 'Bad request'); }
    const type = MIME[path.extname(file).toLowerCase()];
    if (!file.startsWith(IMAGES + path.sep) || !type || !fs.existsSync(file)) return send(res, 404, 'text/plain', 'Not found');
    return send(res, 200, type, fs.readFileSync(file));
  }

  if (req.method === 'PUT' && url.pathname === '/api/answers') {
    if (!originOk(req)) return send(res, 403, 'text/plain', 'Forbidden');
    let size = 0;
    const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) req.destroy(); else chunks.push(c); });
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const clean = { answers: {}, submitted: body.submitted === true, savedAt: new Date().toISOString() };
        for (const [id, a] of Object.entries(body.answers || {})) {
          clean.answers[String(id).slice(0, 80)] = { choice: String(a.choice ?? '').slice(0, 200), text: String(a.text ?? '').slice(0, 20000) };
        }
        if (typeof body.extra === 'string') clean.extra = body.extra.slice(0, 20000);
        fs.mkdirSync(path.dirname(ANSWERS), { recursive: true });
        fs.writeFileSync(ANSWERS, JSON.stringify(clean, null, 2));
        send(res, 200, 'application/json', '{"ok":true}');
      } catch { send(res, 400, 'text/plain', 'Bad request'); }
    });
    return;
  }
  send(res, 404, 'text/plain', 'Not found');
}).listen(PORT, HOST, () => console.log(`Owner form running: http://${HOST}:${PORT}  (stop with Ctrl+C)`));
