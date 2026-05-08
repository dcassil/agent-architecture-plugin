// dev-genie/scripts/lib/pre-commit.mjs
//
// Detect + (idempotently) install pre-commit enforcement for lint / typecheck / audit.
//
// Exports:
//   detectPreCommit(repoPath)
//     -> {
//          systems: Array<{ system, path, runs: { lint, typecheck, audit }, raw }>,
//          packageManager: 'npm'|'pnpm'|'yarn'|'bun'|null,
//          recommendedDefault: 'husky'|'pre-commit-raw',
//        }
//
//   installPreCommitHooks(repoPath, { system, commands })
//     -> { changed, system, files: [{path, before, after}], summary }
//
// Supported systems: 'husky' | 'lefthook' | 'pre-commit' | 'pre-commit-raw'
//
// Idempotency: each writer replaces a sentinel-marked block (or skips when the
// file already matches the desired output). Re-running is always safe.

import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SENTINEL_BEGIN = '# >>> dev-genie pre-commit >>>';
const SENTINEL_END = '# <<< dev-genie pre-commit <<<';

// ---------- detection ----------

export async function detectPreCommit(repoPath) {
  const scripts = await readScripts(repoPath);
  const lintStaged = await readLintStaged(repoPath);
  const systems = [];

  // Husky
  const huskyDir = path.join(repoPath, '.husky');
  if (await isDir(huskyDir)) {
    const hookPath = path.join(huskyDir, 'pre-commit');
    const raw = (await readIfExists(hookPath)) ?? '';
    systems.push({
      system: 'husky',
      path: hookPath,
      runs: classifyShellHook(raw, scripts, lintStaged),
      raw,
    });
  }

  // lefthook
  for (const f of ['lefthook.yml', 'lefthook.yaml']) {
    const p = path.join(repoPath, f);
    if (existsSync(p)) {
      const raw = (await readIfExists(p)) ?? '';
      systems.push({
        system: 'lefthook',
        path: p,
        runs: classifyLefthook(raw, scripts),
        raw,
      });
      break;
    }
  }

  // pre-commit framework
  const pcConfig = path.join(repoPath, '.pre-commit-config.yaml');
  if (existsSync(pcConfig)) {
    const raw = (await readIfExists(pcConfig)) ?? '';
    systems.push({
      system: 'pre-commit',
      path: pcConfig,
      runs: classifyPreCommitFramework(raw),
      raw,
    });
  }

  // simple-git-hooks (config lives in package.json, not a hook file)
  const pkgJsonPath = path.join(repoPath, 'package.json');
  if (existsSync(pkgJsonPath)) {
    try {
      const pkgRaw = await fs.readFile(pkgJsonPath, 'utf8');
      const pkgJson = JSON.parse(pkgRaw);
      const sgh = pkgJson && pkgJson['simple-git-hooks'];
      if (sgh && typeof sgh === 'object') {
        const hookCmd = sgh['pre-commit'] || '';
        systems.push({
          system: 'simple-git-hooks',
          path: `${pkgJsonPath}#simple-git-hooks`,
          runs: classifyShellHook(String(hookCmd), scripts, lintStaged),
          raw: JSON.stringify(sgh),
        });
      }
    } catch {
      /* ignore */
    }
  }

  // raw git hook
  const gitHook = path.join(repoPath, '.git', 'hooks', 'pre-commit');
  if (existsSync(gitHook)) {
    const raw = (await readIfExists(gitHook)) ?? '';
    systems.push({
      system: 'pre-commit-raw',
      path: gitHook,
      runs: classifyShellHook(raw, scripts, lintStaged),
      raw,
    });
  }

  const packageManager = await detectPackageManager(repoPath);
  const recommendedDefault =
    systems.length === 0 && packageManager ? 'husky' : 'pre-commit-raw';

  return { systems, packageManager, recommendedDefault };
}

async function detectPackageManager(repoPath) {
  if (existsSync(path.join(repoPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(path.join(repoPath, 'yarn.lock'))) return 'yarn';
  if (existsSync(path.join(repoPath, 'bun.lockb'))) return 'bun';
  if (existsSync(path.join(repoPath, 'package-lock.json'))) return 'npm';
  if (existsSync(path.join(repoPath, 'package.json'))) return 'npm';
  return null;
}

async function readScripts(repoPath) {
  const pj = path.join(repoPath, 'package.json');
  if (!existsSync(pj)) return {};
  try {
    const j = JSON.parse(await fs.readFile(pj, 'utf8'));
    return j.scripts ?? {};
  } catch {
    return {};
  }
}

async function readLintStaged(repoPath) {
  // package.json "lint-staged" or .lintstagedrc(.json)
  const pj = path.join(repoPath, 'package.json');
  if (existsSync(pj)) {
    try {
      const j = JSON.parse(await fs.readFile(pj, 'utf8'));
      if (j['lint-staged']) return JSON.stringify(j['lint-staged']);
    } catch {
      /* ignore */
    }
  }
  for (const f of ['.lintstagedrc', '.lintstagedrc.json', '.lintstagedrc.yml']) {
    const p = path.join(repoPath, f);
    if (existsSync(p)) {
      const r = await readIfExists(p);
      if (r) return r;
    }
  }
  return '';
}

function matchesCmd(text, kind) {
  if (!text) return false;
  const t = String(text).toLowerCase();
  if (kind === 'lint') {
    if (/\beslint\b/.test(t)) return true;
    if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?lint\b/.test(t)) return true;
    if (/\bbiome\b.*\b(check|lint)\b/.test(t)) return true;
  }
  if (kind === 'typecheck') {
    if (/\btsc\b/.test(t)) return true;
    if (/\b(typecheck|type-check|tsc:noemit)\b/.test(t)) return true;
  }
  if (kind === 'audit') {
    if (/audit\.mjs/.test(t)) return true;
    if (/\baudit\b/.test(t) && !/npm audit/.test(t) && !/yarn audit/.test(t) && !/pnpm audit/.test(t)) return true;
  }
  return false;
}

function classifyShellHook(raw, scripts, lintStaged) {
  const runs = {
    lint: matchesCmd(raw, 'lint'),
    typecheck: matchesCmd(raw, 'typecheck'),
    audit: matchesCmd(raw, 'audit'),
  };
  // Resolve `npm run X` / pnpm/yarn/bun references against package.json scripts.
  const refs = [
    ...raw.matchAll(/\b(?:npm run|pnpm(?: run)?|yarn(?: run)?|bun run)\s+([a-zA-Z0-9:_-]+)/g),
  ].map((m) => m[1]);
  for (const r of refs) {
    const body = scripts[r];
    if (!body) continue;
    if (matchesCmd(body, 'lint')) runs.lint = true;
    if (matchesCmd(body, 'typecheck')) runs.typecheck = true;
    if (matchesCmd(body, 'audit')) runs.audit = true;
  }
  // lint-staged in hook → look at lint-staged config
  if (/\blint-staged\b/.test(raw) && matchesCmd(lintStaged, 'lint')) {
    runs.lint = true;
  }
  return runs;
}

function classifyLefthook(raw, scripts) {
  const runs = { lint: false, typecheck: false, audit: false };
  const m = raw.match(/(^|\n)pre-commit:\s*\n([\s\S]*?)(?=\n[a-zA-Z_-]+:\s*\n|$)/);
  const block = m ? m[2] : '';
  if (matchesCmd(block, 'lint')) runs.lint = true;
  if (matchesCmd(block, 'typecheck')) runs.typecheck = true;
  if (matchesCmd(block, 'audit')) runs.audit = true;
  // Also resolve npm-script references inside the block.
  const refs = [
    ...block.matchAll(/\b(?:npm run|pnpm(?: run)?|yarn(?: run)?|bun run)\s+([a-zA-Z0-9:_-]+)/g),
  ].map((m) => m[1]);
  for (const r of refs) {
    const body = scripts[r];
    if (!body) continue;
    if (matchesCmd(body, 'lint')) runs.lint = true;
    if (matchesCmd(body, 'typecheck')) runs.typecheck = true;
    if (matchesCmd(body, 'audit')) runs.audit = true;
  }
  return runs;
}

function classifyPreCommitFramework(raw) {
  const runs = { lint: false, typecheck: false, audit: false };
  if (/\b(eslint|lint)\b/i.test(raw)) runs.lint = true;
  if (/\b(tsc|typecheck|type-check|mypy)\b/i.test(raw)) runs.typecheck = true;
  if (/\baudit\b/i.test(raw) && !/npm audit/i.test(raw)) runs.audit = true;
  return runs;
}

// ---------- install ----------

export async function installPreCommitHooks(repoPath, { system, commands, overwrite = false }) {
  if (!system) throw new Error('installPreCommitHooks: `system` is required');
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new Error('installPreCommitHooks: `commands` must be a non-empty array');
  }
  const cmds = commands.map((c) => String(c).trim()).filter(Boolean);

  // Compound systems: split on '+' and run each half.
  const parts = String(system)
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    return installCompound(repoPath, parts, cmds, { overwrite });
  }

  switch (parts[0]) {
    case 'husky':
      return installHusky(repoPath, cmds);
    case 'lefthook':
      return installLefthook(repoPath, cmds);
    case 'pre-commit':
      return installPreCommitFramework(repoPath, cmds);
    case 'pre-commit-raw':
      return installRawHook(repoPath, cmds);
    case 'simple-git-hooks':
      return installSimpleGitHooks(repoPath, cmds, { overwrite });
    case 'lint-staged':
      return installLintStaged(repoPath, cmds, { overwrite });
    default:
      throw new Error(`installPreCommitHooks: unknown system "${system}"`);
  }
}

// ---------- compound systems (e.g. simple-git-hooks + lint-staged) ----------

async function installCompound(repoPath, parts, cmds, { overwrite }) {
  const set = new Set(parts);
  const hasLintStaged = set.has('lint-staged');
  const hasSGH = set.has('simple-git-hooks');

  // Treat any command that mentions eslint/lint as a lint-staged candidate.
  const isLintCmd = (c) => /\beslint\b|\blint\b/i.test(c);
  const lintCmds = cmds.filter(isLintCmd);
  const otherCmds = cmds.filter((c) => !isLintCmd(c));

  const files = [];
  let changed = false;

  if (hasLintStaged && lintCmds.length > 0) {
    const r = await installLintStaged(repoPath, lintCmds, { overwrite });
    files.push(...r.files);
    changed = changed || r.changed;
  }

  if (hasSGH) {
    // Hook command chains lint-staged (if requested) + remaining commands.
    const hookParts = [];
    if (hasLintStaged && lintCmds.length > 0) hookParts.push('npx lint-staged');
    hookParts.push(...otherCmds);
    const hookCmds = hookParts.length > 0 ? hookParts : cmds;
    const r = await installSimpleGitHooks(repoPath, hookCmds, { overwrite });
    files.push(...r.files);
    changed = changed || r.changed;
  }

  return {
    changed,
    system: parts.join(' + '),
    files,
    summary: files.map((f) => `${changed ? 'wrote' : 'no change'}: ${f.path}`).join('\n'),
  };
}

async function installSimpleGitHooks(repoPath, cmds, { overwrite = false } = {}) {
  const file = path.join(repoPath, 'package.json');
  if (!existsSync(file)) {
    return {
      changed: false,
      system: 'simple-git-hooks',
      files: [],
      summary: `simple-git-hooks: package.json not found at ${file}; skipping`,
    };
  }
  const before = await fs.readFile(file, 'utf8');
  const indent = detectJsonIndent(before);
  const trailingNL = before.endsWith('\n') ? '\n' : '';
  const pkg = JSON.parse(before);
  const desired = cmds.join(' && ');

  const sgh = (pkg['simple-git-hooks'] && typeof pkg['simple-git-hooks'] === 'object')
    ? { ...pkg['simple-git-hooks'] }
    : {};
  const current = sgh['pre-commit'];
  if (current && current !== desired && !overwrite) {
    return {
      changed: false,
      system: 'simple-git-hooks',
      files: [{ path: file, before, after: before }],
      summary: `simple-git-hooks: package.json#simple-git-hooks.pre-commit already set to a different value; pass overwrite:true to replace`,
    };
  }
  sgh['pre-commit'] = desired;
  pkg['simple-git-hooks'] = sgh;
  const after = JSON.stringify(pkg, null, indent) + trailingNL;
  return writeJsonIfChanged(file, before, after, 'simple-git-hooks');
}

async function installLintStaged(repoPath, cmds, { overwrite = false } = {}) {
  const file = path.join(repoPath, 'package.json');
  if (!existsSync(file)) {
    return {
      changed: false,
      system: 'lint-staged',
      files: [],
      summary: `lint-staged: package.json not found at ${file}; skipping`,
    };
  }
  const before = await fs.readFile(file, 'utf8');
  const indent = detectJsonIndent(before);
  const trailingNL = before.endsWith('\n') ? '\n' : '';
  const pkg = JSON.parse(before);

  const ls = (pkg['lint-staged'] && typeof pkg['lint-staged'] === 'object')
    ? { ...pkg['lint-staged'] }
    : {};
  const glob = '*.{ts,tsx,js,jsx,mjs,cjs}';
  const desired = cmds.length === 1 ? cmds[0] : cmds.slice();
  const current = ls[glob];

  const same = JSON.stringify(current) === JSON.stringify(desired);
  if (current !== undefined && !same && !overwrite) {
    return {
      changed: false,
      system: 'lint-staged',
      files: [{ path: file, before, after: before }],
      summary: `lint-staged: package.json#lint-staged["${glob}"] already set; pass overwrite:true to replace`,
    };
  }
  ls[glob] = desired;
  pkg['lint-staged'] = ls;
  const after = JSON.stringify(pkg, null, indent) + trailingNL;
  return writeJsonIfChanged(file, before, after, 'lint-staged');
}

function detectJsonIndent(raw) {
  const m = raw.match(/^\{\s*\n([ \t]+)/);
  return m ? m[1] : '  ';
}

async function writeJsonIfChanged(file, before, after, system) {
  if (before === after) {
    return {
      changed: false,
      system,
      files: [{ path: file, before, after }],
      summary: `${system}: ${file} already up to date`,
    };
  }
  await fs.writeFile(file, after, 'utf8');
  return {
    changed: true,
    system,
    files: [{ path: file, before, after }],
    summary: `${system}: updated ${file}`,
  };
}

function buildShellBlock(cmds) {
  const body = cmds.map((c) => `${c} || exit $?`).join('\n');
  return `${SENTINEL_BEGIN}\n# Managed by dev-genie. Do not edit between markers.\n${body}\n${SENTINEL_END}\n`;
}

function replaceOrAppendBlock(text, block) {
  if (!text) return block;
  if (text.includes(SENTINEL_BEGIN) && text.includes(SENTINEL_END)) {
    const re = new RegExp(
      `${escapeRegExp(SENTINEL_BEGIN)}[\\s\\S]*?${escapeRegExp(SENTINEL_END)}\\n?`,
      'm',
    );
    return text.replace(re, block);
  }
  const sep = text.endsWith('\n') ? '' : '\n';
  return text + sep + block;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function installHusky(repoPath, cmds) {
  const dir = path.join(repoPath, '.husky');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, 'pre-commit');
  const before = (await readIfExists(file)) ?? '';
  let next;
  if (!before) {
    next = `#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh" 2>/dev/null || true\n\n${buildShellBlock(cmds)}`;
  } else {
    next = replaceOrAppendBlock(before, buildShellBlock(cmds));
  }
  return writeIfChanged(file, before, next, { mode: 0o755, system: 'husky' });
}

async function installRawHook(repoPath, cmds) {
  const hooksDir = path.join(repoPath, '.git', 'hooks');
  await fs.mkdir(hooksDir, { recursive: true });
  const file = path.join(hooksDir, 'pre-commit');
  const before = (await readIfExists(file)) ?? '';
  let next;
  if (!before) {
    next = `#!/usr/bin/env bash\nset -e\n\n${buildShellBlock(cmds)}`;
  } else {
    next = replaceOrAppendBlock(before, buildShellBlock(cmds));
  }
  return writeIfChanged(file, before, next, { mode: 0o755, system: 'pre-commit-raw' });
}

async function installLefthook(repoPath, cmds) {
  let file = path.join(repoPath, 'lefthook.yml');
  if (existsSync(path.join(repoPath, 'lefthook.yaml'))) {
    file = path.join(repoPath, 'lefthook.yaml');
  }
  const before = (await readIfExists(file)) ?? '';
  const run = cmds.join(' && ');
  const managedBlock =
    `${SENTINEL_BEGIN}\n` +
    `pre-commit:\n` +
    `  commands:\n` +
    `    dev_genie:\n` +
    `      run: ${JSON.stringify(run)}\n` +
    `${SENTINEL_END}\n`;

  let next;
  if (!before.trim()) {
    next = managedBlock;
  } else if (before.includes(SENTINEL_BEGIN)) {
    next = replaceOrAppendBlock(before, managedBlock);
  } else {
    next = before + (before.endsWith('\n') ? '' : '\n') + '\n' + managedBlock;
  }
  return writeIfChanged(file, before, next, { system: 'lefthook' });
}

async function installPreCommitFramework(repoPath, cmds) {
  const file = path.join(repoPath, '.pre-commit-config.yaml');
  const before = (await readIfExists(file)) ?? '';
  const hooks = cmds
    .map((c, i) => {
      const id = `dev-genie-${i + 1}`;
      return (
        `      - id: ${id}\n` +
        `        name: ${id}\n` +
        `        entry: ${JSON.stringify(c)}\n` +
        `        language: system\n` +
        `        pass_filenames: false\n` +
        `        stages: [pre-commit]`
      );
    })
    .join('\n');
  const managedBlock =
    `${SENTINEL_BEGIN}\n` +
    `repos:\n` +
    `  - repo: local\n` +
    `    hooks:\n` +
    `${hooks}\n` +
    `${SENTINEL_END}\n`;

  let next;
  if (!before.trim()) {
    next = managedBlock;
  } else if (before.includes(SENTINEL_BEGIN)) {
    next = replaceOrAppendBlock(before, managedBlock);
  } else {
    next = before + (before.endsWith('\n') ? '' : '\n') + '\n' + managedBlock;
  }
  return writeIfChanged(file, before, next, { system: 'pre-commit' });
}

async function writeIfChanged(file, before, next, { mode, system }) {
  if (before === next) {
    return {
      changed: false,
      system,
      files: [{ path: file, before, after: next }],
      summary: `no change: ${file} already up to date`,
    };
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, next, 'utf8');
  if (mode !== undefined) {
    try {
      await fs.chmod(file, mode);
    } catch {
      /* ignore */
    }
  }
  return {
    changed: true,
    system,
    files: [{ path: file, before, after: next }],
    summary: renderDiff(file, before, next),
  };
}

function renderDiff(file, before, after) {
  const beforeLines = before ? before.split('\n') : [];
  const afterLines = after.split('\n');
  const out = [`--- ${file} (before)`, `+++ ${file} (after)`];
  const max = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < max; i++) {
    const a = beforeLines[i];
    const b = afterLines[i];
    if (a === b) continue;
    if (a !== undefined) out.push(`- ${a}`);
    if (b !== undefined) out.push(`+ ${b}`);
  }
  return out.join('\n');
}

// ---------- helpers ----------

async function isDir(p) {
  try {
    const s = await fs.stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function readIfExists(p) {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return null;
  }
}
