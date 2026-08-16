import { test, expect } from '@playwright/test';

/**
 * Integracao ponta a ponta pelo NAVEGADOR contra o backend real (seed da GRAMO):
 * login de verdade -> tela seguinte. Junta as duas pontas (UI + API + banco).
 * 2FA do admin fica desligado no backend de teste (DEV_BYPASS_2FA).
 */

test('admin faz login real e chega ao Dashboard', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Administrador' }).click();
  await page.locator('input[type="email"]').fill('rh@gramoengenharia.com.br');
  await page.locator('input[type="password"]').fill('GramoRH@2026');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Chegou ao painel: a sidebar mostra "Dashboard" e um KPI carrega.
  await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible();
  await expect(page.getByText('Funcionários ativos')).toBeVisible();
});

test('colaborador faz login real e chega ao Bater Ponto', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('000.000.000-00').fill('52998224725');
  await page.getByPlaceholder('minimo 8 caracteres, letra + numero').fill('Gramo@12345');
  await page.getByRole('button', { name: 'Entrar' }).click();

  // Tela principal do colaborador.
  await expect(page.getByRole('button', { name: 'Bater Entrada' })).toBeVisible();
});
