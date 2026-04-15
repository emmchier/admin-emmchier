/**
 * @deprecated Use: `node scripts/contentful/export-content-model.mjs --space hub`
 * Kept as a stable entrypoint for existing docs / CI references.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const script = path.join(ROOT, 'scripts', 'contentful', 'export-content-model.mjs');

const r = spawnSync(process.execPath, [script, '--space', 'hub'], {
  stdio: 'inherit',
  cwd: ROOT,
  env: process.env,
});

process.exit(r.status === null ? 1 : r.status);
