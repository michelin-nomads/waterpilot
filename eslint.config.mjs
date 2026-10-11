// Flat ESLint config (ESM). Covers TS/TSX in apps/web and packages/contracts.
// Uses typescript-eslint's syntactic recommended rules (not type-checked) to stay
// robust across the toolchain; type safety is enforced by `tsc` in `typecheck`.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/.venv/**',
      // Generated contract types — checked by tsc, not linted for style.
      'packages/contracts/src/openapi.ts',
      'apps/web/src/graphql/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Browser/React source
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Node-context files (build config, scripts, e2e runner)
    files: ['**/*.config.{ts,mjs,js}', 'scripts/**/*.{ts,mjs,js}', 'apps/web/e2e/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
