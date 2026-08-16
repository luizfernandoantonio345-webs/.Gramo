import { defineConfig, devices } from '@playwright/test';

/**
 * E2E de INTEGRACAO (navegador + backend real). O globalSetup sobe o stack
 * (Postgres embarcado + seed + API HTTP na porta 3000, via boot-stack); o
 * webServer serve o build com `vite preview` (5173). Os testes fazem login REAL
 * e navegam. Pesado: roda no CI (ou local com RAM sobrando). Serial (1 worker),
 * pois compartilham o mesmo backend.
 */
export default defineConfig({
  testDir: './e2e-integ',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e-integ/global-setup.ts',
  globalTeardown: './e2e-integ/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
