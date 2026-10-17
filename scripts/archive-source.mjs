#!/usr/bin/env node
// Create a source-only review archive (macOS, Linux, Windows 10+).
//
//   npm run archive:source [-- <output.tar.gz>]
//
// Includes tracked files plus untracked files not ignored by .gitignore (so
// uncommitted work is kept), i.e. source, lockfiles, .env.example and all design
// references. Excludes node_modules, .git, virtualenvs, real .env files, caches,
// build output and OS artifacts. Nothing in the working tree is modified or deleted.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const stamp = new Date().toISOString().slice(0, 10);
const output = resolve(
  process.argv[2] ?? join(root, 'archives', `waterpilot-source-${stamp}.tar.gz`),
);

// Defence in depth on top of .gitignore: never ship these even if tracked by mistake.
const DENY = [
  /(^|\/)node_modules\//,
  /(^|\/)\.git\//,
  /(^|\/)\.venv\//,
  /(^|\/)__pycache__\//,
  /(^|\/)\.(pytest|mypy|ruff)_cache\//,
  /(^|\/)(dist|coverage|playwright-report|test-results)\//,
  /(^|\/)(?<!docs\/)build\//,
  /(^|\/)\.local-(object-store|jobs)\//,
  /(^|\/)archives\//,
  /(^|\/)\.DS_Store$/,
  /(^|\/)Thumbs\.db$/,
  /(^|\/)\.env(\.(?!example$)[^/]*)?$/,
  /\.log$/,
];

const listed = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
)
  .split('\0')
  .filter(Boolean);

const files = listed.filter((f) => existsSync(join(root, f)) && !DENY.some((re) => re.test(f)));
const denied = listed.filter((f) => DENY.some((re) => re.test(f)));

for (const required of [
  'package-lock.json',
  'services/backend/uv.lock',
  'apps/web/.env.example',
  'docs/build/implementation-status.md',
]) {
  if (!files.includes(required)) {
    throw new Error(`archive would be missing required file: ${required}`);
  }
}

mkdirSync(dirname(output), { recursive: true });
const listFile = join(tmpdir(), `waterpilot-archive-${process.pid}.txt`);
writeFileSync(listFile, files.join('\n') + '\n');
try {
  execFileSync('tar', ['-czf', output, '-C', root, '-T', listFile], { stdio: 'inherit' });
} finally {
  rmSync(listFile, { force: true });
}

console.log(`[archive] wrote ${files.length} files to ${output}`);
if (denied.length > 0) {
  console.log(`[archive] excluded ${denied.length} listed file(s) by safety denylist:`);
  for (const f of denied) console.log(`  - ${f}`);
}
