#!/usr/bin/env node
// SessionStart (matcher: compact): put the top rules back after a long chat was summarized.
//
// Compaction keeps the work but can thin out the instructions behind it. This is the short
// version of the harness's core rules — enough that the habits survive the squeeze.
// (It uses the SessionStart event with source "compact", which supports additional context.)

import { readInput, out } from './lib.mjs';

await readInput();

out({
  suppressOutput: true,
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext:
      'TOP RULES (re-stated after the conversation was compressed):\n' +
      '1. Never hide errors, weaken tests or fake results. "I could not test it" beats a false "it works".\n' +
      '2. Plan first: show the start card (plan, time limit, agents) and wait for ONE yes before real work.\n' +
      '3. Never break into anything: no bypassing logins, paywalls, CAPTCHAs, no leaked keys.\n' +
      '4. Never read, print or write real secrets. The user fills in .env; read .env.example instead.\n' +
      '5. Protect the computer: low free memory means no heavy work. Clean up what you started.\n' +
      '6. Personal data: extreme care, ask before storing any.\n' +
      'Also: explain every command that needs approval part by part, commit each finished piece in plain language, ' +
      'check the project is connected to GitHub before changing files, read PROJECT_MAP.md and NOTES.md first, ' +
      'and report in two layers (short bullets, then details). Details are in the harness rules/ folder.',
  },
});
process.exit(0);
