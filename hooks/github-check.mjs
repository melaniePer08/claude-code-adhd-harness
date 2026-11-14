#!/usr/bin/env node
// SessionStart: tell Claude (and the user) whether this project is connected to GitHub.

import fs from 'node:fs';
import path from 'node:path';
import { readInput, out, git, repoRoot, unpushed, maskRemote, isProtectedDir, pruneState, HOME } from './lib.mjs';

const MARKERS = [
  'package.json', 'pyproject.toml', 'requirements.txt', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle',
  'composer.json', 'Gemfile', 'pubspec.yaml', 'deno.json', 'Makefile', 'CMakeLists.txt', 'index.html',
  'main.py', 'app.py', 'src', 'ProjectSettings', 'project.godot', 'Package.swift', 'CLAUDE.md',
];

function looksLikeProject(dir) {
  try {
    const names = new Set(fs.readdirSync(dir));
    if (MARKERS.some((m) => names.has(m))) return true;
    return [...names].some((n) => /\.(sln|csproj|xcodeproj|uproject|ipynb)$/i.test(n));
  } catch {
    return false;
  }
}

const input = await readInput();
pruneState();

const cwd = input?.cwd || HOME;
if (isProtectedDir(cwd)) process.exit(0);

const root = repoRoot(cwd);
const NOT_CONNECTED =
  'Per section 21 of ~/.claude/CLAUDE.md: before changing any files here, ask the user to create a GitHub repo at ' +
  'https://github.com/new and send you the link. Do not create the repo yourself. Questions and read-only work need no repo.';

if (root) {
  const origin = git(root, ['remote', 'get-url', 'origin']);
  const anyRemote = origin || (git(root, ['remote']) || '').trim().split('\n').filter(Boolean)[0];
  if (!anyRemote) {
    out({
      systemMessage: 'This project is a git repo but has no GitHub remote — Claude will ask you for a repo link before changing files.',
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `Git: ${root} is a git repository with NO remote. ${NOT_CONNECTED}`,
      },
    });
    process.exit(0);
  }
  const u = unpushed(root);
  const where = maskRemote(origin ? origin.trim() : anyRemote);
  const bits = [`Git: ${root} -> ${where}`];
  if (u) {
    bits.push(`branch ${u.branch}`);
    bits.push(u.count ? `${u.count} unpushed commit(s) (a hook auto-pushes at 5)` : 'everything pushed');
  } else {
    bits.push('detached HEAD');
  }
  out({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: bits.join(', ') + '.' } });
  process.exit(0);
}

if (looksLikeProject(cwd)) {
  out({
    systemMessage: 'This folder is not a git repository — Claude will ask you for a GitHub repo link before changing files.',
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `Git: ${cwd} is NOT a git repository. ${NOT_CONNECTED}`,
    },
  });
}
process.exit(0);
