#!/usr/bin/env node
/**
 * shot.mjs — look at a page instead of guessing.
 *
 * Drives the Chrome or Edge already installed on this machine (nothing to install)
 * and returns full-page screenshots at several widths, plus the things that make a
 * page look broken but never show up in the code: console errors, thrown exceptions
 * and requests that 404.
 *
 *   node shot.mjs http://localhost:5173
 *   node shot.mjs http://localhost:5173 --widths 390,1440 --out ./shots
 *   node shot.mjs ./index.html --wait 1500
 *   node shot.mjs http://localhost:5173/pricing --selector "#pricing-table"
 *
 * Options
 *   --widths a,b,c   viewport widths in px            (default 390,768,1440)
 *   --out DIR        where PNGs go                    (default a temp folder)
 *   --wait MS        extra settle time after load     (default 600)
 *   --selector SEL   capture just this element
 *   --height PX      viewport height                  (default 900)
 *   --timeout MS     overall budget                   (default 45000)
 *   --serve DIR      serve this folder instead of guessing the project root
 *   --allow-remote   permit a non-local URL (asks the user first, by hook)
 *
 * Prints a JSON report on stdout: screenshot paths, title, console errors, failed
 * requests. Read the PNGs afterwards — that is the point of the tool.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS TOOL IS NOT ALLOWED TO DO
 *
 * It is not a screen recorder. It launches a separate, empty browser, loads one
 * address, and saves a picture of that page. It never sees the real screen, the
 * real browser, or anything the user is doing. On top of that:
 *
 *   1. Throwaway profile. Every run gets a fresh temporary profile folder that is
 *      deleted afterwards. The user's real Chrome profile — saved passwords,
 *      cookies, logged-in sessions — is never touched, so none of it can appear
 *      in a screenshot. A logged-in page would photograph as a login screen.
 *   2. file:// is refused outright. That is the one scheme that could photograph a
 *      document on disk, so it is blocked with no exception. A local HTML file is
 *      handled by serving its project folder over 127.0.0.1 instead.
 *   3. localhost / 127.0.0.1 only. Any other address needs --allow-remote, which
 *      the dangerous-command hook turns into a confirmation prompt for the user.
 *   4. The built-in static server refuses to leave its root folder, and refuses
 *      dotfiles and key material (.env, *.pem, *.key, credentials) even inside it.
 *      It will not serve a root that is the home folder, Desktop, Documents,
 *      Downloads, AppData or a drive root.
 *   5. Screenshots default to a temp folder, so they are never committed or
 *      uploaded by accident.
 */

import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

function fail(message, extra = {}) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: message, ...extra }, null, 2)}\n`);
  process.exit(1);
}

// ------------------------------------------------------------------ arguments
const argv = process.argv.slice(2);
if (!argv.length || argv[0] === '--help' || argv[0] === '-h') {
  fail('usage: node shot.mjs <url|file> [--widths 390,768,1440] [--out DIR] [--wait MS] [--selector SEL]');
}
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : dflt;
};

const rawTarget = argv[0];
const allowRemote = argv.includes('--allow-remote');
const serveFlag = flag('serve', null);
const widths = String(flag('widths', '390,768,1440'))
  .split(',')
  .map((w) => parseInt(w.trim(), 10))
  .filter((w) => Number.isFinite(w) && w >= 240 && w <= 3840);
const height = parseInt(flag('height', '900'), 10) || 900;
const settle = parseInt(flag('wait', '600'), 10) || 600;
const budget = parseInt(flag('timeout', '45000'), 10) || 45000;
const selector = flag('selector', null);
const outDir = path.resolve(flag('out', path.join(os.tmpdir(), 'claude-shots', String(Date.now()))));

if (!widths.length) fail('no usable widths');

// ------------------------------------------------------------- what to load
// Guardrails live here: no file://, nothing off this machine without approval,
// and no serving a folder that is really the user's home or documents.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);
const ROOT_MARKERS = ['index.html', 'package.json', '.git', 'public', 'src'];

const normPath = (p) => path.resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const OFF_LIMITS = new Set(
  [
    os.homedir(),
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), 'Downloads'),
    path.join(os.homedir(), 'Pictures'),
    path.join(os.homedir(), 'Music'),
    path.join(os.homedir(), 'Videos'),
    path.join(os.homedir(), 'OneDrive'),
    path.join(os.homedir(), 'AppData'),
    path.join(os.homedir(), '.claude'),
    path.join(os.homedir(), '.ssh'),
  ].map(normPath)
);

function assertServable(root) {
  const n = normPath(root);
  if (!n || /^[a-z]:$/.test(n) || n === '/') fail(`refusing to serve a drive root: ${root}`);
  if (OFF_LIMITS.has(n)) {
    fail(
      `refusing to serve ${root} — that is a personal folder, not a project. ` +
        'Point the tool at the project folder itself, or at a dev server URL.'
    );
  }
}

/** Walk up from a file to something that looks like the site root. */
function findRoot(from) {
  let dir = path.resolve(from);
  for (let i = 0; i < 8; i++) {
    if (OFF_LIMITS.has(normPath(dir))) break;
    if (ROOT_MARKERS.some((m) => fs.existsSync(path.join(dir, m)))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(from);
}

function resolveTarget(raw) {
  if (/^file:/i.test(raw)) {
    fail(
      'file:// is not allowed — it could photograph a document on disk. ' +
        'Pass the path itself (node shot.mjs ./index.html) and the folder will be served over 127.0.0.1 instead.'
    );
  }
  if (/^data:/i.test(raw)) fail('data: URLs are not allowed.');

  if (/^https?:/i.test(raw)) {
    let u;
    try {
      u = new URL(raw);
    } catch {
      return fail(`not a valid URL: ${raw}`);
    }
    if (!LOCAL_HOSTS.has(u.hostname) && !allowRemote) {
      fail(
        `${u.hostname} is not this machine. This tool only opens localhost by default. ` +
          'To screenshot a real website, re-run with --allow-remote, which asks the user for permission first.'
      );
    }
    return { url: raw, remote: !LOCAL_HOSTS.has(u.hostname) };
  }

  const abs = path.resolve(raw);
  if (!fs.existsSync(abs)) fail(`no such file or folder: ${abs}`);
  const isDir = fs.statSync(abs).isDirectory();
  const root = serveFlag ? path.resolve(serveFlag) : isDir ? abs : findRoot(path.dirname(abs));
  assertServable(root);
  const rel = isDir ? '' : path.relative(root, abs).replace(/\\/g, '/');
  if (rel.startsWith('..')) fail(`${abs} is outside the folder being served (${root})`);
  return { serveRoot: root, rel };
}

const plan = resolveTarget(rawTarget);
let target = plan.url || '';
let server = null;

// ------------------------------------------------------------- static server
// Only reached for a local folder. Bound to the loopback address, rooted, and
// refuses anything that looks like key material even inside its own root.

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8',
};

const SENSITIVE_FILE =
  /^(?:\..*|.*\.(?:pem|key|ppk|p12|pfx|jks|keystore)|id_(?:rsa|dsa|ecdsa|ed25519)|secrets?\.(?:json|ya?ml|env|txt)|credentials(?:\.json)?)$/i;

function startServer(root) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      } catch {
        res.writeHead(400).end('bad request');
        return;
      }
      let file = path.normalize(path.join(root, pathname));
      // Never leave the root, whatever the URL says.
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403).end('outside the served folder');
        return;
      }
      try {
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      } catch {
        /* fall through to 404 */
      }
      if (SENSITIVE_FILE.test(path.basename(file))) {
        res.writeHead(403).end('not served');
        return;
      }
      fs.readFile(file, (err, buf) => {
        if (err) {
          res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
          return;
        }
        res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' }).end(buf);
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const browser = BROWSERS.find((p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
});
if (!browser) fail('no Chrome or Edge found. Set CHROME_PATH to the browser executable.');

// ------------------------------------------------------------------ utilities
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = Date.now() + budget;
const left = () => Math.max(0, deadline - Date.now());

async function waitFor(fn, { every = 100, what = 'condition' } = {}) {
  while (left() > 0) {
    const v = await fn();
    if (v) return v;
    await sleep(every);
  }
  throw new Error(`timed out waiting for ${what}`);
}

// ------------------------------------------------------------- launch browser
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-shot-'));
const child = spawn(
  browser,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-features=Translate,MediaRouter',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ],
  { stdio: 'ignore', windowsHide: true }
);

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  try {
    child.kill();
  } catch {
    /* already gone */
  }
  try {
    server?.close();
  } catch {
    /* not listening */
  }
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    /* windows may still hold a handle; temp cleans itself */
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});

// ------------------------------------------------------------------- DevTools
let ws;
let nextId = 1;
const pending = new Map();
const consoleErrors = [];
const failedRequests = [];
const requestUrls = new Map(); // requestId -> url, so a failure can name the file

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, Math.min(20000, Math.max(2000, left())));
    pending.set(id, { resolve, reject, timer });
  });
}

function textOf(arg) {
  if (!arg) return '';
  if (arg.type === 'string') return String(arg.value ?? '');
  if ('value' in arg) return JSON.stringify(arg.value);
  return arg.description || arg.className || arg.type || '';
}

function onEvent(msg) {
  const { method, params } = msg;
  if (method === 'Runtime.consoleAPICalled' && (params.type === 'error' || params.type === 'assert')) {
    const text = (params.args || []).map(textOf).join(' ').trim();
    if (text) consoleErrors.push({ kind: 'console.error', text: text.slice(0, 300) });
  } else if (method === 'Runtime.exceptionThrown') {
    const d = params.exceptionDetails || {};
    const text = d.exception?.description || d.text || 'uncaught exception';
    consoleErrors.push({ kind: 'exception', text: String(text).split('\n')[0].slice(0, 300) });
  } else if (method === 'Log.entryAdded' && params.entry?.level === 'error') {
    const e = params.entry;
    // Network failures are reported properly in failedRequests; don't say it twice.
    if (e.source !== 'network') consoleErrors.push({ kind: e.source || 'log', text: String(e.text || '').slice(0, 300), url: e.url });
  } else if (method === 'Network.requestWillBeSent') {
    requestUrls.set(params.requestId, params.request?.url || '');
    if (requestUrls.size > 2000) requestUrls.delete(requestUrls.keys().next().value);
  } else if (method === 'Network.loadingFailed' && !params.canceled) {
    failedRequests.push({ status: params.errorText || 'failed', url: requestUrls.get(params.requestId) || '' });
  } else if (method === 'Network.responseReceived' && params.response?.status >= 400) {
    failedRequests.push({ status: params.response.status, url: params.response.url });
  }
}

async function connect() {
  const portFile = path.join(userDataDir, 'DevToolsActivePort');
  const port = await waitFor(
    () => {
      try {
        const [p] = fs.readFileSync(portFile, 'utf8').split('\n');
        return p && /^\d+$/.test(p.trim()) ? p.trim() : null;
      } catch {
        return null;
      }
    },
    { what: 'the browser to start' }
  );

  const wsUrl = await waitFor(
    async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await res.json();
        return list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl || null;
      } catch {
        return null;
      }
    },
    { what: 'a debuggable page' }
  );

  ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('could not attach to the browser')), { once: true });
  });
  ws.addEventListener('message', (ev) => {
    let msg;
    try {
      msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
    } catch {
      return;
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject, timer } = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(timer);
      if (msg.error) reject(new Error(msg.error.message || 'devtools error'));
      else resolve(msg.result);
    } else if (msg.method) {
      onEvent(msg);
    }
  });
}

async function capture(width, index) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    // Width emulation alone drives the media queries. The mobile flag also switches on
    // the 980px legacy fallback, which distorts any page without a viewport meta tag.
    mobile: false,
    screenWidth: width,
    screenHeight: height,
  });
  await sleep(Math.min(400, settle));

  let clip;
  if (selector) {
    const { root } = await send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector });
    if (!nodeId) throw new Error(`selector not found: ${selector}`);
    const { model } = await send('DOM.getBoxModel', { nodeId });
    const [x1, y1, x2, , , y3] = model.border;
    clip = { x: x1, y: y1, width: Math.ceil(x2 - x1), height: Math.ceil(y3 - y1), scale: 1 };
  } else {
    const { cssContentSize } = await send('Page.getLayoutMetrics');
    clip = {
      x: 0,
      y: 0,
      width,
      height: Math.min(Math.ceil(cssContentSize?.height || height), 12000),
      scale: 1,
    };
  }

  const { data } = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
  const file = path.join(outDir, `${String(index + 1).padStart(2, '0')}-${width}w.png`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return { width, height: clip.height, file };
}

// ----------------------------------------------------------------------- main
try {
  fs.mkdirSync(outDir, { recursive: true });

  if (plan.serveRoot) {
    server = await startServer(plan.serveRoot);
    target = `http://127.0.0.1:${server.address().port}/${plan.rel}`;
  }

  await connect();

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  await send('DOM.enable');

  await send('Emulation.setDeviceMetricsOverride', { width: widths[0], height, deviceScaleFactor: 1, mobile: false });

  const loaded = new Promise((resolve) => {
    const handler = (ev) => {
      try {
        const m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
        if (m.method === 'Page.loadEventFired') {
          ws.removeEventListener('message', handler);
          resolve(true);
        }
      } catch {
        /* not our message */
      }
    };
    ws.addEventListener('message', handler);
  });

  const nav = await send('Page.navigate', { url: target });
  if (nav.errorText) throw new Error(`could not load ${target}: ${nav.errorText}`);
  await Promise.race([loaded, sleep(Math.min(20000, left()))]);
  await sleep(settle);

  const { result: page } = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `({
      title: document.title,
      hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
      lang: document.documentElement.lang || '',
      imagesWithoutAlt: [...document.images].filter(i => !i.hasAttribute('alt')).length,
      bodyText: (document.body?.innerText || '').trim().length
    })`,
  });
  const info = page?.value || {};

  const warnings = [];
  if (!info.hasViewportMeta) warnings.push('No <meta name="viewport"> — the page will not scale correctly on a phone.');
  if (!info.lang) warnings.push('No lang attribute on <html> — screen readers cannot pick a pronunciation.');
  if (info.imagesWithoutAlt) warnings.push(`${info.imagesWithoutAlt} image(s) with no alt attribute.`);
  if (!info.bodyText) warnings.push('The page rendered no text at all — it may have failed to mount.');

  const shots = [];
  for (let i = 0; i < widths.length; i++) shots.push(await capture(widths[i], i));

  // Same URL 404ing on every width would just repeat itself.
  const seen = new Set();
  const uniqueFailures = failedRequests.filter((f) => !seen.has(f.url) && seen.add(f.url)).slice(0, 12);

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        url: target,
        servedFrom: plan.serveRoot || undefined,
        title: info.title || '',
        browser: path.basename(browser),
        screenshots: shots,
        warnings,
        consoleErrors: consoleErrors.slice(0, 12),
        failedRequests: uniqueFailures,
        note: 'Read the PNG files above to actually look at the page.',
      },
      null,
      2
    )}\n`
  );
  cleanup();
  process.exit(0);
} catch (e) {
  cleanup();
  fail(String(e?.message || e), { url: target, browser: path.basename(browser) });
}
