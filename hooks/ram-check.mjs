#!/usr/bin/env node
// PreToolUse (Agent|Task|Bash|PowerShell): protect the computer (rules 4.1, 4.2).
//
//   free memory < START_RAM_GB  -> heavy work (agents, builds, dev servers, browsers) is refused
//   free memory < STOP_RAM_GB   -> same, plus a pop-up and a "stop everything you started" order
//
// Light commands (git, ls, reading files) are never blocked: the point is to stop NEW heavy
// work, not to freeze the session. Values come from harness-settings.md.

import os from 'node:os';
import { spawn } from 'node:child_process';
import { readInput, out, deny, harnessNumber, loadState, saveState } from './lib.mjs';

const GB = 1024 ** 3;
const START = harnessNumber('START_RAM_GB', 4);
const STOP = harnessNumber('STOP_RAM_GB', 3);
const TOAST_EVERY_MS = 10 * 60 * 1000;

const HEAVY_CMD = new RegExp(
  [
    String.raw`\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:dev|start|serve|build|preview|test:e2e)\b`,
    String.raw`\bnpx\s+(?:vite|next|nuxt|astro|webpack|playwright|cypress|puppeteer)\b`,
    String.raw`\b(?:vite|webpack|next|nuxt|astro)\s+(?:dev|build|start)\b`,
    String.raw`shot\.mjs`,
    String.raw`\b(?:playwright|puppeteer|cypress)\b`,
    String.raw`\b(?:chrome|chromium|msedge|firefox)(?:\.exe)?\b`,
    String.raw`\bdocker(?:-compose)?\s+(?:build|up|run|compose)\b`,
    String.raw`\b(?:cargo|go)\s+build\b`,
    String.raw`\b(?:gradle|gradlew|mvn|mvnw)\b`,
    String.raw`\bdotnet\s+(?:build|run)\b`,
    String.raw`\bpython[0-9.]*\s+-m\s+(?:http\.server|uvicorn|flask|django)\b`,
  ].join('|'),
  'i'
);

const PS = `
$ErrorActionPreference = 'SilentlyContinue'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$x = $t.GetElementsByTagName('text')
$x.Item(0).AppendChild($t.CreateTextNode($env:CC_TOAST_TITLE)) | Out-Null
$x.Item(1).AppendChild($t.CreateTextNode($env:CC_TOAST_MSG)) | Out-Null
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show((New-Object Windows.UI.Notifications.ToastNotification $t))
`;

function toast(title, message) {
  if (process.platform !== 'win32') return;
  try {
    spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', PS], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env, CC_TOAST_TITLE: title, CC_TOAST_MSG: message },
    }).unref();
  } catch {
    /* a missing pop-up must never break the session */
  }
}

const input = await readInput();
const tool = String(input?.tool_name || '');
const cmd = String(input?.tool_input?.command || '');

const heavy = tool === 'Agent' || tool === 'Task' || (cmd && HEAVY_CMD.test(cmd));
if (!heavy) process.exit(0);

const freeGb = os.freemem() / GB;
if (freeGb >= START) process.exit(0);

const free = freeGb.toFixed(1);
const critical = freeGb < STOP;

if (critical) {
  const st = loadState('ram', 'toast');
  if (Date.now() - (Number(st.at) || 0) > TOAST_EVERY_MS) {
    saveState('ram', { at: Date.now() }, 'toast');
    toast('Claude Code stopped heavy work', `Only ${free} GB of memory free. Close something, then say "continue".`);
  }
  deny(
    `Memory is very low: only ${free} GB free (stop limit: ${STOP} GB). Heavy work is refused.\n` +
      'Stop every process, server, browser and agent you started (cleanup skill), commit what is finished, ' +
      `and tell the user in one line: "🛑 Stopped: only ${free} GB free. Say 'continue' when ready." Then wait.`
  );
} else {
  deny(
    `Not enough free memory to start heavy work: ${free} GB free, ${START} GB needed (START_RAM_GB).\n` +
      'Do not start agents, builds, dev servers or browsers now. Tell the user in one line, and either do a lighter ' +
      'step that does not need them, or wait until they say there is more memory.'
  );
}
process.exit(0);
