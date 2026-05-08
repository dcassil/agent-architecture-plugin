// Build/CI enforcement detector for dev-genie init-into-existing-repo flow.
// Detects whether package.json scripts (lint/typecheck/audit/build) exist and whether
// build chains lint+typecheck, and whether GitHub Actions workflows run them.
//
// Write helpers (addPackageScripts, addGithubActionsWorkflow) live in
// dev-genie/lib/write-helpers.js — this module is detection-only.
//
// No external deps. Node 18+.

const fs = require('node:fs');
const path = require('node:path');

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function readJsonSafe(p) {
  const raw = readFileSafe(p);
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function detectIndent(raw) {
  // Return the indent string used in a JSON file. Default 2 spaces.
  if (!raw) return '  ';
  const m = raw.match(/^\{\s*\n([ \t]+)/);
  if (m) return m[1];
  return '  ';
}

function listFiles(dir, exts) {
  if (!exists(dir)) return [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of entries) {
    if (e.isFile() && exts.some((x) => e.name.endsWith(x))) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

// --- Tiny YAML "scanner" -------------------------------------------------
// We do not require a YAML parser. We scan workflow files line-by-line for
// shell commands that invoke npm/pnpm/yarn lint|typecheck|audit, or direct
// references to those scripts. This is heuristic but sufficient for reporting
// presence per workflow. Workflow install never edits existing workflow files.

function scanWorkflowForCommands(text) {
  const found = { lint: false, typecheck: false, audit: false, build: false };
  if (!text) return found;
  const lines = text.split(/\r?\n/);
  // patterns for "npm run X", "pnpm X", "yarn X", "npx X", or bare X invocations.
  const tools = ['npm run', 'pnpm run', 'pnpm', 'yarn run', 'yarn', 'npx'];
  const targets = {
    lint: ['lint'],
    typecheck: ['typecheck', 'type-check', 'tsc'],
    audit: ['audit'],
    build: ['build'],
  };
  for (const rawLine of lines) {
    // Only consider lines that look like shell commands (run: foo, or "- run: foo").
    const m = rawLine.match(/^\s*(?:-\s*)?run\s*:\s*(.*)$/i);
    let cmd;
    if (m) {
      cmd = m[1];
      // Strip surrounding quotes.
      cmd = cmd.replace(/^['"]|['"]$/g, '').trim();
    } else {
      // Multi-line "run: |" blocks: just check the line itself as a command.
      cmd = rawLine.trim();
    }
    if (!cmd) continue;
    for (const [key, names] of Object.entries(targets)) {
      if (found[key]) continue;
      for (const n of names) {
        // npm run lint, pnpm lint, yarn lint, npx tsc, or just `tsc` / `eslint .`
        const re = new RegExp(`(^|[\\s;&|])(?:${tools.map(escapeRegex).join('|')})\\s+${escapeRegex(n)}(?:\\b|$)`);
        if (re.test(cmd)) { found[key] = true; break; }
        // direct invocation, e.g. "tsc --noEmit", "eslint ."
        if (n === 'tsc' && /(^|[\s;&|])tsc(\s|$)/.test(cmd)) { found[key] = true; break; }
        if (key === 'lint' && /(^|[\s;&|])eslint(\s|$)/.test(cmd)) { found[key] = true; break; }
      }
    }
  }
  return found;
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// --- Detector ------------------------------------------------------------

function detectScripts(pkg) {
  const wanted = ['lint', 'typecheck', 'type-check', 'audit', 'build'];
  const scripts = (pkg && pkg.scripts) || {};
  const present = {};
  for (const w of wanted) {
    if (Object.prototype.hasOwnProperty.call(scripts, w)) present[w] = scripts[w];
  }
  // Normalize typecheck/type-check.
  const hasTypecheck = !!(present.typecheck || present['type-check']);
  const buildBody = present.build || '';
  // Does build chain lint and typecheck?
  const buildChainsLint =
    /\bnpm\s+run\s+lint\b/.test(buildBody) ||
    /\bpnpm\s+(?:run\s+)?lint\b/.test(buildBody) ||
    /\byarn\s+(?:run\s+)?lint\b/.test(buildBody) ||
    /(^|[\s;&|])eslint(\s|$)/.test(buildBody);
  const buildChainsTypecheck =
    /\bnpm\s+run\s+(?:typecheck|type-check)\b/.test(buildBody) ||
    /\bpnpm\s+(?:run\s+)?(?:typecheck|type-check)\b/.test(buildBody) ||
    /\byarn\s+(?:run\s+)?(?:typecheck|type-check)\b/.test(buildBody) ||
    /(^|[\s;&|])tsc(\s|$)/.test(buildBody);
  return {
    hasPackageJson: !!pkg,
    scripts: {
      lint: !!present.lint,
      typecheck: hasTypecheck,
      audit: !!present.audit,
      build: !!present.build,
    },
    raw: present,
    buildChainsLintAndTypecheck: !!present.build && buildChainsLint && buildChainsTypecheck,
    buildChainsLint: !!present.build && buildChainsLint,
    buildChainsTypecheck: !!present.build && buildChainsTypecheck,
  };
}

function detectWorkflows(repo) {
  const dir = path.join(repo, '.github/workflows');
  if (!exists(dir)) {
    return { found: false, dir: '.github/workflows', workflows: [] };
  }
  const files = listFiles(dir, ['.yml', '.yaml']);
  const workflows = files.map((f) => {
    const rel = path.relative(repo, f);
    const text = readFileSafe(f) || '';
    const cmds = scanWorkflowForCommands(text);
    return {
      file: rel,
      runs: cmds,
      runsAny: cmds.lint || cmds.typecheck || cmds.audit || cmds.build,
    };
  });
  return {
    found: workflows.length > 0,
    dir: '.github/workflows',
    workflows,
    anyRunsLint: workflows.some((w) => w.runs.lint),
    anyRunsTypecheck: workflows.some((w) => w.runs.typecheck),
    anyRunsAudit: workflows.some((w) => w.runs.audit),
    anyRunsBuild: workflows.some((w) => w.runs.build),
  };
}

function detectBuildCI(repoPath) {
  const repo = path.resolve(repoPath);
  if (!exists(repo)) throw new Error(`repo path does not exist: ${repo}`);
  const pkgPath = path.join(repo, 'package.json');
  const pkg = readJsonSafe(pkgPath);
  return {
    repoPath: repo,
    packageJson: detectScripts(pkg),
    ci: detectWorkflows(repo),
  };
}

module.exports = {
  detectBuildCI,
  // exported for tests
  _internal: { scanWorkflowForCommands, detectScripts, detectWorkflows, detectIndent },
};

// Smoke test: when run directly, detect on a path arg or this repo and print.
if (require.main === module) {
  const target = process.argv[2] || path.resolve(__dirname, '../../..');
  const report = detectBuildCI(target);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
