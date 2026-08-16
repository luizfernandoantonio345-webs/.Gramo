import { test, expect } from '@playwright/test';

/**
 * Fumaca das telas de acesso: garante que o app CARREGA e RENDERIZA os campos
 * criticos (nao "tela branca" nem crash do ErrorBoundary). Nao submete o login
 * (isso exige backend); o objetivo aqui e travar regressao de renderizacao —
 * exatamente a classe de bug que ja nos mordeu (telas em branco).
 */
test.describe('Telas de acesso (fumaca, sem backend)', () => {
  test('app monta e o container #root nao fica vazio', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('login do colaborador mostra CPF, senha e Entrar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('tab', { name: 'Colaborador' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Administrador' })).toBeVisible();
    await expect(page.getByPlaceholder('000.000.000-00')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('alternar para Administrador mostra e-mail, senha e Continuar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Administrador' }).click();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
  });

  test('a aba Plataforma fica oculta sem ?plataforma=1', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('tab', { name: 'Plataforma' })).toHaveCount(0);
    await page.goto('/?plataforma=1');
    await expect(page.getByRole('tab', { name: 'Plataforma' })).toBeVisible();
  });
});
