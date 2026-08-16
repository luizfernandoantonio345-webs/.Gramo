import { defineConfig, devices } from '@playwright/test';

/**
 * E2E de UI (regressao de telas). Roda contra o build servido pelo `vite
 * preview` — o proprio Playwright sobe o servidor. Os testes de FUMACA nao
 * dependem do backend (a tela de login renderiza sem API); fluxos que precisam
 * da API ficam para uma fase com backend de teste.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    // O service worker recarrega a pagina (reset de estado) e deixa os testes
    // instaveis; bloquear evita flakiness (mesma licao da captura de telas).
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
