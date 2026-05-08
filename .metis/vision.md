---
id: dev-genie
level: vision
title: "Dev-Genie"
short_code: "DGEN-V-0001"
created_at: 2026-05-08T17:50:55.256425+00:00
updated_at: 2026-05-08T17:52:21.083523+00:00
archived: false

tags:
  - "#vision"
  - "#phase/published"


exit_criteria_met: false
strategy_id: NULL
initiative_id: NULL
---

# Dev-Genie Vision

## Purpose

Dev-Genie is a collection of agentic skills, tools, and structures that force AI coding agents to write first-class code. It enables an agent to either start a project from scratch with strong architecture and code quality baked in, or take an existing codebase and progressively make it better — up to and including a full refactor — without the agent silently regressing quality along the way.

The core thesis: AI agents will happily ship sprawling, untyped, cyclically-coupled code unless the environment around them makes that impossible. Dev-Genie is that environment. It encodes opinionated guard rails as installable plugins so any project can adopt them in one step.

## Product/Solution Overview

Dev-Genie ships as a meta-plugin for Claude Code (and compatible agent harnesses) that orchestrates a suite of focused, independently-usable sub-plugins. The top-level `dev-genie` plugin's only job is to instruct the agent to install and configure the underlying plugins for a given project. Each sub-plugin owns one concern and can be adopted on its own.

Target audience: developers using AI agents for non-trivial software work who want consistent quality without manually policing every diff.

## Current State

The repository currently contains a single boilerplate plugin (`guardrails/`) holding architecture scaffolds (node-api, react-next-vercel-webapp, supabase-api, supabase-node-rag), a `scaffold-architecture` slash command, and skills for universal and per-architecture guard rails. There is no enforcement layer — the agent is told what good looks like but nothing measures whether the code stays that way. There is no top-level entry point and no shared tooling across plugins.

## Future State

A three-plugin (and growing) ecosystem under one umbrella:

- **`dev-genie/`** — the meta-plugin. Its only responsibility is bootstrapping: when invoked in a project, it walks the agent through installing and configuring the relevant sub-plugins, picks sensible defaults per project type, and exposes a single setup command users discover first.
- **`guardrails/`** — the existing boilerplate, now standalone. Provides architecture patterns, scaffolds, opinionated lint/type rule definitions, and per-stack strategies the agent must follow when generating or modifying code.
- **`audit/`** — a new static-analysis plugin. Uses dependency-cruiser (with complexity reporting) and scc to scan the codebase, reduces the raw output to composite scores for **health**, **architecture**, **maintainability**, and **testability** using hard-coded weighted formulas, stores the most recent scores in the project, and installs a pre-commit hook that re-scans and blocks the commit if any composite regresses past a configurable threshold. Optionally configurable to *require* improvement before commit when a codebase is being actively refactored.

Future plugins (security review, test-coverage gates, doc-coverage, etc.) plug into the same `dev-genie` umbrella without changing how users adopt them.

## Major Features

- **Meta-plugin bootstrap (`dev-genie`)** — single entry point that installs and wires up sub-plugins; keeps each capability shippable on its own.
- **Architecture scaffolds (`guardrails`)** — opinionated starting points for common stacks, plus the lint/type rules and skill instructions that keep generated code on-pattern.
- **Composite-score audit (`audit`)** — depcruise + scc scan reduced to health/architecture/maintainability/testability scores via hard-coded composite definitions; results persisted in `.audit/`.
- **Regression-blocking pre-commit hook (`audit`)** — compares fresh scores to last stored scores; blocks the commit with a targeted error message (which composite regressed, by how much, which raw metric drove it) when drops exceed the configured threshold.
- **Refactor-mode enforcement (`audit`)** — optional config flag that requires scores to *improve* (not merely hold) before commits land, useful when an agent is tasked with raising the quality of an existing codebase.

## Success Criteria

- A developer can run one `dev-genie` setup command in a fresh or existing repo and end up with guardrails skills active, an audit config seeded, and a pre-commit hook installed.
- An AI agent attempting to commit code that meaningfully degrades architecture, maintainability, testability, or overall health is blocked with an actionable message rather than a generic failure.
- Each sub-plugin (`guardrails`, `audit`) remains independently installable and useful without `dev-genie`.
- Composite scores are stable and interpretable: the same codebase scanned twice yields the same numbers, and a human can read the score breakdown and understand which raw metrics drove it.

## Principles

- **Small, composable plugins over one monolith.** Each plugin owns one concern and ships independently.
- **Enforcement beats instruction.** Telling the agent "write good code" is not enough; the environment must measure and block.
- **Hard-coded composite definitions.** Scoring formulas live in code, not user config, so scores are comparable across projects. User config tunes baselines and thresholds, not the formulas themselves.
- **Block on regression, not on absolute score.** A pre-existing low score should not prevent any commit; a *worsening* score should.
- **Actionable failures.** When the audit blocks a commit, the message names the composite, the delta, and the underlying raw metric.
- **Zero-friction adoption.** Setup is one command. Defaults work. Tuning is optional.

## Constraints

- Must run in a Claude Code plugin environment and respect its skill/command/hook conventions.
- Audit tooling restricted to depcruise + scc (plus what depcruise can report for complexity) to keep the install footprint small and language coverage broad.
- Pre-commit hook must work without forcing a package-manager dependency on the host project (no required husky install).
- All persisted state lives under `.audit/` in the host repo; no global state.