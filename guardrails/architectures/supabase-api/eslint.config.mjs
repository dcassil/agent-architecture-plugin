import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * ESLint config for: Supabase Edge Functions (Deno) + generated DB types.
 * See ./README.md for the architecture rationale behind each rule.
 *
 * NOTE: Edge Functions run on Deno. This config covers IDE/CI lint of the TS
 * sources. Use `deno check` / `deno lint` as the primary type+lint gate.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
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
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
    ],
    files: ['supabase/functions/**/*.ts', 'types/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      // Deno provides its own globals; declare the ones we use.
      globals: {
        Deno: 'readonly',
        ...globals.browser, // fetch, Request, Response, URL, crypto
      },
    },
    rules: {
      // ---- File size & complexity ----
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', { max: 10 }],
      'max-depth': ['warn', 4],
      'max-params': ['warn', 4],

      // ---- Architecture: cross-function isolation + env discipline ----
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../*/index.ts',
                '../*/handler.ts',
                '../**/functions/*/!(_shared)/**',
              ],
              message: 'Edge Functions must not import from sibling functions. Move shared code to functions/_shared/.',
            },
          ],
        },
      ],

      // ---- No re-export barrels; no direct Deno.env reads outside _shared/env.ts ----
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration',
          message: 'Re-exports (export * from) are not allowed. Export explicitly.',
        },
        {
          selector: "CallExpression[callee.object.object.name='Deno'][callee.object.property.name='env'][callee.property.name='get']",
          message: 'Use _shared/env.ts (validated env) instead of Deno.env.get directly.',
        },
        {
          selector: "MemberExpression[object.object.name='Deno'][object.property.name='env']",
          message: 'Use _shared/env.ts (validated env) instead of accessing Deno.env directly.',
        },
      ],

      // ---- Type safety ----
      '@typescript-eslint/no-explicit-any': 'error',
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
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-template': 'error',
    },
  },

  // _shared/env.ts is the only place allowed to read Deno.env
  {
    files: ['supabase/functions/_shared/env.ts'],
    rules: {
      'no-restricted-syntax': 'off',
      'no-restricted-imports': 'off',
    },
  },

  // Generated DB types — never lint, never edit
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
      'no-console': 'off',
    },
  },
);
