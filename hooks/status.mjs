// status.mjs — shared state for the terminal status board (see tools/status-board.mjs).
//
// Every Claude Code session writes ONE small file to ~/.claude/status/<session>.json saying which
// project it is and what it is doing. Three states, so you can see at a glance which terminal needs you:
//
//   working  - Claude is busy; nothing for you to do      (default colour: green,  symbol ●)
//   waiting  - Claude needs you: an answer, an approval, or it finished and it is your turn  (yellow, ◐)
//   alert    - blocked or broken: a check kept failing, a secret was blocked, memory is low   (red,    ■)
//
// Colour is never the only signal: every state also has a word and a symbol (rule 9.7).
// This module never throws and never writes anything except its own small status files.

import fs from 'node:fs';
import path from 'node:path';
import { HOME, harnessSetting } from './lib.mjs';

export const STATUS_DIR = path.join(HOME, '.claude', 'status');
const STALE_MS = 24 * 60 * 60 * 1000;

// Colours you can choose from in harness-settings.md (STATUS_COLOR_*). ansi = terminal code, hex = web page.
export const COLORS = {
  green: { ansi: '32', hex: '#2e9e57' },
  yellow: { ansi: '33', hex: '#d9a21b' },
  red: { ansi: '31', hex: '#d64545' },
  blue: { ansi: '34', hex: '#3b82f6' },
  magenta: { ansi: '35', hex: '#b455c9' },
  cyan: { ansi: '36', hex: '#1aa6b7' },
  orange: { ansi: '38;5;208', hex: '#e8742a' },
  white: { ansi: '37', hex: '#9a9a9a' },
};

export const STATES = {
  working: { setting: 'STATUS_COLOR_WORKING', fallback: 'green', word: 'working', symbol: '●', rank: 2 },
  waiting: { setting: 'STATUS_COLOR_WAITING', fallback: 'yellow', word: 'needs you', symbol: '◐', rank: 1 },
  alert: { setting: 'STATUS_COLOR_ALERT', fallback: 'red', word: 'blocked', symbol: '■', rank: 0 },
};

/** The chosen colour for a state: { name, ansi, hex }. A misspelt setting falls back to the default. */
export function colorFor(state) {
  const s = STATES[state] || STATES.waiting;
  const wanted = String(harnessSetting(s.setting, s.fallback)).trim().toLowerCase();
  const name = COLORS[wanted] ? wanted : s.fallback;
  return { name, ...COLORS[name] };
}

/** Short, readable project name: "appForWriters-main" -> "appForWriters", capped at 16 characters. */
export function shortName(cwd) {
  const base = path.basename(String(cwd || '').replace(/[\\/]+$/, '')) || 'terminal';
  const cleaned = base.replace(/[-_.](main|master|copy|final)$/i, '') || base;
  return cleaned.length > 16 ? `${cleaned.slice(0, 15)}…` : cleaned;
}

const safeId = (sid) => String(sid || 'unknown').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'unknown';
export const statusFile = (sid) => path.join(STATUS_DIR, `${safeId(sid)}.json`);

export function readStatus(sid) {
  try {
    return JSON.parse(fs.readFileSync(statusFile(sid), 'utf8'));
  } catch {
    return null;
  }
}

/** Record what this session is doing. `since` only moves when the state actually changes. */
export function setStatus(sid, state, { cwd, detail = '' } = {}) {
  try {
    if (!STATES[state]) return false;
    const prev = readStatus(sid);
    const now = Date.now();
    const next = {
      session: safeId(sid),
      name: shortName(cwd || prev?.cwd),
      cwd: String(cwd || prev?.cwd || ''),
      state,
      detail: String(detail).replace(/\s+/g, ' ').slice(0, 120),
      since: prev && prev.state === state ? prev.since : now,
      updatedAt: now,
    };
    fs.mkdirSync(STATUS_DIR, { recursive: true });
    const target = statusFile(sid);
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next));
    fs.renameSync(tmp, target);
    return true;
  } catch {
    return false; // status is best effort; it must never break a session
  }
}

export function clearStatus(sid) {
  try {
    fs.unlinkSync(statusFile(sid));
  } catch {
    /* already gone */
  }
}

/** All known sessions. Files untouched for 24 hours are removed (a closed terminal never says goodbye). */
export function listStatuses() {
  const out = [];
  let files = [];
  try {
    files = fs.readdirSync(STATUS_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return out;
  }
  const now = Date.now();
  for (const f of files) {
    const p = path.join(STATUS_DIR, f);
    try {
      if (now - fs.statSync(p).mtimeMs > STALE_MS) {
        fs.unlinkSync(p);
        continue;
      }
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (j && STATES[j.state]) out.push(j);
    } catch {
      /* a half-written or foreign file: skip it */
    }
  }
  return out;
}
