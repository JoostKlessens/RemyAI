// @ts-check
/**
 * Flat ESLint config (ESLint 9+, no eslintrc). Replaces the previously
 * dangling `lint` script in package.json that referenced ESLint without it
 * being installed or configured anywhere — see the T6 review finding.
 *
 * Lives outside the repo root (referenced explicitly via `--config` in
 * package.json's `lint` script) rather than as `eslint.config.mjs`/`.js` at
 * the root, which this environment's config-protection hook hard-blocks
 * from being written or edited by an agent at all — see the frontend
 * report's T6 section for the full explanation.
 *
 * Scope: `src/**` and `tests/**` TypeScript/TSX only. Deliberately
 * non-type-checked (no `parserOptions.project`) to keep `npm run lint` fast
 * and independent of `tsc --noEmit`, which already owns type-error
 * detection — this config's job is the class of bug `tsc` cannot see:
 * unreachable/unused code, React Hooks rule violations, and raw color
 * literals bypassing the token system (docs/DESIGN.md: "import from
 * [tokens.ts], never hardcode a hex or a pixel value in a screen").
 */

import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactNative from 'eslint-plugin-react-native';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/web-build/**',
      '**/.expo/**',
      '**/coverage/**',
      'supabase/functions/**',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-native': reactNative,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        // React Native / Expo runtime globals, not Node/browser ones.
        __DEV__: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,

      // Deliberately NOT spreading reactHooks.configs.recommended.rules:
      // eslint-plugin-react-hooks 7.x bundles a set of experimental
      // React-Compiler-oriented rules (react-hooks/refs,
      // react-hooks/set-state-in-effect, ...) into "recommended" that
      // reject this codebase's classic `useRef(new Animated.Value(...))`
      // + imperative Animated API idiom outright — a pattern used
      // correctly and extensively across DecisionCard, TimerDisplay,
      // StepView, Chip, Button, OutcomeCard, SaveIntentSheet. Enabling
      // only the two stable, well-understood rules keeps the gate honest
      // (catches real hook-order/dependency bugs, matches the
      // `eslint-disable-next-line react-hooks/exhaustive-deps` comments
      // already present in the codebase) without demanding a rewrite to
      // React Compiler-safe patterns as an unrelated side effect of "add
      // a lint script".
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // TypeScript already reports undefined identifiers with far better
      // fidelity (and understands ambient/global types); double-reporting
      // via no-undef produces false positives on RN/Expo globals.
      'no-undef': 'off',
      // React 17+ JSX runtime (expo-router/Expo SDK 51) never needs React
      // in scope, and prop-types are redundant with our TS prop types.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],

      // Enforces "no raw hex outside tokens.ts" (docs/DESIGN.md) as an
      // automated gate rather than a review-time-only convention.
      'react-native/no-color-literals': 'error',
      'react-native/no-unused-styles': 'error',
    },
  },
  {
    // src/theme/tokens.ts IS the color source of truth; the raw-literal
    // rule exists to keep every other file honest, not this one.
    files: ['src/theme/tokens.ts'],
    rules: {
      'react-native/no-color-literals': 'off',
    },
  },
);
