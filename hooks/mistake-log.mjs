#!/usr/bin/env node
// UserPromptSubmit: notice when the user is correcting Claude, so the mistake is written
// down the moment it happens (rule 11.1) — without ever reading old chats.
//
// Hooks that BLOCK Claude (finish-check, commit-guard, secret-scan) already write their own
// line through logMistake() in lib.mjs. This hook covers the other case: the user says
// "you did X again", "that's wrong", "I told you not to…". It only adds a short reminder
// to Claude's context; Claude writes the line itself, because only Claude knows what went wrong.
//
// The pattern is deliberately narrow: a missed correction is cheap, a false alarm on every
// message would be noise.

import { readInput, out } from './lib.mjs';

const CORRECTION = new RegExp(
  [
    String.raw`\byou (?:did|made|forgot|keep|kept|broke|deleted|ignored|missed|didn'?t)\b[^.!?\n]{0,60}\b(?:again|already|before|twice|wrong|not)\b`,
    String.raw`\b(?:that'?s|that is|this is|it'?s) (?:wrong|not right|not what i (?:asked|wanted|said))\b`,
    String.raw`\bi (?:told|asked|said) you (?:not )?to\b`,
    String.raw`\bwhy did you\b`,
    String.raw`\bstop (?:doing|adding|changing|deleting)\b`,
    String.raw`\bnot what i (?:asked|wanted|meant)\b`,
    String.raw`\byou (?:were|are) (?:supposed|meant) to\b`,
  ].join('|'),
  'i'
);

const input = await readInput();
const prompt = String(input?.prompt || '');
if (!prompt || prompt.length > 2000 || !CORRECTION.test(prompt)) process.exit(0);

out({
  suppressOutput: true,
  hookSpecificOutput: {
    hookEventName: 'UserPromptSubmit',
    additionalContext:
      'The user may be correcting you. If you really did make a mistake, add ONE line to ' +
      '`~/.claude/harness/mistakes-log.md` right now: `date · model · project · what went wrong` (rule 11.1; no secrets, ' +
      'no personal data). If the same mistake is already in that file, add one line to `LESSONS.md` too, with the model name (rule 11.2). ' +
      'Then fix the problem. If it was not a mistake, do nothing.',
  },
});
process.exit(0);
