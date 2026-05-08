---
name: audit-setup
description: One-time setup of the audit plugin in a host repo — installs dependency-cruiser + scc, seeds .audit/audit.config.json with default baselines, takes the first composite-score baseline, and registers a pre-commit hook that blocks regressing commits. Use when the user says "set up audit", "install audit plugin", "configure code audit", "add pre-commit quality gate", "enable audit", or asks to wire the audit plugin into a repo.
when_to_invoke: User asks to install / set up / enable / configure the audit plugin in a repo. Also invoke automatically as part of /audit-init.
---

# audit-setup

Walk the user (or yourself, when run agentically) through the full one-time setup of the audit plugin in the current host repo.

## Preconditions

- The plugin lives at `<repoRoot>/audit/`. If `audit/scripts/audit.mjs` does not exist, abort: the plugin is not vendored into this repo.
- The current working directory must be inside a git repo (`git rev-parse --show-toplevel` succeeds).

## Steps

### 1. Verify Node 18+

Run `node --version`. If missing or < 18, abort with:

> Node 18+ is required. Install from https://nodejs.org/ and re-run /audit-init.

### 2. Install required binaries

The audit scanner needs `dependency-cruiser` and `scc`. Pick the install path that matches the host repo:

- **If `<repoRoot>/package.json` exists**: install dependency-cruiser project-locally:
  ```sh
  npm install --save-dev dependency-cruiser
  ```
  Verify it resolves on PATH via `npx depcruise --version` (the scanner's `which depcruise` check requires it on PATH; if project-local, also expose it via `npm bin` / a wrapper, or fall back to a global install).
- **Otherwise** (or if PATH visibility is needed): install globally:
  ```sh
  npm install -g dependency-cruiser
  ```

For `scc` (Go binary):
- macOS: `brew install scc`
- Linux/macOS w/ Go toolchain: `go install github.com/boyter/scc/v3@latest`
- Manual: download a release from https://github.com/boyter/scc/releases and place on PATH.

Verify both:
```sh
which depcruise && depcruise --version
which scc       && scc --version
```

If either is missing, surface the exact install command for the user's platform and stop.

### 3. Create .audit/ and seed audit.config.json

Create the `.audit/` directory in the repo root and write `audit.config.json`:

```json
{
  "regressionThreshold": 5,
  "requireImprovement": false,
  "baselines": {
    "cycles":        { "good": 0,    "bad": 0.10 },
    "depth":         { "good": 4,    "bad": 15   },
    "roots":         { "good": 0.10, "bad": 0    },
    "avgLoc":        { "good": 100,  "bad": 400  },
    "p90Loc":        { "good": 200,  "bad": 600  },
    "edges":         { "good": 2,    "bad": 10   },
    "orphan":        { "good": 0,    "bad": 0.20 },
    "fan":           { "good": 5,    "bad": 40   },
    "avgComplexity": { "good": 5,    "bad": 25   },
    "maxComplexity": { "good": 10,   "bad": 60   },
    "circularRate":  { "good": 0,    "bad": 0.10 }
  }
}
```

These defaults are tuned for typical TypeScript / Node service repos. If the host repo is a monorepo with very different per-package shapes, the user can hand-tune them later — but DO NOT tune weights (those are hard-coded in the plugin so scores stay comparable across projects).

### 4. Take the baseline scan

Run from the repo root:

```sh
node audit/scripts/audit.mjs --update
```

This performs a full scan, computes the four composites, and writes `.audit/audit.results.json`. Confirm to the user:

- All four composites (architecture, maintainability, testability, health) printed with non-zero values.
- A `.audit/audit.results.json` file now exists.

### 5. Install the pre-commit hook

```sh
bash audit/scripts/install-hook.sh
```

This is idempotent: re-running updates the audit block in place. If the host repo already has a pre-commit hook (husky, pre-commit framework, custom), the script appends the audit block behind sentinel markers without clobbering existing logic.

### 6. Verify the hook

Stage a no-op change (e.g. `touch .audit/.audit-installed && git add .audit/`) and run the hook directly:

```sh
.git/hooks/pre-commit
```

Expected: exit 0 with `audit: pass.` line.

### 7. Commit the .audit/ baseline

The `.audit/audit.config.json` AND `.audit/audit.results.json` files MUST be committed to source control so all developers (and CI, if added later) share the same baseline. Add them and commit with a message like:

```
chore(audit): install audit plugin and record baseline
```

The `.git/hooks/pre-commit` itself is local-only and is auto-installed by anyone who runs `bash audit/scripts/install-hook.sh` after clone.

## Notes & flags

- `requireImprovement: true` blocks any commit that does NOT improve scores. Only enable this during an active refactor campaign — leaving it on in steady state will block ordinary feature work.
- Re-baseline after a large intentional refactor with `node audit/scripts/audit.mjs --update` (or `/audit-run`).
- The pre-commit hook is read-only — it never writes the results file. Only `--update` (audit-run / audit-init) writes the baseline.
