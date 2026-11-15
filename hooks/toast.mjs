// toast.mjs — a Windows desktop pop-up for the serious events in rule 10 (🔴 urgent).
//
// Shared by the hooks that stop Claude (finish-check, secret-scan). Never throws, never blocks, and
// stays quiet on other systems. The same event is announced at most once per THROTTLE window, so a
// failing check can't turn into a stream of pop-ups. Windows hides pop-ups in Focus Assist / Do Not Disturb.

import { spawn } from 'node:child_process';
import { loadState, saveState } from './lib.mjs';

const THROTTLE_MS = 10 * 60 * 1000;

const SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$x = $t.GetElementsByTagName('text')
$x.Item(0).AppendChild($t.CreateTextNode($env:CC_TOAST_TITLE)) | Out-Null
$x.Item(1).AppendChild($t.CreateTextNode($env:CC_TOAST_MSG)) | Out-Null
$id = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}' + [char]92 + 'WindowsPowerShell' + [char]92 + 'v1.0' + [char]92 + 'powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($id).Show((New-Object Windows.UI.Notifications.ToastNotification $t))
`;

/** Show a pop-up. `key` identifies the event so repeats within 10 minutes are skipped. */
export function notifyUser(title, message, key = title) {
  if (process.platform !== 'win32') return false;
  try {
    const st = loadState('toast', 'events');
    const last = Number(st[key]) || 0;
    if (Date.now() - last < THROTTLE_MS) return false;
    st[key] = Date.now();
    saveState('toast', st, 'events');
    spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', SCRIPT], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env, CC_TOAST_TITLE: String(title).slice(0, 80), CC_TOAST_MSG: String(message).slice(0, 200) },
    }).unref();
    return true;
  } catch {
    return false; // a missing pop-up must never break a session
  }
}
