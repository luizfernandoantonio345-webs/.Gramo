import { defineConfig } from 'vitest/config';

/**
 * Testes UNITARIOS do web (vitest). Restringe a `src/**` para NAO capturar os
 * testes E2E do Playwright em `e2e/` (que sao *.spec.ts e usam @playwright/test,
 * nao o vitest). Ambiente segue por arquivo (// @vitest-environment jsdom).
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
