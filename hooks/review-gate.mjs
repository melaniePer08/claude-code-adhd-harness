#!/usr/bin/env node
// PostToolUse (Bash|PowerShell): a short code review every few commits.
//
// Not after every commit — that would burn tokens on one-line changes. The review
// fires when BOTH are true: at least MIN_COMMITS commits since the last review, and
// enough actually changed to be worth reading. Small commits just accumulate until
// they add up. HARD_CAP stops a long run of tiny commits from never being looked at.
//
// The hook does not review anything itself; it hands Claude a bounded brief so the
// review costs roughly one focused turn.

import { readInput, out, git, repoRoot, gitBusy, diffSize, loadState, saveState, repoKey, stripNoise, commandCwd, HOME } from './lib.mjs';

const MIN_COMMITS = 5; // never review more often than this
const MIN_LINES = 150; // ...and not until this much has changed
const MIN_FILES = 6; // ...or this many files
const HARD_CAP = 15; // ...but never let this many commits go unreviewed

const input = await readInput();
const cmd = input?.tool_input?.command;
if (typeof cmd !== 'string' || !cmd.trim()) process.exit(0);

const clean = stripNoise(cmd);
if (!/\bgit\b[^;&|\n]*\bcommit\b/.test(clean)) process.exit(0);

const root = repoRoot(commandCwd(clean, input.cwd || HOME));
if (!root || gitBusy(root)) process.exit(0);

const head = (git(root, ['rev-parse', 'HEAD']) || '').trim();
if (!head) process.exit(0);

const key = repoKey(root);
const st = loadState(key, 'review');
const baseIsReal = st.base && git(root, ['cat-file', '-e', `${st.base}^{commit}`]) !== null;

// First commit this hook has seen in this repo: start counting from here.
if (!baseIsReal) {
  saveState(key, { base: head, at: Date.now() }, 'review');
  process.exit(0);
}

const count = parseInt((git(root, ['rev-list', '--count', `${st.base}..HEAD`]) || '0').trim(), 10) || 0;
if (count < MIN_COMMITS) process.exit(0);

const size = diffSize(root, [`${st.base}..HEAD`]);
if (!size || size.files === 0) {
  saveState(key, { base: head, at: Date.now() }, 'review');
  process.exit(0);
}

const bigEnough = size.lines >= MIN_LINES || size.files >= MIN_FILES;
if (!bigEnough && count < HARD_CAP) process.exit(0); // let it keep adding up

const range = `${st.base}..HEAD`;
const subjects = (git(root, ['log', '--format=  %h %s', range]) || '').trim().split('\n').slice(0, 15).join('\n');
const fileList = size.paths.slice(0, 25).map((p) => `  ${p}`).join('\n');
const more = size.paths.length > 25 ? `\n  ...and ${size.paths.length - 25} more` : '';

saveState(key, { base: head, at: Date.now() }, 'review');

out({
  systemMessage: `Review checkpoint: ${count} commits / ${size.files} files / ~${size.lines} lines since the last review.`,
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext:
      `REVIEW CHECKPOINT — ${count} commits have gone by in ${root} (${size.files} files, ~${size.lines} lines changed).\n\n` +
      `Commits:\n${subjects}\n\nFiles:\n${fileList}${more}\n\n` +
      `Do a quick review of \`git diff ${range}\` now, before continuing. Read the diff, not the whole repo.\n` +
      'Look only for things that actually break or endanger the project:\n' +
      '  - code that would crash or throw: undefined variables, wrong imports/paths, bad async handling, off-by-one\n' +
      '  - changes that contradict each other across commits, or a half-finished rename\n' +
      '  - leftover debug code, commented-out blocks, stray console.log/print, TODO left in a code path that runs\n' +
      '  - anything unsafe: secrets, missing input validation, missing auth check, unescaped user content\n' +
      '  - obvious UI breakage in changed interface files\n\n' +
      'Rules for this review, so it stays cheap:\n' +
      '  - If the diff is over ~800 lines, review the most important files only and say which ones you skipped.\n' +
      '  - Fix real problems and commit the fixes. Do NOT refactor, rename, restructure or "improve" working code.\n' +
      '  - Do not start new work from this review.\n' +
      '  - Report the result in at most 3 lines: what you checked, what you fixed, or "no problems found".\n' +
      '  - Then carry on with what you were doing.',
  },
});
process.exit(0);
