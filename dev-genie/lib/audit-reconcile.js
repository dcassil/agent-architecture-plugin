'use strict';

// dev-genie/lib/audit-reconcile.js
//
// Detect + (idempotently) install the audit plugin's host-repo footprint.
//
// The audit plugin (see ../../audit/) lays down four pieces in a host repo:
//   1. .audit/                       directory                         (configDir)
//      .audit/audit.config.json      seed config + thresholds
//   2. .audit/audit.results.json     baseline composite scores         (baseline)
//   3. a pre-commit hook block invoking audit/scripts/audit.mjs        (hook)
//   4. (optional) a `npm run audit` script in package.json             (scripts)
//   5. dependency-cruiser as devDependency (+ system `scc` binary)     (npmDevDeps)
//
// This module mirrors that exact layout. When generating, it does NOT reinvent
// the seed config; it shells out to `audit/scripts/install-hook.sh` for the
// hook, runs `audit/scripts/audit.mjs --update` for the baseline, and writes
// the same audit.config.json contents the audit-setup skill prescribes.
//
// Public API:
//   detectAudit(repoPath)
//     -> { found, components: { configDir, baseline, hook, scripts, npmDevDeps },
//          missing: string[] }
//
//   installAudit(repoPath, { components })
//     -> { changed: string[], skipped: string[], errors: Array<{component, error}> }

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const pexecFile = promisify(execFile);

const AUDIT_DIR = '.audit';
const AUDIT_CONFIG = path.join(AUDIT_DIR, 'audit.config.json');
const AUDIT_RESULTS = path.join(AUDIT_DIR, 'audit.results.json');

// Required dev dependency. `scc` is a system binary (brew/go install), not npm.
const REQUIRED_DEV_DEPS = ['dependency-cruiser'];

// Seed config — copy of the JSON in audit/skills/audit-setup/SKILL.md step 3.
const SEED_AUDIT_CONFIG = {
  regressionThreshold: 5,
  requireImprovement: false,
  baselines: {
    cycles:        { good: 0,    bad: 0.10 },
    depth:         { good: 4,    bad: 15   },
    roots:         { good: 0.10, bad: 0    },
    avgLoc:        { good: 100,  bad: 400  },
    p90Loc:        { good: 200,  bad: 600  },
    edges:         { good: 2,    bad: 10   },
    orphan:        { good: 0,    bad: 0.20 },
    fan:           { good: 5,    bad: 40   },
    avgComplexity: { good: 5,    bad: 25   },
    maxComplexity: { good: 10,   bad: 60   },
    circularRate:  { good: 0,    bad: 0.10 },
  },
};

// ---------- detection ----------

async function detectAudit(repoPath) {
  const components = {
    configDir: await detectConfigDir(repoPath),
    baseline: await detectBaseline(repoPath),
    hook: await detectHook(repoPath),
    scripts: await detectNpmScript(repoPath),
    npmDevDeps: await detectNpmDevDeps(repoPath),
  };

  const missing = Object.entries(components)
    .filter(([, v]) => !v.present)
    .map(([k]) => k);

  return {
    found: missing.length < Object.keys(components).length,
    components,
    missing,
  };
}

async function detectConfigDir(repoPath) {
  const dir = path.join(repoPath, AUDIT_DIR);
  const cfg = path.join(repoPath, AUDIT_CONFIG);
  const dirExists = await isDir(dir);
  const cfgExists = fs.existsSync(cfg);
  return {
    present: dirExists && cfgExists,
    dirExists,
    configExists: cfgExists,
    path: dir,
    configPath: cfg,
  };
}

async function detectBaseline(repoPath) {
  const p = path.join(repoPath, AUDIT_RESULTS);
  const exists = fs.existsSync(p);
  let valid = false;
  if (exists) {
    try {
      const j = JSON.parse(await fsp.readFile(p, 'utf8'));
      valid = !!(j && j.composites && typeof j.composites.health !== 'undefined');
    } catch {
      valid = false;
    }
  }
  return { present: exists && valid, exists, valid, path: p };
}

async function detectHook(repoPath) {
  // Reuse the same locations as dev-genie/scripts/lib/pre-commit.mjs.
  const candidates = [
    path.join(repoPath, '.husky', 'pre-commit'),
    path.join(repoPath, '.git', 'hooks', 'pre-commit'),
    path.join(repoPath, 'lefthook.yml'),
    path.join(repoPath, 'lefthook.yaml'),
    path.join(repoPath, '.pre-commit-config.yaml'),
  ];
  const hits = [];
  for (const f of candidates) {
    if (!fs.existsSync(f)) continue;
    const raw = (await readIfExists(f)) || '';
    if (mentionsAudit(raw)) hits.push(f);
  }
  return { present: hits.length > 0, locations: hits };
}

function mentionsAudit(raw) {
  if (!raw) return false;
  if (/audit\.mjs/.test(raw)) return true;
  // Sentinel from audit's install-hook.sh
  if (/audit-plugin/.test(raw)) return true;
  // npm-script style — exclude `npm audit` (CVE check, unrelated).
  if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?audit\b/.test(raw) && !/\bnpm audit\b/.test(raw)) {
    return true;
  }
  return false;
}

async function detectNpmScript(repoPath) {
  const pj = await readPackageJson(repoPath);
  const present = !!(pj && pj.scripts && pj.scripts.audit);
  return { present, value: present ? pj.scripts.audit : null };
}

async function detectNpmDevDeps(repoPath) {
  const pj = await readPackageJson(repoPath);
  if (!pj) {
    return {
      present: false,
      hasPackageJson: false,
      missing: REQUIRED_DEV_DEPS.slice(),
      required: REQUIRED_DEV_DEPS.slice(),
    };
  }
  const dev = pj.devDependencies || {};
  const deps = pj.dependencies || {};
  const missing = REQUIRED_DEV_DEPS.filter((d) => !dev[d] && !deps[d]);
  return {
    present: missing.length === 0,
    hasPackageJson: true,
    missing,
    required: REQUIRED_DEV_DEPS.slice(),
  };
}

// ---------- install ----------

async function installAudit(repoPath, { components } = {}) {
  if (!Array.isArray(components) || components.length === 0) {
    throw new Error('installAudit: `components` must be a non-empty array');
  }
  const changed = [];
  const skipped = [];
  const errors = [];

  for (const c of components) {
    try {
      const result = await installOne(repoPath, c);
      (result.changed ? changed : skipped).push(c);
    } catch (e) {
      errors.push({ component: c, error: e.message });
    }
  }
  return { changed, skipped, errors };
}

async function installOne(repoPath, component) {
  switch (component) {
    case 'configDir':  return installConfigDir(repoPath);
    case 'baseline':   return installBaseline(repoPath);
    case 'hook':       return installHook(repoPath);
    case 'scripts':    return installNpmScript(repoPath);
    case 'npmDevDeps': return installNpmDevDeps(repoPath);
    default:
      throw new Error(`installAudit: unknown component "${component}"`);
  }
}

async function installConfigDir(repoPath) {
  const dir = path.join(repoPath, AUDIT_DIR);
  const cfg = path.join(repoPath, AUDIT_CONFIG);
  await fsp.mkdir(dir, { recursive: true });
  if (fs.existsSync(cfg)) return { changed: false }; // never clobber
  await fsp.writeFile(
    cfg,
    JSON.stringify(SEED_AUDIT_CONFIG, null, 2) + '\n',
    'utf8',
  );
  return { changed: true };
}

async function installBaseline(repoPath) {
  // The baseline is generated by running the scanner; we don't fabricate it.
  const auditMjs = path.join(repoPath, 'audit', 'scripts', 'audit.mjs');
  if (!fs.existsSync(auditMjs)) {
    throw new Error(
      `audit plugin not vendored at ${auditMjs}; cannot generate baseline`,
    );
  }
  await pexecFile('node', [auditMjs, '--update', '--repo', repoPath], {
    cwd: repoPath,
  });
  return { changed: true };
}

async function installHook(repoPath) {
  const installer = path.join(repoPath, 'audit', 'scripts', 'install-hook.sh');
  if (!fs.existsSync(installer)) {
    throw new Error(`audit install-hook.sh not found at ${installer}`);
  }
  // The shell script is itself idempotent.
  await pexecFile('bash', [installer], { cwd: repoPath });
  return { changed: true };
}

async function installNpmScript(repoPath) {
  const pjPath = path.join(repoPath, 'package.json');
  if (!fs.existsSync(pjPath)) {
    throw new Error('package.json not found; cannot add audit script');
  }
  const raw = await fsp.readFile(pjPath, 'utf8');
  const pj = JSON.parse(raw);
  pj.scripts = pj.scripts || {};
  if (pj.scripts.audit) return { changed: false };
  pj.scripts.audit = 'node audit/scripts/audit.mjs';
  const out = JSON.stringify(pj, null, 2) + (raw.endsWith('\n') ? '\n' : '');
  await fsp.writeFile(pjPath, out, 'utf8');
  return { changed: true };
}

async function installNpmDevDeps(repoPath) {
  const pjPath = path.join(repoPath, 'package.json');
  if (!fs.existsSync(pjPath)) {
    throw new Error('package.json not found; cannot install dev deps');
  }
  const det = await detectNpmDevDeps(repoPath);
  if (det.missing.length === 0) return { changed: false };
  await pexecFile('npm', ['install', '--save-dev', ...det.missing], {
    cwd: repoPath,
  });
  return { changed: true };
}

// ---------- helpers ----------

async function readPackageJson(repoPath) {
  const p = path.join(repoPath, 'package.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(await fsp.readFile(p, 'utf8'));
  } catch {
    return null;
  }
}

async function readIfExists(p) {
  try {
    return await fsp.readFile(p, 'utf8');
  } catch {
    return null;
  }
}

async function isDir(p) {
  try {
    const s = await fsp.stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

module.exports = { detectAudit, installAudit };
