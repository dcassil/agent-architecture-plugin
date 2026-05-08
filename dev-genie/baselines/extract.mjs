#!/usr/bin/env node
/**
 * Extract recommended baselines from guardrails/architectures/<arch>/eslint.config.mjs
 * + tsconfig.json + skills/universal-guard-rails/SKILL.md, into JSON descriptors that
 * a comparator can diff against a user's project config.
 *
 * Strategy:
 *   - eslint.config.mjs files are well-formed flat configs. Each top-level config
 *     object has an optional `files:` selector and a `rules: { ... }` object with
 *     rule entries that are plain JSON-compatible literals (no template strings,
 *     no spreads of unknown values in the rule values themselves).
 *   - We parse each eslint.config.mjs by tokenizing top-level config objects
 *     (delimited by balanced braces inside the default-export `tseslint.config(...)`
 *     call) and pulling out two fields per config: `files` (string array) and
 *     `rules` (object literal). We evaluate those slices in a sandboxed `new Function`
 *     so JS-literal forms (arrays, numbers, regex-free objects) survive without
 *     needing JSON.parse strictness.
 *   - We treat the FIRST config block that has a `rules:` and no narrow `files:`
 *     selector (or whose `files:` matches the broad arch glob) as the BASE rules.
 *     Subsequent override blocks (tests, env files, etc.) are recorded as overrides.
 *   - tsconfig.json is read with comments stripped (JSONC) and compilerOptions
 *     captured verbatim.
 *   - universal-guard-rails SKILL.md is parsed for the package.json scripts block,
 *     simple-git-hooks block, and lint-staged block, plus the CI workflow filename.
 *
 * Outputs one JSON per arch under dev-genie/baselines/<arch>.json, plus
 * universal.json. Run via: node dev-genie/baselines/extract.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const ARCH_DIR = join(REPO_ROOT, 'guardrails', 'architectures');
const UNIVERSAL_SKILL = join(
  REPO_ROOT,
  'guardrails',
  'skills',
  'universal-guard-rails',
  'SKILL.md',
);
const OUT_DIR = __dirname;

// ---------------------------------------------------------------------------
// JSONC -> JSON (strip // and /* */ comments, trailing commas)
// ---------------------------------------------------------------------------
function stripJsonc(src) {
  // String-aware comment stripper: walks character-by-character, leaving the
  // contents of "..." strings untouched (so paths like "@/*" survive).
  let out = '';
  let i = 0;
  let inStr = false;
  while (i < src.length) {
    const c = src[i];
    if (inStr) {
      out += c;
      if (c === '\\' && i + 1 < src.length) { out += src[i + 1]; i += 2; continue; }
      if (c === '"') inStr = false;
      i++;
      continue;
    }
    if (c === '"') { inStr = true; out += c; i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length - 1 && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    out += c;
    i++;
  }
  // remove trailing commas before } or ]
  return out.replace(/,(\s*[}\]])/g, '$1');
}

// ---------------------------------------------------------------------------
// Parse eslint.config.mjs flat-config blocks.
// We slice the source between the first `tseslint.config(` and its matching `)`,
// then walk top-level `{ ... }` objects (skipping spreads / function calls).
// ---------------------------------------------------------------------------
function findMatching(src, openIdx, openCh, closeCh) {
  let depth = 0;
  let inStr = null;
  let i = openIdx;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length - 1 && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i++;
      continue;
    }
    if (c === openCh) depth++;
    else if (c === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractTopLevelObjects(inner) {
  // Walk inner content of tseslint.config(...) and return an array of object-literal source slices.
  const objects = [];
  let i = 0;
  let depth = 0;
  let inStr = null;
  while (i < inner.length) {
    const c = inner[i];
    if (inStr) {
      if (c === '\\') { i += 2; continue; }
      if (c === inStr) inStr = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; i++; continue; }
    if (c === '/' && inner[i + 1] === '/') { while (i < inner.length && inner[i] !== '\n') i++; continue; }
    if (c === '/' && inner[i + 1] === '*') { i += 2; while (i < inner.length - 1 && !(inner[i] === '*' && inner[i + 1] === '/')) i++; i += 2; continue; }
    if (depth === 0 && c === '{') {
      const end = findMatching(inner, i, '{', '}');
      if (end < 0) break;
      objects.push(inner.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return objects;
}

function evalLiteral(src) {
  // Evaluate a JS object/array literal with no external references.
  // We strip spreads (...x) by replacing them with nothing — we don't need them
  // for rule extraction since rules are direct entries in the rules object.
  // For values that are spreads (e.g. `...reactHooks.configs.recommended.rules`),
  // we cannot resolve them without running ESLint; we mark them in the output.
  try {
    return new Function(`"use strict"; return (${src});`)();
  } catch (e) {
    return undefined;
  }
}

function extractField(objSrc, fieldName) {
  // Find `fieldName:` at the top level of objSrc and return the source slice
  // of the value (object/array/string/number/etc.) following it.
  // objSrc starts with '{' and ends with '}'.
  const inner = objSrc.slice(1, -1);
  let i = 0;
  let depth = 0;
  let inStr = null;
  const re = new RegExp(`(^|[\\s,{])${fieldName}\\s*:`, 'g');
  while (i < inner.length) {
    const c = inner[i];
    if (inStr) { if (c === '\\') { i += 2; continue; } if (c === inStr) inStr = null; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; i++; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    if (depth === 0) {
      re.lastIndex = i;
      const m = re.exec(inner);
      if (m && m.index === i + (m[1] ? m[1].length === 0 ? 0 : (i === 0 && m[1] === '' ? 0 : 0) : 0) || (m && m.index <= i + 1)) {
        if (m && m.index >= i - 1 && m.index <= i + 1) {
          // Found field at top level. Skip to value start.
          let j = m.index + m[0].length;
          while (j < inner.length && /\s/.test(inner[j])) j++;
          return readValueSlice(inner, j);
        }
      }
    }
    i++;
  }
  // simpler fallback: regex scan ignoring depth (works because field names are unique enough at top level here)
  const m2 = new RegExp(`(?:^|[\\s,{])${fieldName}\\s*:`).exec(inner);
  if (!m2) return null;
  let j = m2.index + m2[0].length;
  while (j < inner.length && /\s/.test(inner[j])) j++;
  return readValueSlice(inner, j);
}

function readValueSlice(src, start) {
  const c = src[start];
  if (c === '{' || c === '[') {
    const close = c === '{' ? '}' : ']';
    const end = findMatching(src, start, c, close);
    return src.slice(start, end + 1);
  }
  // string / number / identifier — read until next top-level , or end
  let i = start;
  let depth = 0;
  let inStr = null;
  while (i < src.length) {
    const ch = src[i];
    if (inStr) { if (ch === '\\') { i += 2; continue; } if (ch === inStr) inStr = null; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; i++; continue; }
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') {
      if (depth === 0) break;
      depth--;
    }
    if (depth === 0 && ch === ',') break;
    i++;
  }
  return src.slice(start, i).trim();
}

function parseRulesObject(rulesSrc) {
  if (!rulesSrc) return { rules: {}, unresolvedSpreads: [] };
  // Replace spread-of-unknown with a placeholder so the literal still parses.
  // We track them separately for transparency.
  const unresolved = [];
  // Strip spreads of the form `...some.chain['key'].more` — bracket-aware.
  let cleaned = '';
  let i = 0;
  while (i < rulesSrc.length) {
    if (rulesSrc[i] === '.' && rulesSrc[i + 1] === '.' && rulesSrc[i + 2] === '.') {
      // consume the spread expression: identifiers, dots, and balanced [..] groups
      let j = i + 3;
      while (j < rulesSrc.length) {
        const c = rulesSrc[j];
        if (/[A-Za-z0-9_$.]/.test(c)) { j++; continue; }
        if (c === '[') {
          const end = findMatching(rulesSrc, j, '[', ']');
          if (end < 0) { j = rulesSrc.length; break; }
          j = end + 1;
          continue;
        }
        break;
      }
      unresolved.push(rulesSrc.slice(i + 3, j));
      i = j;
      // also swallow a trailing comma+whitespace if present
      while (i < rulesSrc.length && /[\s,]/.test(rulesSrc[i])) i++;
      continue;
    }
    cleaned += rulesSrc[i];
    i++;
  }
  // Remove now-empty trailing commas
  cleaned = cleaned.replace(/,\s*,/g, ',').replace(/{\s*,/g, '{').replace(/,\s*}/g, '}');
  const obj = evalLiteral(cleaned);
  return { rules: obj || {}, unresolvedSpreads: unresolved };
}

function extractFilesArray(objSrc) {
  const slice = extractField(objSrc, 'files');
  if (!slice) return null;
  const v = evalLiteral(slice);
  if (Array.isArray(v)) return v;
  return null;
}

function parseEslintConfig(filePath) {
  const src = readFileSync(filePath, 'utf8');
  const callIdx = src.indexOf('tseslint.config(');
  if (callIdx < 0) throw new Error(`tseslint.config( not found in ${filePath}`);
  const openParen = src.indexOf('(', callIdx);
  const closeParen = findMatching(src, openParen, '(', ')');
  const inner = src.slice(openParen + 1, closeParen);
  const blocks = extractTopLevelObjects(inner);

  const result = { base: null, overrides: [], ignores: [] };
  for (const block of blocks) {
    const rulesSrc = extractField(block, 'rules');
    const filesArr = extractFilesArray(block);
    const ignoresSrc = extractField(block, 'ignores');

    if (ignoresSrc && !rulesSrc && !filesArr) {
      const ig = evalLiteral(ignoresSrc);
      if (Array.isArray(ig)) result.ignores.push(...ig);
      continue;
    }
    if (!rulesSrc) continue; // skip blocks with no rules (e.g. globals-only overrides)
    const { rules, unresolvedSpreads } = parseRulesObject(rulesSrc);
    const entry = { files: filesArr, rules, unresolvedSpreads };
    // First rules-bearing block is the architecture's BASE config; everything after
    // is a narrower override (tests, env modules, generated types, etc.).
    if (!result.base) result.base = entry;
    else result.overrides.push(entry);
  }
  return result;
}

function isBroadFiles(filesArr) {
  // A "broad" files selector is one that targets all .ts/.tsx in the project,
  // not a narrow subset (tests, env, generated types, etc.).
  return filesArr.some((f) =>
    /^\*\*\/\*\.(?:\{?ts(?:,tsx)?\}?|tsx?)$/.test(f) ||
    f === '**/*.ts' ||
    f === '**/*.{ts,tsx}',
  ) && !filesArr.some((f) => /test|spec|env|database|tests/i.test(f));
}

// ---------------------------------------------------------------------------
// universal-guard-rails SKILL.md → required scripts, hooks, CI
// ---------------------------------------------------------------------------
function parseUniversalSkill(filePath) {
  const src = readFileSync(filePath, 'utf8');
  const out = {
    requiredScripts: {},
    requiredDevDependencies: {},
    simpleGitHooks: {},
    lintStaged: {},
    ciWorkflow: null,
    agentGuardrailFile: 'AGENTS.md',
    enforcementPoints: [],
  };

  // Extract first ```json fenced block under "package.json scripts"
  const jsonMatch = src.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(stripJsonc(jsonMatch[1]));
      if (parsed.scripts) out.requiredScripts = parsed.scripts;
      if (parsed.devDependencies) out.requiredDevDependencies = parsed.devDependencies;
      if (parsed['simple-git-hooks']) out.simpleGitHooks = parsed['simple-git-hooks'];
      if (parsed['lint-staged']) out.lintStaged = parsed['lint-staged'];
    } catch {
      /* leave empty */
    }
  }

  if (/\.github\/workflows\/verify\.yml/.test(src)) {
    out.ciWorkflow = '.github/workflows/verify.yml';
  }

  out.enforcementPoints.push(
    { stage: 'pre-commit', mechanism: 'simple-git-hooks + lint-staged', runs: ['eslint --max-warnings=0', 'tsc --noEmit'] },
    { stage: 'build', mechanism: 'npm prebuild script', runs: ['npm run verify'] },
    { stage: 'ci', mechanism: out.ciWorkflow || 'GitHub Actions', runs: ['npm run verify'] },
  );

  return out;
}

// ---------------------------------------------------------------------------
// Build a baseline descriptor for a single architecture.
// ---------------------------------------------------------------------------
function buildArchBaseline(archId, archPath) {
  const eslintPath = join(archPath, 'eslint.config.mjs');
  const tsconfigPath = join(archPath, 'tsconfig.json');
  const eslint = parseEslintConfig(eslintPath);
  const tsconfigRaw = readFileSync(tsconfigPath, 'utf8');
  const tsconfig = JSON.parse(stripJsonc(tsconfigRaw));

  return {
    archId,
    source: {
      eslintConfig: `guardrails/architectures/${archId}/eslint.config.mjs`,
      tsconfig: `guardrails/architectures/${archId}/tsconfig.json`,
    },
    eslint: {
      ignores: eslint.ignores,
      base: eslint.base,
      overrides: eslint.overrides,
    },
    tsconfig: {
      compilerOptions: tsconfig.compilerOptions || {},
      include: tsconfig.include || [],
      exclude: tsconfig.exclude || [],
    },
    requiredScripts: {
      lint: 'eslint .',
      typecheck: 'tsc --noEmit',
      verify: 'npm run typecheck && npm run lint',
    },
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
  const archs = readdirSync(ARCH_DIR).filter((n) => {
    const p = join(ARCH_DIR, n);
    return statSync(p).isDirectory();
  });

  const manifest = { architectures: [], universal: 'universal.json' };
  for (const archId of archs) {
    const baseline = buildArchBaseline(archId, join(ARCH_DIR, archId));
    const outFile = join(OUT_DIR, `${archId}.json`);
    writeFileSync(outFile, JSON.stringify(baseline, null, 2) + '\n');
    manifest.architectures.push({ id: archId, file: `${archId}.json` });
    console.log(`wrote ${outFile}`);
  }

  const universal = parseUniversalSkill(UNIVERSAL_SKILL);
  universal.source = 'guardrails/skills/universal-guard-rails/SKILL.md';
  writeFileSync(join(OUT_DIR, 'universal.json'), JSON.stringify(universal, null, 2) + '\n');
  console.log('wrote universal.json');

  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('wrote manifest.json');
}

main();
