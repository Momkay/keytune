import js from '@eslint/js';

export default [
  { ignores: ['analysis/', 'node_modules/', 'coverage/', 'probe.html', 'index.old.html'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { HTMLInputElement: 'readonly', File: 'readonly', Event: 'readonly', MouseEvent: 'readonly', window: 'readonly', document: 'readonly', navigator: 'readonly', console: 'readonly', URL: 'readonly', Blob: 'readonly', setTimeout: 'readonly', structuredClone: 'readonly', matchMedia: 'readonly', performance: 'readonly', requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly', HTMLElement: 'readonly', KeyboardEvent: 'readonly', clearTimeout: 'readonly' },
    },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-restricted-syntax': ['error', { selector: "MemberExpression[property.name=/^(innerHTML|outerHTML|insertAdjacentHTML)$/]", message: 'Build elements with h() from src/ui/dom.js; never set HTML' }],
    },
  },
];
