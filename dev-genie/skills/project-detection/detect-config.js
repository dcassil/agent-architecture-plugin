// Read-only config-detection module for dev-genie init-into-existing-repo flow.
// Scans a target repo and reports what lint/type/format/hook/CI/audit config exists.
// No external deps. Node 18+.

const fs = require('node:fs');
const path = require('node:path');

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function findFirst(repo, candidates) {
  const hits = [];
  for (const rel of candidates) {
    const full = path.join(repo, rel);
    if (exists(full)) hits.push(rel);
  }
  return hits;
}

function listDir(dir, { recursive = false, exts = null } = {}) {
  const out = [];
  if (!exists(dir)) return out;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (recursive) out.push(...listDir(full, { recursive, exts }));
    } else if (e.isFile()) {
      if (!exts || exts.some((x) => e.name.endsWith(x))) out.push(full);
    }
  }
  return out;
}

function detectEslint(repo, pkg) {
  const files = findFirst(repo, [
    'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts',
    '.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.cjs',
    '.eslintrc.yaml', '.eslintrc.yml',
  ]);
  const inPkg = !!(pkg && pkg.eslintConfig);
  if (inPkg) files.push('package.json#eslintConfig');
  const flat = files.some((f) => f.startsWith('eslint.config.'));
  const legacy = files.some((f) => f.startsWith('.eslintrc'));
  let notes = '';
  if (flat && legacy) notes = 'both flat and legacy eslint config detected';
  else if (flat) notes = 'flat config';
  else if (legacy) notes = 'legacy .eslintrc config (consider migration)';
  else if (inPkg) notes = 'eslint config embedded in package.json';
  else notes = 'no eslint config found';
  return { found: files.length > 0, files, notes };
}

function detectTypescript(repo) {
  const files = listDir(repo, { exts: ['.json'] })
    .map((f) => path.relative(repo, f))
    .filter((f) => /^tsconfig.*\.json$/.test(f));
  return {
    found: files.length > 0,
    files,
    notes: files.length ? `${files.length} tsconfig file(s)` : 'no tsconfig found',
  };
}

function detectPrettier(repo, pkg) {
  const files = findFirst(repo, [
    '.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.cjs',
    '.prettierrc.mjs', '.prettierrc.yaml', '.prettierrc.yml', '.prettierrc.toml',
    'prettier.config.js', 'prettier.config.mjs', 'prettier.config.cjs',
  ]);
  const inPkg = !!(pkg && pkg.prettier);
  if (inPkg) files.push('package.json#prettier');
  return {
    found: files.length > 0,
    files,
    notes: files.length ? 'prettier configured' : 'no prettier config',
  };
}

function detectHooks(repo) {
  const files = [];
  const notes = [];
  if (exists(path.join(repo, '.husky'))) {
    const hookFiles = listDir(path.join(repo, '.husky'))
      .map((f) => path.relative(repo, f));
    files.push('.husky/', ...hookFiles);
    notes.push('husky');
  }
  for (const rel of ['lefthook.yml', 'lefthook.yaml', '.pre-commit-config.yaml']) {
    if (exists(path.join(repo, rel))) {
      files.push(rel);
      notes.push(rel.startsWith('lefthook') ? 'lefthook' : 'pre-commit');
    }
  }
  const gitHook = path.join(repo, '.git/hooks/pre-commit');
  if (exists(gitHook)) {
    files.push('.git/hooks/pre-commit');
    notes.push('raw git pre-commit hook');
  }
  return {
    found: files.length > 0,
    files,
    notes: notes.length ? notes.join(', ') : 'no git hooks configured',
  };
}

function detectCI(repo) {
  const files = [];
  const ghDir = path.join(repo, '.github/workflows');
  if (exists(ghDir)) {
    files.push(...listDir(ghDir, { exts: ['.yml', '.yaml'] })
      .map((f) => path.relative(repo, f)));
  }
  for (const rel of ['.gitlab-ci.yml', '.circleci/config.yml']) {
    if (exists(path.join(repo, rel))) files.push(rel);
  }
  const providers = [];
  if (files.some((f) => f.startsWith('.github/'))) providers.push('github-actions');
  if (files.includes('.gitlab-ci.yml')) providers.push('gitlab-ci');
  if (files.includes('.circleci/config.yml')) providers.push('circleci');
  return {
    found: files.length > 0,
    files,
    notes: providers.length ? providers.join(', ') : 'no CI config found',
  };
}

function detectScripts(pkg) {
  if (!pkg || !pkg.scripts) {
    return { found: false, files: [], notes: 'no package.json scripts' };
  }
  const wanted = ['lint', 'typecheck', 'format', 'test', 'build', 'audit'];
  const present = {};
  for (const name of Object.keys(pkg.scripts)) {
    for (const w of wanted) {
      if (name === w || name.startsWith(`${w}:`)) {
        (present[w] ||= []).push(name);
      }
    }
  }
  const matched = Object.keys(present);
  return {
    found: matched.length > 0,
    files: matched.flatMap((k) => present[k].map((n) => `package.json#scripts.${n}`)),
    notes: matched.length
      ? `scripts present: ${matched.join(', ')}; missing: ${wanted.filter((w) => !present[w]).join(', ') || 'none'}`
      : `none of [${wanted.join(', ')}] present`,
  };
}

function detectAudit(repo) {
  const dir = path.join(repo, '.audit');
  if (!exists(dir)) return { found: false, files: [], notes: 'no .audit/ directory' };
  const files = listDir(dir, { recursive: true }).map((f) => path.relative(repo, f));
  return { found: true, files, notes: `.audit/ present (${files.length} file(s))` };
}

function detectPackageManager(repo) {
  const map = {
    'package-lock.json': 'npm',
    'pnpm-lock.yaml': 'pnpm',
    'yarn.lock': 'yarn',
    'bun.lockb': 'bun',
  };
  const files = [];
  const managers = [];
  for (const [rel, name] of Object.entries(map)) {
    if (exists(path.join(repo, rel))) { files.push(rel); managers.push(name); }
  }
  return {
    found: files.length > 0,
    files,
    notes: managers.length === 0
      ? 'no lockfile found'
      : managers.length === 1
        ? `package manager: ${managers[0]}`
        : `multiple lockfiles: ${managers.join(', ')}`,
  };
}

function detectConfig(repoPath) {
  const repo = path.resolve(repoPath);
  if (!exists(repo)) throw new Error(`repo path does not exist: ${repo}`);
  const pkg = readJsonSafe(path.join(repo, 'package.json'));
  return {
    repoPath: repo,
    hasPackageJson: !!pkg,
    eslint: detectEslint(repo, pkg),
    typescript: detectTypescript(repo),
    prettier: detectPrettier(repo, pkg),
    hooks: detectHooks(repo),
    ci: detectCI(repo),
    scripts: detectScripts(pkg),
    audit: detectAudit(repo),
    packageManager: detectPackageManager(repo),
  };
}

module.exports = { detectConfig };

// Smoke test: when run directly, detect on a path arg or this repo and print.
if (require.main === module) {
  const target = process.argv[2] || path.resolve(__dirname, '../../..');
  const report = detectConfig(target);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
