#!/usr/bin/env node
// PostToolUse hook: after Claude edits certain files, inject a reminder of the
// follow-up steps CLAUDE.md requires. It never blocks — it only adds context.
// Configured in .claude/settings.json (matcher Edit|Write|MultiEdit).
// Docs: https://code.claude.com/docs/en/hooks

import { readFileSync } from 'node:fs';

/** Read the whole hook payload from stdin (fd 0). */
function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function emit(context) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: context,
      },
    }),
  );
}

let input;
try {
  input = JSON.parse(readStdin());
} catch {
  process.exit(0); // malformed payload: say nothing, never block an edit
}

const filePath = input?.tool_input?.file_path ?? '';
// Normalise Windows backslashes so substring checks are platform-independent.
const p = String(filePath).replace(/\\/g, '/');

const reminders = [];

if (p.endsWith('apps/api/src/prisma/contract.prisma')) {
  reminders.push(
    'You edited the Prisma 8 contract. Before considering this done: ' +
      '(1) run `pnpm --filter api exec prisma contract emit` to regenerate ' +
      'contract.json and contract.d.ts, and commit both; ' +
      '(2) apply it to the dev DB with `pnpm --filter api exec prisma db update`; ' +
      '(3) update docs/db-schema.md, which must stay in sync with the contract. ' +
      'See CLAUDE.md > Database (Prisma 8).',
  );
}

if (/(^|\/)packages\/shared\/src\//.test(p) && !p.endsWith('.test.ts')) {
  reminders.push(
    'You edited @repo/shared source. The API imports its built dist/, so ' +
      'rebuild it with `pnpm --filter @repo/shared build` (or rely on `pnpm dev`, ' +
      'which watches it) before API code sees the change. ' +
      'See CLAUDE.md > @repo/shared.',
  );
}

if (reminders.length > 0) {
  emit(reminders.join('\n\n'));
}

process.exit(0);
