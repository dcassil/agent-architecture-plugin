---
description: Copy one of the guard-rails architecture boilerplates (eslint.config.mjs + tsconfig.json) into a target project, with peer-dep install instructions.
argument-hint: <pattern> [target-dir]
---

You are scaffolding a project from the guard-rails-boilerplate catalog.

Pattern requested: `$1`
Target directory: `$2` (default: current working directory)

Steps:

1. Resolve the pattern. Valid values:
   - `react-next-vercel-webapp` (or `next`, `nextjs`, `vercel`)
   - `node-api` (or `node`, `api`)
   - `supabase-api` (or `supabase`)

   If `$1` is empty or unrecognized, list the three options and ask which one. Do not guess.

2. Locate the source. The catalog lives at the root of this repo under `architectures/<pattern>/`. If you can't find it relative to the current working directory, ask the user for the path to the `gaurd-rails-boilerplate` repo.

3. Read the pattern's `README.md` and surface the **Overview**, **When to avoid**, and **Layers** sections so the user confirms it fits.

4. Copy `eslint.config.mjs` and `tsconfig.json` from `architectures/<pattern>/` into the target directory. Do NOT overwrite existing files without explicit confirmation — diff first and ask.

5. Print the peer-dependency install command from the pattern README and ask whether to run it.

6. Tell the user what to customize (path globs in `no-restricted-imports`, package name aliases, `paths` in tsconfig).

7. Recommend invoking the matching skill (`arch-next-vercel`, `arch-node-api`, or `arch-supabase-api`) for the full rules reference.

Be terse. Show diffs before writing. Confirm before any destructive action.
