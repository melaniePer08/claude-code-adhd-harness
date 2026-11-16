#!/usr/bin/env node
// Claude Code "status line" command: one short coloured line under the prompt of THIS terminal,
// e.g.  ● appForWriters · working     or     ◐ gameNight · needs you · done — your turn
//
// Claude Code runs this and shows whatever it prints. It receives JSON on stdin (session id, folder,
// model). We read this session's status file (written by status-update.mjs) and colour the line with
// the colours chosen in harness-settings.md. Colour is never the only signal: symbol and words too.
// Plain, fast, no network, never throws.

import { readInput } from './lib.mjs';
import { readStatus, shortName, colorFor, STATES } from './status.mjs';

const input = await readInput(1500);
const sid = input?.session_id;
const cwd = input?.workspace?.current_dir || input?.cwd || '';
const st = sid ? readStatus(sid) : null;

const state = st && STATES[st.state] ? st.state : 'waiting';
const s = STATES[state];
const name = st?.name || shortName(cwd);
const color = colorFor(state);
const model = input?.model?.display_name ? ` · ${input.model.display_name}` : '';
const detail = state !== 'working' && st?.detail ? ` · ${st.detail}` : '';

const useColor = !process.env.NO_COLOR;
const paint = (text) => (useColor ? `\x1b[1;${color.ansi}m${text}\x1b[0m` : text);

process.stdout.write(`${paint(`${s.symbol} ${name}`)} · ${s.word}${detail}${model}`);
process.exit(0);
