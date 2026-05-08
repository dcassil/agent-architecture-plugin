/**
 * Baseline loader for dev-genie.
 *
 * Baselines are JSON descriptors of the recommended config for each
 * guard-rails architecture, generated from the source eslint.config.mjs +
 * tsconfig.json by ./extract.mjs. Re-run `node dev-genie/baselines/extract.mjs`
 * after editing any architecture's source config.
 *
 * Public API:
 *   listArchitectures()          -> Array<{ id, file }>
 *   loadBaseline(archId)         -> arch baseline object
 *   loadUniversal()              -> universal (cross-arch) baseline object
 *   loadAll()                    -> { architectures: { [id]: baseline }, universal }
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readJson(file) {
  return JSON.parse(readFileSync(join(__dirname, file), 'utf8'));
}

let _manifest = null;
function manifest() {
  if (!_manifest) _manifest = readJson('manifest.json');
  return _manifest;
}

export function listArchitectures() {
  return manifest().architectures.slice();
}

export function loadBaseline(archId) {
  const entry = manifest().architectures.find((a) => a.id === archId);
  if (!entry) {
    const known = manifest().architectures.map((a) => a.id).join(', ');
    throw new Error(`Unknown architecture "${archId}". Known: ${known}`);
  }
  return readJson(entry.file);
}

export function loadUniversal() {
  return readJson(manifest().universal);
}

export function loadAll() {
  const architectures = {};
  for (const a of manifest().architectures) architectures[a.id] = readJson(a.file);
  return { architectures, universal: loadUniversal() };
}
