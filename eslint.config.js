import js from '@eslint/js';
import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import globals from 'globals';

export default ts.config(
  {
    ignores: [
      'dist/**',
      'website/dist/**',
      'artifacts/**',
      'android/**',
      'node_modules/**',
      'miner-builder/**'
    ]
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: [
      'src/**/*.{ts,vue}',
      'website/**/*.{ts,vue,mjs}',
      '*.js',
      'tests/*.mjs',
      'server/**/*.mjs',
      'api/*.mjs'
    ],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  },
  {
    files: ['src/**/*.vue', 'website/**/*.vue'],
    languageOptions: { parserOptions: { parser: ts.parser } },
    rules: { 'vue/no-mutating-props': ['error', { shallowOnly: true }] }
  }
);
