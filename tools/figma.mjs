#!/usr/bin/env node
/**
 * figma.mjs — read a Figma design the way a developer needs to read it.
 *
 * Uses a Figma personal access token and the read-only REST API. No seat type,
 * no monthly tool-call quota, no Figma desktop app.
 *
 *   node figma.mjs pages  <file-url>                     what screens exist
 *   node figma.mjs spec   <file-url> --frame "Home"      exact sizes and spacing
 *   node figma.mjs export <file-url> --frame "Home"      PNGs to look at
 *   node figma.mjs tokens <file-url>                     colours and type scale
 *
 * Options
 *   --frame NAME     one frame, or several: --frame "Home,About"  (default: all)
 *   --page NAME      restrict to one page
 *   --out DIR|FILE   where output goes       (default: a temp folder)
 *   --scale N        export scale, 1-4       (default: 2)
 *   --depth N        how deep `spec` walks   (default: 12)
 *   --max N          node cap for `spec`     (default: 400)
 *
 * The token is read from FIGMA_TOKEN, then ~/.claude/.env, then ./.env.
 * It is never printed, never logged, and never written to any output file.
 * This tool talks to api.figma.com and Figma's image CDN, nothing else.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const API = 'https://api.figma.com/v1';

function out(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}
function fail(error, hint) {
  out({ ok: false, error, ...(hint ? { hint } : {}) });
  process.exit(1);
}

// ------------------------------------------------------------------- the token
function readEnvFile(file) {
  try {
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?FIGMA_(?:PERSONAL_)?(?:ACCESS_)?TOKEN\s*=\s*(.*)$/.exec(raw);
      if (!m) continue;
      // Accept FIGMA_TOKEN=abc, ="abc", and either with a trailing # comment.
      let v = m[1].trim();
      const quoted = /^(['"])([\s\S]*?)\1\s*(?:#.*)?$/.exec(v);
      v = quoted ? quoted[2] : v.replace(/\s+#.*$/, '').trim();
      if (v) return v;
    }
  } catch {
    /* no such file */
  }
  return null;
}

function getToken() {
  const t =
    process.env.FIGMA_TOKEN ||
    process.env.FIGMA_PERSONAL_ACCESS_TOKEN ||
    readEnvFile(path.join(os.homedir(), '.claude', '.env')) ||
    readEnvFile(path.resolve('.env'));
  if (!t) {
    fail(
      'No Figma token found.',
      'Put your token in ~/.claude/.env as FIGMA_TOKEN=... ' +
        '(get one at figma.com -> your avatar -> Settings -> Security -> Personal access tokens).'
    );
  }
  return t;
}

// ------------------------------------------------------------------ arguments
const argv = process.argv.slice(2);
const cmd = argv[0];
const rawFile = argv[1];
const NEEDS_NO_FILE = new Set(['whoami']);
if (!cmd || (!rawFile && !NEEDS_NO_FILE.has(cmd)) || ['-h', '--help'].includes(cmd)) {
  fail('usage: node figma.mjs <pages|spec|export|tokens|whoami> [file-url] [options]');
}
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : dflt;
};
const list = (name) =>
  String(flag(name, '') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const wantFrames = list('frame');
const wantPages = list('page');
const scale = Math.min(4, Math.max(1, parseInt(flag('scale', '2'), 10) || 2));
const maxDepth = parseInt(flag('depth', '12'), 10) || 12;
const maxNodes = parseInt(flag('max', '400'), 10) || 400;
const outArg = flag('out', null);

/** Accepts a full Figma URL or a bare file key. */
function fileKey(s) {
  const m = /(?:figma\.com\/(?:file|design|proto)\/)([A-Za-z0-9]{10,})/.exec(s);
  if (m) return m[1];
  if (/^[A-Za-z0-9]{10,}$/.test(s)) return s;
  return fail(`that does not look like a Figma file link or key: ${s}`);
}

const key = NEEDS_NO_FILE.has(cmd) ? null : fileKey(rawFile);

// Looked up on the first real request, so a typo in the command is reported as a
// typo rather than as a missing token.
let cachedToken = null;
const token = () => (cachedToken ??= getToken());

async function api(pathname) {
  let res;
  try {
    res = await fetch(`${API}${pathname}`, { headers: { 'X-Figma-Token': token() } });
  } catch (e) {
    return fail(`could not reach api.figma.com: ${e.message}`);
  }
  if (res.status === 403) fail('Figma refused the token (403).', 'The token may be wrong, expired, or lack access to this file.');
  if (res.status === 404) fail('Figma has no such file (404).', 'Check the link, and that your account can open it.');
  if (res.status === 429) fail('Figma rate-limited this token (429).', 'Wait a minute and try again.');
  if (!res.ok) fail(`Figma returned ${res.status}`);
  return res.json();
}

// -------------------------------------------------------------------- helpers
const hex = (c) =>
  c
    ? `#${[c.r, c.g, c.b]
        .map((v) => Math.round((v ?? 0) * 255).toString(16).padStart(2, '0'))
        .join('')}${c.a !== undefined && c.a < 1 ? Math.round(c.a * 255).toString(16).padStart(2, '0') : ''}`
    : null;

const round = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : undefined);

function solidFill(node) {
  const f = (node.fills || []).find((x) => x.visible !== false && x.type === 'SOLID');
  return f ? hex({ ...f.color, a: f.opacity ?? f.color?.a ?? 1 }) : null;
}

function defaultOut(kind) {
  return outArg ? path.resolve(outArg) : path.join(os.tmpdir(), 'claude-figma', `${key}-${kind}`);
}

/** Pages and their top-level frames, without pulling the whole document. */
async function getStructure() {
  const doc = await api(`/files/${key}?depth=2`);
  const pages = (doc.document?.children || [])
    .filter((p) => p.type === 'CANVAS')
    .filter((p) => !wantPages.length || wantPages.some((w) => p.name.toLowerCase() === w.toLowerCase()))
    .map((p) => ({
      page: p.name,
      frames: (p.children || [])
        .filter((f) => ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION', 'GROUP'].includes(f.type))
        .map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          width: round(f.absoluteBoundingBox?.width),
          height: round(f.absoluteBoundingBox?.height),
        })),
    }));
  return { name: doc.name, lastModified: doc.lastModified, pages };
}

function pickFrames(structure) {
  const all = structure.pages.flatMap((p) => p.frames.map((f) => ({ ...f, page: p.page })));
  if (!wantFrames.length) return all;
  const picked = [];
  for (const want of wantFrames) {
    const hit = all.find((f) => f.name.toLowerCase() === want.toLowerCase()) || all.find((f) => f.name.toLowerCase().includes(want.toLowerCase()));
    if (hit) picked.push(hit);
    else console.error(`(no frame matching "${want}")`);
  }
  return picked;
}

// ----------------------------------------------------------------- commands
async function cmdPages() {
  const s = await getStructure();
  out({
    ok: true,
    file: s.name,
    lastModified: s.lastModified,
    screens: s.pages.reduce((n, p) => n + p.frames.length, 0),
    pages: s.pages.map((p) => ({
      page: p.page,
      frames: p.frames.map((f) => `${f.name} (${f.width}x${f.height})`),
    })),
    next: 'node figma.mjs spec <url> --frame "<name>"  for exact sizes and spacing',
  });
}

/** The measurements you would otherwise have to read off the canvas by hand. */
function describe(node, depth, parent, acc) {
  if (acc.count >= maxNodes || depth > maxDepth || node.visible === false) return null;
  acc.count++;

  const box = node.absoluteBoundingBox;
  const pbox = parent?.absoluteBoundingBox;
  const entry = {
    name: node.name,
    type: node.type,
    ...(box ? { w: round(box.width), h: round(box.height) } : {}),
    ...(box && pbox ? { x: round(box.x - pbox.x), y: round(box.y - pbox.y) } : {}),
  };

  if (node.layoutMode && node.layoutMode !== 'NONE') {
    entry.layout = node.layoutMode === 'HORIZONTAL' ? 'row' : 'column';
    if (node.itemSpacing) entry.gap = round(node.itemSpacing);
    const p = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft].map((v) => round(v) || 0);
    if (p.some(Boolean)) entry.padding = p.join(' ');
    if (node.primaryAxisAlignItems && node.primaryAxisAlignItems !== 'MIN') entry.justify = node.primaryAxisAlignItems;
    if (node.counterAxisAlignItems && node.counterAxisAlignItems !== 'MIN') entry.align = node.counterAxisAlignItems;
  }

  const fill = solidFill(node);
  if (fill) entry.fill = fill;
  if (node.cornerRadius) entry.radius = round(node.cornerRadius);
  else if (Array.isArray(node.rectangleCornerRadii) && node.rectangleCornerRadii.some(Boolean)) entry.radius = node.rectangleCornerRadii.join(' ');
  if (node.opacity !== undefined && node.opacity < 1) entry.opacity = round(node.opacity);

  const stroke = (node.strokes || []).find((s) => s.visible !== false && s.type === 'SOLID');
  if (stroke) entry.border = `${round(node.strokeWeight) || 1}px ${hex(stroke.color)}`;

  const shadow = (node.effects || []).find((e) => e.visible !== false && /SHADOW/.test(e.type));
  if (shadow) {
    entry.shadow = `${round(shadow.offset?.x) || 0} ${round(shadow.offset?.y) || 0} ${round(shadow.radius) || 0} ${hex(shadow.color)}`;
  }

  if (node.type === 'TEXT') {
    const s = node.style || {};
    entry.text = String(node.characters || '').slice(0, 80);
    entry.font = [s.fontFamily, s.fontWeight, s.fontSize && `${round(s.fontSize)}px`].filter(Boolean).join(' ');
    if (s.lineHeightPx) entry.lineHeight = round(s.lineHeightPx);
    if (s.letterSpacing) entry.letterSpacing = round(s.letterSpacing);
    if (s.textAlignHorizontal && s.textAlignHorizontal !== 'LEFT') entry.textAlign = s.textAlignHorizontal;
  }

  const kids = (node.children || []).map((c) => describe(c, depth + 1, node, acc)).filter(Boolean);
  if (kids.length) entry.children = kids;
  return entry;
}

function toText(entry, indent = 0) {
  const pad = '  '.repeat(indent);
  const bits = Object.entries(entry)
    .filter(([k]) => !['name', 'type', 'children'].includes(k))
    .map(([k, v]) => `${k}=${v}`);
  const lines = [`${pad}${entry.name} [${entry.type}] ${bits.join(' ')}`.trimEnd()];
  for (const c of entry.children || []) lines.push(toText(c, indent + 1));
  return lines.join('\n');
}

async function cmdSpec() {
  const structure = await getStructure();
  const frames = pickFrames(structure);
  if (!frames.length) fail('no matching frames', 'run `pages` first to see the names');

  const ids = frames.map((f) => f.id).slice(0, 10);
  const data = await api(`/files/${key}/nodes?ids=${encodeURIComponent(ids.join(','))}`);
  const dir = defaultOut('spec');
  fs.mkdirSync(dir, { recursive: true });

  const written = [];
  for (const f of frames.slice(0, 10)) {
    const node = data.nodes?.[f.id]?.document;
    if (!node) continue;
    const acc = { count: 0 };
    const tree = describe(node, 0, null, acc);
    const safe = f.name.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60);
    const txt = path.join(dir, `${safe}.txt`);
    fs.writeFileSync(txt, toText(tree), 'utf8');
    fs.writeFileSync(path.join(dir, `${safe}.json`), JSON.stringify(tree, null, 2), 'utf8');
    written.push({ frame: f.name, page: f.page, nodes: acc.count, spec: txt, truncated: acc.count >= maxNodes });
  }

  out({
    ok: true,
    file: structure.name,
    frames: written,
    note: 'x/y are offsets from the parent. padding is "top right bottom left". Read the .txt files — they are the measurements.',
  });
}

async function cmdExport() {
  const structure = await getStructure();
  const frames = pickFrames(structure).slice(0, 20);
  if (!frames.length) fail('no matching frames', 'run `pages` first to see the names');

  const ids = frames.map((f) => f.id);
  const res = await api(`/images/${key}?ids=${encodeURIComponent(ids.join(','))}&format=png&scale=${scale}`);
  if (res.err) fail(`Figma could not render those frames: ${res.err}`);

  const dir = defaultOut('png');
  fs.mkdirSync(dir, { recursive: true });
  const saved = [];
  for (const f of frames) {
    const url = res.images?.[f.id];
    if (!url) continue;
    try {
      const img = await fetch(url);
      if (!img.ok) continue;
      const file = path.join(dir, `${f.name.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60)}.png`);
      fs.writeFileSync(file, Buffer.from(await img.arrayBuffer()));
      saved.push({ frame: f.name, page: f.page, file });
    } catch {
      /* skip the ones that fail rather than losing the whole export */
    }
  }
  out({ ok: true, file: structure.name, scale, images: saved, note: 'Read these PNGs to see the design.' });
}

async function cmdTokens() {
  const doc = await api(`/files/${key}`);
  const colours = new Map();
  const texts = new Map();
  const radii = new Map();
  const gaps = new Map();

  const bump = (map, k) => k && map.set(k, (map.get(k) || 0) + 1);

  (function walk(node, depth) {
    if (!node || depth > 20) return;
    if (node.visible !== false) {
      bump(colours, solidFill(node));
      if (node.cornerRadius) bump(radii, `${round(node.cornerRadius)}px`);
      if (node.itemSpacing) bump(gaps, `${round(node.itemSpacing)}px`);
      if (node.type === 'TEXT' && node.style) {
        const s = node.style;
        bump(texts, `${s.fontFamily || '?'} ${s.fontWeight || ''} ${round(s.fontSize)}px/${round(s.lineHeightPx) || 'auto'}`);
      }
    }
    for (const c of node.children || []) walk(c, depth + 1);
  })(doc.document, 0);

  const top = (map, n) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([value, used]) => ({ value, used }));

  const named = Object.values(doc.styles || {}).reduce((acc, s) => {
    (acc[s.styleType] = acc[s.styleType] || []).push(s.name);
    return acc;
  }, {});

  const palette = top(colours, 24);
  const css = [
    ':root {',
    ...palette.map((c, i) => `  --color-${i + 1}: ${c.value}; /* used ${c.used}x */`),
    '}',
  ].join('\n');

  const dir = defaultOut('tokens');
  fs.mkdirSync(dir, { recursive: true });
  const cssFile = path.join(dir, 'figma-colours.css');
  fs.writeFileSync(cssFile, `${css}\n`, 'utf8');

  out({
    ok: true,
    file: doc.name,
    colours: palette,
    typeScale: top(texts, 16),
    radii: top(radii, 8),
    spacing: top(gaps, 10),
    namedStyles: named,
    cssFile,
    note: 'Sorted by how often each value is actually used — the top entries are the real design system.',
  });
}

/** Is the token working? Reports the account, never the key. */
async function cmdWhoami() {
  const me = await api('/me');
  out({
    ok: true,
    account: me.email || me.handle || '(no email returned)',
    id: me.id ? `${String(me.id).slice(0, 6)}...` : undefined,
    note: 'Token is valid. Its value was never printed.',
  });
}

const commands = { pages: cmdPages, screens: cmdPages, spec: cmdSpec, export: cmdExport, tokens: cmdTokens, whoami: cmdWhoami };
const run = commands[cmd];
if (!run) fail(`unknown command: ${cmd}`, 'use pages, spec, export or tokens');
await run();
