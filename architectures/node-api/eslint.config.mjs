import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * ESLint config for: Node.js HTTP API (layered service).
 * See ./README.md for the architecture rationale behind each rule.
 */
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/*.d.ts'],
  },

  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylistic,
    ],
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ---- File size & complexity ----
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', { max: 10 }],
      'max-depth': ['warn', 4],
      'max-params': ['warn', 4],

      // ---- Architecture: layer boundaries ----
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            // services and repositories must be framework-agnostic
            {
              group: ['fastify', 'express', 'hono', '@fastify/*', '@hono/*'],
              message: 'HTTP framework imports are not allowed here. Restricted in services/* and repositories/*; override per-file if this is app/route wiring.',
            },
          ],
          paths: [
            {
              name: 'process',
              importNames: ['env'],
              message: 'Use config/env.ts (validated env) instead of process.env.',
            },
          ],
        },
      ],

      // ---- No re-export barrels ----
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration',
          message: 'Re-exports (export * from) are not allowed. Export explicitly.',
        },
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'Use config/env.ts instead of accessing process.env directly.',
        },
      ],

      // ---- Type safety ----
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
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
      'no-console': 'error',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-template': 'error',
    },
  },

  // routes/ and app.ts — HTTP framework imports are expected here
  {
    files: ['**/src/app.ts', '**/src/server.ts', '**/src/routes/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'process',
              importNames: ['env'],
              message: 'Use config/env.ts instead of process.env.',
            },
          ],
        },
      ],
    },
  },

  // handlers/ — HTTP types allowed; repositories/ are NOT
  {
    files: ['**/src/handlers/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/repositories/*', '*/repositories/*'],
              message: 'Handlers must not call repositories directly. Go through a service.',
            },
          ],
        },
      ],
    },
  },

  // services/ and repositories/ — must stay framework-agnostic (default rule applies)

  // config/env.ts — sole reader of process.env
  {
    files: ['**/src/config/env.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
    },
  },

  // Tests
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'no-console': 'off',
    },
  },
);
