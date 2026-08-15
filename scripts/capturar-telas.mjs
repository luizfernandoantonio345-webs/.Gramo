// Captura screenshots reais das telas do .GRAMO (producao) com Playwright.
// Uso: node scripts/capturar-telas.mjs [colaborador|admin|todos]
// Colaborador: login do Jose (sem 2FA). Admin: exige ADMIN_2FA_OPCIONAL=true no
// servidor (ver README do deploy) + credenciais de RH.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'docs', 'telas');
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.env.GRAMO_URL ?? 'https://gramoengenharia.online';
const alvo = process.argv[2] ?? 'colaborador';

// Credenciais SO por variavel de ambiente (nunca hardcoded no repo). Ex.:
//   GRAMO_COLAB_CPF, GRAMO_COLAB_SENHA, GRAMO_ADMIN_EMAIL, GRAMO_ADMIN_SENHA
const CRED = {
  colaboradorCpf: process.env.GRAMO_COLAB_CPF,
  colaboradorSenha: process.env.GRAMO_COLAB_SENHA,
  adminEmail: process.env.GRAMO_ADMIN_EMAIL,
  adminSenha: process.env.GRAMO_ADMIN_SENHA,
};
function exigir(...chaves) {
  const faltando = chaves.filter((k) => !CRED[k]);
  if (faltando.length) {
    console.error('Defina as variaveis de ambiente das credenciais antes de rodar.');
    process.exit(1);
  }
}

const shot = async (page, nome) => {
  const p = path.join(OUT, `${nome}.png`);
  // animations:disabled congela transicoes/animacoes (dashboard tem varias) para
  // o screenshot nao ficar esperando "estabilizar". Timeout folgado.
  await page.screenshot({ path: p, animations: 'disabled', timeout: 60000 });
  console.log('  capturado:', path.basename(p));
};
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function capturarColaborador(browser) {
  exigir('colaboradorCpf', 'colaboradorSenha');
  console.log('== Colaborador (mobile) ==');
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
    // Bloqueia o service worker: seu controllerchange recarrega a pagina e
    // reseta o estado do React no meio da automacao (flakiness).
    serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await pausa(800);
  await shot(page, '01-colaborador-login');

  await page.getByPlaceholder('000.000.000-00').fill(CRED.colaboradorCpf);
  await page.getByPlaceholder('minimo 8 caracteres, letra + numero').fill(CRED.colaboradorSenha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('button', { name: 'Abrir menu' }).waitFor({ timeout: 20000 });
  await pausa(1500);
  await shot(page, '02-colaborador-bater-ponto');

  const telas = [
    ['Folha', '03-colaborador-folha'],
    ['Documentos', '04-colaborador-documentos'],
    ['Férias', '05-colaborador-ferias'],
    ['Comunicados', '06-colaborador-comunicados'],
  ];
  for (const [rotulo, arquivo] of telas) {
    try {
      await page.getByRole('button', { name: 'Abrir menu' }).click();
      await pausa(400);
      await page.getByRole('button', { name: rotulo, exact: true }).click();
      await pausa(1500);
      await shot(page, arquivo);
    } catch (e) {
      console.log(`  FALHA em ${rotulo}: ${e.message}`);
    }
  }
  await ctx.close();
}

async function capturarAdmin(browser) {
  exigir('adminEmail', 'adminSenha');
  console.log('== Admin / RH (desktop) ==');
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
    // Ver nota no contexto do colaborador: bloqueia o SW para nao recarregar.
    serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await pausa(800);
  await page.getByRole('tab', { name: 'Administrador' }).click();
  const email = page.locator('input[type="email"]');
  const senha = page.locator('input[type="password"]');
  await email.waitFor({ state: 'visible', timeout: 15000 });
  await pausa(600);
  await shot(page, '07-admin-login');

  try {
    // Preenche e-mail/senha (AdmLogin). O 2FA precisa estar OPCIONAL no servidor
    // para o login retornar o token sem codigo (ver README do deploy).
    await email.fill(CRED.adminEmail);
    await senha.fill(CRED.adminSenha);
    await pausa(400);
    await page.getByRole('button', { name: 'Continuar' }).click();
    // Desktop: a sidebar aparece inteira (hamburger escondido). Espera um item
    // de nav para confirmar que logou.
    await page.getByRole('button', { name: 'Dashboard', exact: true }).waitFor({ timeout: 25000 });
  } catch (e) {
    await page.screenshot({ path: path.join(OUT, 'debug-admin.png') });
    console.log('  LOGIN ADMIN FALHOU — debug em docs/telas/debug-admin.png:', e.message);
    throw e;
  }
  await pausa(2500);
  await shot(page, '08-admin-dashboard');

  const telas = [
    ['Gestão de ponto', '09-admin-gestao-ponto'],
    ['Funcionários', '10-admin-funcionarios'],
    ['Ausências', '11-admin-ausencias'],
    ['Comunicados', '12-admin-comunicados'],
    ['Assinaturas', '13-admin-assinaturas'],
    ['Relatórios', '14-admin-relatorios'],
    ['Auditoria', '15-admin-auditoria'],
    ['Configurações', '16-admin-configuracoes'],
    ['Integrações', '17-admin-integracoes'],
    ['Quiosque', '18-admin-quiosque'],
  ];
  for (const [rotulo, arquivo] of telas) {
    try {
      const btn = page.getByRole('button', { name: rotulo, exact: true });
      if (await btn.count()) await btn.first().click();
      else {
        await page.getByRole('button', { name: 'Abrir menu' }).click();
        await pausa(300);
        await page.getByRole('button', { name: rotulo, exact: true }).click();
      }
      await pausa(1800);
      await shot(page, arquivo);
    } catch (e) {
      console.log(`  FALHA em ${rotulo}: ${e.message}`);
    }
  }
  await ctx.close();
}

const browser = await chromium.launch();
try {
  if (alvo === 'colaborador' || alvo === 'todos') await capturarColaborador(browser);
  if (alvo === 'admin' || alvo === 'todos') await capturarAdmin(browser);
} finally {
  await browser.close();
}
console.log('Concluido. Imagens em docs/telas/');
