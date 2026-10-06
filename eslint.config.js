import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**'] },
  js.configs.recommended,
  {
    files: ['functions/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node },
  },
  {
    files: ['scripts/**/*.ts'],
    extends: [tseslint.configs.recommended],
    languageOptions: { globals: globals.node, parserOptions: { tsconfigRootDir: import.meta.dirname } },
  },
);
