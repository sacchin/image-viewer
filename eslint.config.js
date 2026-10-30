// ESLint 9 flat config (migrated from .eslintrc.js)
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const prettierConfig = require('eslint-config-prettier');

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  fetch: 'readonly',
  URL: 'readonly',
  DOMParser: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  KeyboardEvent: 'readonly',
  HTMLElement: 'readonly',
  HTMLDivElement: 'readonly',
  HTMLImageElement: 'readonly',
  HTMLInputElement: 'readonly',
  Element: 'readonly',
  Document: 'readonly',
  Window: 'readonly',
  localStorage: 'readonly',
  navigator: 'readonly'
};

const nodeGlobals = {
  process: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  require: 'readonly',
  module: 'writable',
  exports: 'writable',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  URL: 'readonly',
  fetch: 'readonly',
  global: 'readonly',
  NodeJS: 'readonly'
};

module.exports = [
  {
    ignores: ['dist/**', 'release/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'library/**']
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
      'react/react-in-jsx-scope': 'off',
      // Props are typed by TypeScript; display names are inferred for the compound Layout components
      'react/prop-types': 'off',
      'react/display-name': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off'
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: browserGlobals }
  },
  {
    files: ['src/main/**/*.ts', 'src/shared/**/*.ts'],
    languageOptions: { globals: nodeGlobals }
  },
  {
    files: ['tests/**/*.ts', 'playwright.config.ts', 'src/**/__tests__/**/*.ts'],
    languageOptions: { globals: { ...nodeGlobals, ...browserGlobals } },
    rules: {
      // Test code mocks and probes freely-typed runtime objects
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off'
    }
  },
  {
    files: ['*.js', '*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: nodeGlobals }
  }
];
