#!/usr/bin/env node
// UserPromptSubmit / Notification / Stop: Windows toast when Claude needs you or is done.
// Short turns stay silent — a toast for a two-second answer is just noise.

import path from 'node:path';
import { spawn } from 'node:child_process';
import { readInput, loadState, saveState, HOME } from './lib.mjs';

const MIN_TURN_MS = 25000;

const PS = `
$ErrorActionPreference = 'SilentlyContinue'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$texts = $template.GetElementsByTagName('text')
$texts.Item(0).AppendChild($template.CreateTextNode($env:CC_TOAST_TITLE)) | Out-Null
$texts.Item(1).AppendChild($template.CreateTextNode($env:CC_TOAST_MSG)) | Out-Null
$toast = New-Object Windows.UI.Notifications.ToastNotification $template
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show($toast)
`;

function toast(title, message) {
  try {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', PS], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env, CC_TOAST_TITLE: String(title).slice(0, 80), CC_TOAST_MSG: String(message).slice(0, 200) },
    });
    child.unref();
  } catch {
    /* a missing toast must never break the session */
  }
}

function humanize(ms) {
  const s = Math.round(ms / 1000);
  return s < 90 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

const input = await readInput();
const session = input?.session_id;
const event = input?.hook_event_name;
const folder = path.basename(input?.cwd || HOME) || 'Claude Code';

if (event === 'UserPromptSubmit') {
  saveState(session, { startedAt: Date.now() }, 'notify');
  process.exit(0);
}

if (event === 'Notification') {
  const type = String(input?.notification_type || '');
  if (/auth/i.test(type)) process.exit(0);
  toast('Claude Code needs you', `${folder}: ${input?.message || 'waiting for your answer'}`);
  process.exit(0);
}

if (event === 'Stop') {
  const st = loadState(session, 'notify');
  const started = Number(st?.startedAt) || 0;
  const elapsed = started ? Date.now() - started : 0;
  if (elapsed >= MIN_TURN_MS) {
    saveState(session, { startedAt: 0 }, 'notify');
    toast('Claude Code finished', `${folder} - took ${humanize(elapsed)}`);
  }
}
process.exit(0);
