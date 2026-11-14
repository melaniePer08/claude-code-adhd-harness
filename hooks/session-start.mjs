#!/usr/bin/env node
// SessionStart (startup|resume): give Claude what it needs to start well (rules 11.3, 11.4, 4.5, 11.5).
//
//   1. LESSONS.md (kept under ~50 lines)            -> read at the start of every session
//   2. PROJECT_MAP.md hint                          -> read the map first, cheaply
//   3. Yesterday's work log, if no summary was made  -> so the next prompt can be built from it
//   4. Weekly reminders: log cleanup offer + improve-system -> once a week, never automatic
//
// Everything is additional context for Claude. Nothing is changed or deleted here.

import fs from 'node:fs';
import path from 'node:path';
import { readInput, out, HARNESS_DIR, LOG_DIR, HOME, stamp, loadState, saveState } from './lib.mjs';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LESSON_LINES = 50;
const MAX_LOG_LINES = 30;

function readLines(file, max) {
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim()).slice(0, max);
  } catch {
    return [];
  }
}

const input = await readInput();
const cwd = input?.cwd || HOME;
const parts = [];

// 1. Lessons (global, then project-level)
const lessons = [
  ...readLines(path.join(HARNESS_DIR, 'LESSONS.md'), MAX_LESSON_LINES),
  ...readLines(path.join(cwd, 'LESSONS.md'), MAX_LESSON_LINES),
];
if (lessons.length) {
  parts.push(`LESSONS (read these before starting; each is a mistake that happened more than once):\n${lessons.slice(0, MAX_LESSON_LINES).join('\n')}`);
}

// 2. Project map
if (fs.existsSync(path.join(cwd, 'PROJECT_MAP.md'))) {
  parts.push('This project has PROJECT_MAP.md — read it first (rule 5.3) instead of opening many files.');
}
if (fs.existsSync(path.join(cwd, 'NOTES.md'))) {
  parts.push('This project has NOTES.md (handoff notes) — check its "In progress" and "Next" sections.');
}

// 3. Yesterday's (or the last) work log
try {
  const today = stamp();
  const logs = fs.readdirSync(LOG_DIR).filter((f) => /^work-\d{4}-\d{2}-\d{2}\.md$/.test(f) && f !== `work-${today}.md`).sort();
  const last = logs[logs.length - 1];
  if (last) {
    const st = loadState('summary', 'start');
    if (st.shown !== last) {
      saveState('summary', { ...st, shown: last }, 'start');
      const lines = readLines(path.join(LOG_DIR, last), MAX_LOG_LINES);
      if (lines.length) {
        parts.push(
          `Work log from ${last.slice(5, 15)} (no end-of-day summary may exist — use this to offer one, rule 11.4):\n${lines.join('\n')}`
        );
      }
    }
  }
} catch {
  /* no logs yet */
}

// 4. Weekly reminders (at most once a week each)
const weekly = loadState('weekly', 'start');
const now = Date.now();
const reminders = [];
if (now - (Number(weekly.cleanup) || 0) > WEEK_MS) {
  reminders.push('📅 Weekly: offer to clean old logs and transcripts (`cleanup` skill, part B). Always ask first — never delete on your own.');
  weekly.cleanup = now;
}
if (now - (Number(weekly.improve) || 0) > WEEK_MS) {
  reminders.push('📅 Weekly: offer the `improve-system` review (work logs + mistakes-log.md + LESSONS.md). Never change a skill without a yes.');
  weekly.improve = now;
}
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
if (fs.existsSync(path.join(HARNESS_DIR, 'RESOURCES.md')) && now - (Number(weekly.resources) || 0) > MONTH_MS) {
  reminders.push('📅 Monthly: offer to refresh RESOURCES.md star counts with `node ~/.claude/tools/refresh-resources.mjs` (a dry run shows the changes first; `--apply` writes them). It only reads public GitHub data.');
  weekly.resources = now;
}
if (reminders.length) {
  saveState('weekly', weekly, 'start');
  parts.push(`${reminders.join('\n')}\nMention these once, briefly, after the user's first request is under way — don't interrupt a task for them.`);
}

if (!parts.length) process.exit(0);

out({
  suppressOutput: true,
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: parts.join('\n\n'),
  },
});
process.exit(0);
