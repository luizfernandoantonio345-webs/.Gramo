/* eslint-disable no-console -- script de CLI: o console e a saida esperada. */
/**
 * E2E de FLUXO (HTTP) autossuficiente: sobe o backend real (via boot-stack) e
 * exercita "login real -> dashboard -> bater ponto". Roda no CI (Postgres
 * embarcado) e localmente. Uso: node apps/api/test/e2e/run-e2e-fluxo.mjs
 */
import { bootStack } from './boot-stack.mjs';

const API_PORT = 43000 + Math.floor(Math.random() * 15000);
const TENANT = 'gramo';

let falhas = 0;
const check = (nome, cond) => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${nome}`);
  if (!cond) falhas++;
};

async function req(baseUrl, path, { method = 'GET', token, body } = {}) {
  const r = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Subdominio': TENANT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    /* sem corpo */
  }
  return { status: r.status, json };
}

async function main() {
  const { stop, baseUrl } = await bootStack({ apiPort: API_PORT });
  try {
    console.log('\n[fluxo] login admin -> dashboard');
    const adm = await req(baseUrl, '/auth/admin/login', {
      method: 'POST',
      body: { email: 'rh@gramoengenharia.com.br', senha: 'GramoRH@2026' },
    });
    const admTok = adm.json?.accessToken;
    check('admin autentica sem 2FA (bypass) e recebe accessToken', !!admTok);

    const dash = await req(baseUrl, '/admin/dashboard', { token: admTok });
    check('dashboard responde 200', dash.status === 200);
    check(
      'dashboard traz KPIs (funcionariosAtivos numerico)',
      typeof dash.json?.kpis?.funcionariosAtivos === 'number',
    );
    check('dashboard tem serie de presenca (7 dias)', Array.isArray(dash.json?.presenca7dias));

    const alertas = await req(baseUrl, '/admin/dashboard/alertas-ponto', { token: admTok });
    check('endpoint de alerta ao vivo responde 200', alertas.status === 200);

    console.log('\n[fluxo] login funcionario -> bater ponto');
    const func = await req(baseUrl, '/auth/funcionario/login', {
      method: 'POST',
      body: { cpf: '52998224725', senha: 'Gramo@12345' },
    });
    const funcTok = func.json?.accessToken;
    check('funcionario autentica e recebe accessToken', !!funcTok);

    const batida = await req(baseUrl, '/pontos', {
      method: 'POST',
      token: funcTok,
      body: { uuidIdempotencia: crypto.randomUUID(), latitude: -19.973, longitude: -44.0968 },
    });
    check('ponto registrado com NSR (backend real)', typeof batida.json?.nsr === 'number');

    console.log('\n[fluxo] apuracao da competencia (horas valoradas)');
    const q =
      '?inicio=2026-07-21T00:00:00Z&fim=2026-08-20T23:59:59Z&valorHoraPadrao=12.14&percentualPericulosidade=0.3';
    const apur = await req(baseUrl, `/admin/banco-horas/apuracao${q}`, { token: admTok });
    check('apuracao responde 200', apur.status === 200);
    check('apuracao traz itens por funcionario', Array.isArray(apur.json?.itens));
    check('apuracao traz consolidado com total', typeof apur.json?.consolidado?.total === 'number');
    check(
      'apuracao ecoa os parametros (periculosidade 30%)',
      apur.json?.parametros?.percentualPericulosidade === 0.3,
    );
  } finally {
    await stop();
  }

  console.log('');
  if (falhas > 0) {
    console.error(`E2E FLUXO FALHOU: ${falhas} verificacao(oes).`);
    process.exit(1);
  }
  console.log('E2E FLUXO OK: backend real (PG embarcado) -> login admin+funcionario, dashboard, ponto.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Erro no E2E de fluxo:', e.message);
  process.exit(1);
});
