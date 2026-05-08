import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';

/**
 * ESLint config for: Next.js (App Router) webapp on Vercel.
 * See ./README.md for the architecture rationale behind each rule.
 */
export default tseslint.config(
  {
    ignores: ['**/.next/**', '**/dist/**', '**/node_modules/**', '**/coverage/**', '**/*.d.ts'],
  },

  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // ---- File size & complexity ----
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', { max: 10 }],
      'max-depth': ['warn', 4],
      'max-params': ['warn', 4],

      // ---- Architecture: import boundaries ----
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*/features/*/!(index)', '@/features/*/!(index)'],
              message: 'Import features only via their public entry. No deep imports across features.',
            },
            {
              group: ['server-only'],
              importNames: ['default'],
              message: 'OK in server modules; client components must not import server-only code.',
            },
          ],
          paths: [
            {
              name: 'process',
              importNames: ['env'],
              message: 'Use the validated env from lib/env.ts instead of process.env.',
            },
          ],
        },
      ],

      // ---- No re-export barrels (hide coupling, defeat tree-shaking) ----
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration',
          message: 'Re-exports (export * from) are not allowed. Export explicitly.',
        },
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'Use lib/env.ts instead of accessing process.env directly.',
        },
      ],

      // ---- Type safety ----
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],

      // ---- General quality ----
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-template': 'error',
    },
  },

  // env.ts is the only place allowed to read process.env
  {
    files: ['**/lib/env.ts', '**/lib/env/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
    },
  },

  // Route handlers / server actions / server-only modules — node globals OK
  {
    files: ['**/app/**/route.ts', '**/app/api/**/*.ts', '**/features/**/actions.ts', '**/features/**/queries.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Tests — relaxed line and complexity limits
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/tests/**/*.{ts,tsx}'],
    rules: {
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Config files
  {
    files: ['*.config.{js,mjs,ts}', '*.config.*.{js,mjs,ts}'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
    },
  },
);
