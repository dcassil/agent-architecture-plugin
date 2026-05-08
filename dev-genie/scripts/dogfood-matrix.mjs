#!/usr/bin/env node
// Dogfood matrix for dev-genie reconciliation.
//
// Creates five fixture repos under a temp dir and runs detection (and
// dry-run plan generation) against each. Asserts expected shape on the
// detection report and the comparator findings.
//
// Usage: node dev-genie/scripts/dogfood-matrix.mjs

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { detectConfig } = require('../skills/project-detection/detect-config.js');
const { findLockForPath } = require('../skills/project-detection/detect-agent-config.js');

async function mkRepo(name) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `dgmatrix-${name}-`));
  return root;
}

async function writeFile(root, rel, content) {
  const full = path.join(root, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content);
}

const fixtures = {
  async greenfield() {
    const r = await mkRepo('greenfield');
    return { name: 'greenfield', root: r };
  },
  async claudeLocked() {
    const r = await mkRepo('claude-locked');
    await writeFile(r, 'package.json', JSON.stringify({ name: 'cl', scripts: {} }, null, 2));
    await writeFile(r, 'eslint.config.mjs', 'export default [];\n');
    await writeFile(r, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: false } }, null, 2));
    await writeFile(r, 'CLAUDE.md', '# Project\n\nDo not modify `eslint.config.mjs`.\n');
    return { name: 'claude-locked', root: r };
  },
  async vercelStyleGuide() {
    const r = await mkRepo('vercel-style');
    await writeFile(r, 'package.json', JSON.stringify({
      name: 'vsg',
      scripts: { lint: 'eslint .', typecheck: 'tsc --noEmit' },
      devDependencies: { '@vercel/style-guide': '^6.0.0' },
    }, null, 2));
    await writeFile(r, 'eslint.config.mjs', "import vsg from '@vercel/style-guide/eslint/typescript';\nexport default [...vsg, { rules: { 'no-console': 'error' } }];\n");
    await writeFile(r, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, noUncheckedIndexedAccess: true } }, null, 2));
    return { name: 'vercel-style-guide', root: r };
  },
  async claudeLockedAndVercel() {
    const r = await mkRepo('claude-vsg');
    await writeFile(r, 'package.json', JSON.stringify({
      name: 'cv',
      scripts: { lint: 'eslint .' },
      devDependencies: { '@vercel/style-guide': '^6.0.0' },
    }, null, 2));
    await writeFile(r, 'eslint.config.mjs', "import vsg from '@vercel/style-guide/eslint/typescript';\nexport default [...vsg];\n");
    await writeFile(r, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: true } }, null, 2));
    await writeFile(r, 'AGENTS.md', '```\nlocked:\n  - eslint.config.*\n  - tsconfig.json\n```\n');
    return { name: 'claude-locked-and-vercel', root: r };
  },
  async huskyManaged() {
    const r = await mkRepo('husky');
    await writeFile(r, 'package.json', JSON.stringify({
      name: 'h',
      scripts: { lint: 'eslint .', typecheck: 'tsc --noEmit', prepare: 'husky' },
      devDependencies: { husky: '^9.0.0' },
    }, null, 2));
    await writeFile(r, '.husky/pre-commit', '#!/usr/bin/env sh\nnpm run lint\n');
    await writeFile(r, 'eslint.config.mjs', 'export default [];\n');
    await writeFile(r, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: true } }, null, 2));
    return { name: 'husky-managed', root: r };
  },
};

function assert(cond, msg) {
  if (!cond) {
    process.stderr.write(`  FAIL: ${msg}\n`);
    return false;
  }
  process.stdout.write(`  ok: ${msg}\n`);
  return true;
}

async function run() {
  const results = [];

  for (const [, factory] of Object.entries(fixtures)) {
    const fx = await factory();
    process.stdout.write(`\n--- fixture: ${fx.name} (${fx.root}) ---\n`);
    const detected = detectConfig(fx.root);
    const checks = [];

    if (fx.name === 'greenfield') {
      checks.push(assert(!detected.eslint.found, 'no eslint detected'));
      checks.push(assert(!detected.typescript.found, 'no tsconfig detected'));
      checks.push(assert(detected.agentConfigs.length === 0, 'no agent configs'));
    }

    if (fx.name === 'claude-locked') {
      checks.push(assert(detected.eslint.found, 'eslint detected'));
      checks.push(assert(detected.agentConfigs.length === 1, 'CLAUDE.md detected'));
      const lock = findLockForPath(detected.agentConfigs, 'eslint.config.mjs');
      checks.push(assert(lock && lock.pattern === 'eslint.config.mjs', 'lock matches eslint.config.mjs'));
    }

    if (fx.name === 'vercel-style-guide') {
      checks.push(assert(detected.eslint.found, 'eslint detected'));
      checks.push(assert(detected.scripts.found, 'lint script present'));
      // Comparator behavior validated separately; here we just confirm
      // detection surfaces enough for the comparator to do its work.
      checks.push(assert(/flat/.test(detected.eslint.notes || ''), 'flat config'));
    }

    if (fx.name === 'claude-locked-and-vercel') {
      checks.push(assert(detected.agentConfigs.length === 1, 'AGENTS.md detected'));
      const lock1 = findLockForPath(detected.agentConfigs, 'eslint.config.mjs');
      const lock2 = findLockForPath(detected.agentConfigs, 'tsconfig.json');
      checks.push(assert(!!lock1, 'eslint glob lock matches'));
      checks.push(assert(!!lock2, 'tsconfig.json lock matches'));
    }

    if (fx.name === 'husky-managed') {
      checks.push(assert(detected.hooks.husky === true, 'husky detected'));
      checks.push(assert(detected.hooks.nativePreCommit === false, 'no native git hook'));
    }

    const allOk = checks.every(Boolean);
    results.push({ name: fx.name, root: fx.root, ok: allOk, checks: checks.length });
  }

  process.stdout.write('\n=== SUMMARY ===\n');
  let allOk = true;
  for (const r of results) {
    process.stdout.write(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.checks} checks)\n`);
    if (!r.ok) allOk = false;
  }
  process.exit(allOk ? 0 : 1);
}

run().catch((e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
