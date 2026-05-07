import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * ESLint config for: Next.js (App Router) + Vercel + Supabase RAG (pgvector).
 * See ./README.md for the architecture rationale behind each rule.
 *
 * Boundaries enforced here:
 *   - Client code (app/(ui)/**, components, any file with "use client") MUST NOT
 *     import from lib/server/*.
 *   - Supabase createClient is allowed only in lib/server/supabase.ts.
 *   - Third-party generation/embeddings SDKs are allowed only in their one
 *     designated lib/server/* module.
 *   - process.env may only be read inside lib/server/env.ts.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.d.ts',
      'supabase/.branches/**',
      'supabase/.temp/**',
    ],
  },

  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylistic,
    ],
    files: [
      'app/**/*.{ts,tsx}',
      'lib/**/*.ts',
      'types/**/*.ts',
      'supabase/seed/**/*.ts',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      // ---- File size & complexity ----
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', { max: 10 }],
      'max-depth': ['warn', 4],
      'max-params': ['warn', 4],

      // ---- Type safety ----
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // ---- General quality ----
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-template': 'error',

      // ---- No barrel re-exports; no direct process.env outside env module ----
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration',
          message: 'Re-exports (export * from) are not allowed. Export explicitly.',
        },
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'Use lib/server/env.ts (zod-validated env) instead of process.env directly.',
        },
      ],
    },
  },

  // ---- Client surface: app/(ui)/** and any "use client" component ----
  // Must not reach into lib/server/* or import server-only Supabase / provider SDKs.
  {
    files: [
      'app/(ui)/**/*.{ts,tsx}',
      'app/**/components/**/*.{ts,tsx}',
      'lib/shared/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lib/server/*', '@/lib/server/*', 'server-only'],
              message: 'Client code must not import from lib/server/* or server-only.',
            },
            {
              group: ['@supabase/supabase-js'],
              message: 'Client code must not import @supabase/supabase-js. Go through the Route Handler.',
            },
          ],
        },
      ],
    },
  },

  // ---- Server modules: provider SDKs isolated to ONE module each ----
  // createClient may only be called inside lib/server/supabase.ts.
  // Third-party LLM/embedding SDKs may only be imported from their designated module.
  {
    files: ['lib/server/**/*.ts', 'app/api/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              importNames: ['createClient'],
              message: 'createClient is allowed only in lib/server/supabase.ts. Import the factory from there.',
            },
          ],
        },
      ],
      'no-console': 'warn',
    },
  },

  // The single server modules permitted to import their respective dependencies.
  {
    files: ['lib/server/supabase.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['lib/server/env.ts'],
    rules: { 'no-restricted-syntax': 'off', 'no-restricted-imports': 'off' },
  },
  {
    // Provider isolation modules — keep their SDK imports here, not elsewhere.
    files: ['lib/server/embeddings.ts', 'lib/server/generation.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // Generated DB types — never lint, never edit.
  {
    files: ['types/database.ts', 'types/database.types.ts'],
    rules: {
      'max-lines': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
    },
  },

  // Tests
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'supabase/tests/**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'no-console': 'off',
    },
  },
);
