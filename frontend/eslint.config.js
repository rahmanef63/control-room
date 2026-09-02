import js from '@eslint/js';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default [
  {
    ignores: ['build/**', 'releases/**', '.svelte-kit/**', 'node_modules/**', 'playwright-report/**', 'test-results/**']
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } },
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    }
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        svelteConfig
      }
    }
  },
  {
    files: ['**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parser: ts.parser
    }
  }
];
