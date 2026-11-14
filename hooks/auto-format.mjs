#!/usr/bin/env node
// PostToolUse (Edit|Write): run the project's own formatter on the file that changed.
// Only formatters the project already has are used — nothing is ever installed,
// and a project without a formatter config is left completely alone.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readInput, HOME } from './lib.mjs';

const PRETTIER_EXT = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts', '.css', '.scss', '.less',
  '.html', '.vue', '.svelte', '.json', '.jsonc', '.json5', '.md', '.mdx', '.yaml', '.yml', '.graphql', '.gql',
]);
const BIOME_EXT = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts', '.json', '.jsonc']);
const PRETTIER_CONFIGS = [
  '.prettierrc', '.prettierrc.json', '.prettierrc.json5', '.prettierrc.yml', '.prettierrc.yaml',
  '.prettierrc.js', '.prettierrc.cjs', '.prettierrc.mjs', '.prettierrc.toml',
  'prettier.config.js', 'prettier.config.cjs', 'prettier.config.mjs', 'prettier.config.ts',
];
const ROOT_MARKERS = ['package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', '.git'];

function findUp(from, test) {
  let dir = path.resolve(from);
  for (let i = 0; i < 25; i++) {
    const hit = test(dir);
    if (hit) return { dir, hit };
    const parent = path.dirname(dir);
    if (parent === dir || path.resolve(dir) === path.resolve(HOME)) return null;
    dir = parent;
  }
  return null;
}

const has = (dir, name) => {
  try {
    return fs.existsSync(path.join(dir, name));
  } catch {
    return false;
  }
};

function projectRoot(fileDir) {
  const found = findUp(fileDir, (d) => ROOT_MARKERS.some((m) => has(d, m)));
  return found ? found.dir : null;
}

function prettierConfigDir(fileDir) {
  const found = findUp(fileDir, (d) => {
    if (PRETTIER_CONFIGS.some((c) => has(d, c))) return true;
    try {
      const pkgPath = path.join(d, 'package.json');
      if (fs.existsSync(pkgPath)) return Boolean(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).prettier);
    } catch {
      /* unreadable package.json */
    }
    return false;
  });
  return found ? found.dir : null;
}

function biomeConfigDir(fileDir) {
  const found = findUp(fileDir, (d) => has(d, 'biome.json') || has(d, 'biome.jsonc'));
  return found ? found.dir : null;
}

function resolveBin(fromDir, pkg, binName) {
  try {
    const require = createRequire(path.join(fromDir, 'package.json'));
    const metaPath = require.resolve(`${pkg}/package.json`);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const bin = typeof meta.bin === 'string' ? meta.bin : meta.bin?.[binName] || Object.values(meta.bin || {})[0];
    if (!bin) return null;
    const abs = path.join(path.dirname(metaPath), bin);
    return fs.existsSync(abs) ? abs : null;
  } catch {
    return null;
  }
}

function onPath(cmd) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore', timeout: 5000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function run(cmd, args, cwd) {
  try {
    execFileSync(cmd, args, { cwd, stdio: 'ignore', timeout: 25000, windowsHide: true });
  } catch {
    /* formatting is best effort: a syntax error must not fail the tool call */
  }
}

const input = await readInput();
const file = input?.tool_input?.file_path;
if (!file) process.exit(0);

const abs = path.isAbsolute(file) ? file : path.resolve(input?.cwd || HOME, file);
if (!fs.existsSync(abs) || /[/\\](?:node_modules|\.git|dist|build|out|vendor|\.venv|venv)[/\\]/.test(abs)) process.exit(0);

const ext = path.extname(abs).toLowerCase();
const fileDir = path.dirname(abs);
const root = projectRoot(fileDir);
if (!root) process.exit(0);

if (PRETTIER_EXT.has(ext)) {
  const cfgDir = prettierConfigDir(fileDir);
  if (cfgDir) {
    const bin = resolveBin(cfgDir, 'prettier', 'prettier') || resolveBin(root, 'prettier', 'prettier');
    if (bin) {
      run(process.execPath, [bin, '--write', '--ignore-unknown', abs], cfgDir);
      process.exit(0);
    }
  }
}

if (BIOME_EXT.has(ext)) {
  const cfgDir = biomeConfigDir(fileDir);
  if (cfgDir) {
    const bin = resolveBin(cfgDir, '@biomejs/biome', 'biome') || resolveBin(root, '@biomejs/biome', 'biome');
    if (bin) {
      run(process.execPath, [bin, 'format', '--write', abs], cfgDir);
      process.exit(0);
    }
  }
}

if (ext === '.py') {
  const usesRuff = has(root, 'ruff.toml') || has(root, '.ruff.toml') || /\[tool\.ruff/.test(readIf(path.join(root, 'pyproject.toml')));
  const usesBlack = /\[tool\.black/.test(readIf(path.join(root, 'pyproject.toml')));
  if (usesRuff && onPath('ruff')) run('ruff', ['format', abs], root);
  else if (usesBlack && onPath('black')) run('black', ['-q', abs], root);
  process.exit(0);
}

if (ext === '.go' && onPath('gofmt')) run('gofmt', ['-w', abs], root);

function readIf(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}
process.exit(0);
