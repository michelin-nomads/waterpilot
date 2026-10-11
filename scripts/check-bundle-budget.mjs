#!/usr/bin/env node
// Fail when the built web bundle exceeds its gzip budget. Run after `npm run build`.
//
//   npm run budget
//
// Budgets are deliberately close to the Phase 03 baseline (docs/dependencies.md) so a
// heavy dependency or an accidentally eager import shows up in review, not in production.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const BUDGETS = {
  entryJs: 150 * KB,
  entryCss: 8 * KB,
  lazyJs: 40 * KB,
  lazyCss: 20 * KB,
};

const assets = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/web/dist/assets');
if (!existsSync(assets)) {
  console.error(`No build output at ${assets}. Run "npm run build" first.`);
  process.exit(1);
}

const html = readFileSync(join(assets, '../index.html'), 'utf8');
// Chunks the page preloads load with the entry, so they count against the entry budget.
const preloaded = new Set(
  [...html.matchAll(/rel="modulepreload"[^>]*href="\/assets\/([^"]+)"/g)].map((m) => m[1]),
);

const rows = readdirSync(assets)
  .filter((name) => name.endsWith('.js') || name.endsWith('.css'))
  .map((name) => {
    const bytes = readFileSync(join(assets, name));
    const kind = name.endsWith('.css') ? 'Css' : 'Js';
    const role = name.startsWith('index-') || preloaded.has(name) ? 'entry' : 'lazy';
    return { name, kind, role, raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length };
  })
  .sort((a, b) => b.gzip - a.gzip);

const kb = (n) => `${(n / KB).toFixed(2)} kB`;
let failed = false;
const report = (label, raw, gzip, budget) => {
  const over = gzip > budget;
  failed ||= over;
  console.log(
    `${over ? 'OVER' : 'ok  '}  ${label.padEnd(36)} ${kb(raw).padStart(10)} raw  ${kb(gzip).padStart(10)} gzip  (budget ${kb(budget)})`,
  );
};

for (const kind of ['Js', 'Css']) {
  const initial = rows.filter((row) => row.role === 'entry' && row.kind === kind);
  const sum = (key) => initial.reduce((total, row) => total + row[key], 0);
  report(
    `initial ${kind.toLowerCase()} (${initial.length} file${initial.length === 1 ? '' : 's'})`,
    sum('raw'),
    sum('gzip'),
    BUDGETS[`entry${kind}`],
  );
}
for (const row of rows) {
  if (row.role === 'entry') {
    console.log(
      `      ${row.name.padEnd(36)} ${kb(row.raw).padStart(10)} raw  ${kb(row.gzip).padStart(10)} gzip  (initial)`,
    );
  } else {
    report(row.name, row.raw, row.gzip, BUDGETS[`lazy${row.kind}`]);
  }
}

if (failed) {
  console.error('\nBundle budget exceeded. Lazy-load the new code or justify a budget change.');
  process.exit(1);
}
console.log('\nBundle within budget.');
