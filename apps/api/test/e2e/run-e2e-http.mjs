/* eslint-disable no-console -- script de CLI: o console e a saida esperada. */
/**
 * E2E de FLUXO (HTTP) do .GRAMO -- exercita os endpoints reais, complementando o
 * run-e2e.mjs (que cobre RLS/NSR/imutabilidade no nivel do banco).
 *
 * Cobre, ponta a ponta, contra a API rodando (tenant GRAMO ja semeado):
 *   1. Login admin e funcionario.
 *   2. LGPD: cadastrar rosto SEM consentimento -> 403; com consentimento -> ok.
 *   3. Bater ponto -> registra (NSR atribuido, nunca bloqueia).
 *   4. Reconhecimento facial: identidadeConfere=false dentro da REGAP -> PENDENTE_IDENTIDADE.
 *   5. Exportacao AFD -> integridade OK.
 *
 * Requisitos: API em :3000, banco no ar, `seed-gramo` + (opcional) `seed-demo`.
 * Uso: node apps/api/test/e2e/run-e2e-http.mjs
 * Limpa o estado do Jose (foto + consentimento) ao final, via banco.
 */
import pg from 'pg';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3000/api/v1';
const TENANT = 'gramo';
const OWNER =
  process.env.MIGRATION_DATABASE_URL ??
  'postgresql://repp_owner:repp_owner_dev@127.0.0.1:54329/repp_dev';
const CPF_JOSE = '52998224725';
const IMG_1x1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

let falhas = 0;
function check(nome, cond) {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${nome}`);
  if (!cond) falhas++;
}

async function req(path, { method = 'GET', token, body } = {}) {
  const r = await fetch(`${BASE}${path}`, {
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

async function resetJose(db) {
  const f = await db.query(
    `SELECT f.id FROM funcionarios f JOIN empresas e ON e.id=f.empresa_id WHERE e.subdominio=$1 AND f.cpf=$2`,
    [TENANT, CPF_JOSE],
  );
  if (!f.rows[0]) return null;
  const id = f.rows[0].id;
  await db.query('UPDATE funcionarios SET foto_referencia_ref=NULL, foto_aprovada=false WHERE id=$1', [id]);
  await db.query("DELETE FROM consentimentos_lgpd WHERE funcionario_id=$1 AND finalidade='biometria_facial'", [id]);
  return id;
}

async function main() {
  const db = new pg.Client({ connectionString: OWNER });
  await db.connect();
  await resetJose(db); // estado limpo antes de comecar

  console.log('[1] Login');
  const adm = await req('/auth/admin/login', {
    method: 'POST',
    body: { email: 'rh@gramoengenharia.com.br', senha: 'GramoRH@2026' },
  });
  const admTok = adm.json?.accessToken;
  check('admin autentica (accessToken)', !!admTok);

  const func = await req('/auth/funcionario/login', {
    method: 'POST',
    body: { cpf: CPF_JOSE, senha: 'Gramo@12345' },
  });
  const funcTok = func.json?.accessToken;
  check('funcionario autentica (accessToken)', !!funcTok);

  console.log('\n[2] LGPD - consentimento obrigatorio para biometria');
  const semConsent = await req('/pontos/minha-referencia', {
    method: 'POST',
    token: funcTok,
    body: { fotoBase64: IMG_1x1 },
  });
  check('cadastrar rosto SEM consentimento e negado (403)', semConsent.status === 403);

  const consent = await req('/pontos/consentimento-biometria', {
    method: 'POST',
    token: funcTok,
    body: { concedido: true },
  });
  check('registra consentimento (concedido:true)', consent.json?.concedido === true);

  const comConsent = await req('/pontos/minha-referencia', {
    method: 'POST',
    token: funcTok,
    body: { fotoBase64: IMG_1x1 },
  });
  check('cadastrar rosto COM consentimento e aceito (201)', comConsent.status === 201);

  console.log('\n[3] Bater ponto - registra e NUNCA bloqueia');
  const batida = await req('/pontos', {
    method: 'POST',
    token: funcTok,
    body: { uuidIdempotencia: crypto.randomUUID(), latitude: -8.39505, longitude: -34.94902 },
  });
  check('ponto registrado com NSR', typeof batida.json?.nsr === 'number');

  console.log('\n[4] Reconhecimento facial - rosto nao confere -> PENDENTE_IDENTIDADE');
  const naoConfere = await req('/pontos', {
    method: 'POST',
    token: funcTok,
    body: {
      uuidIdempotencia: crypto.randomUUID(),
      latitude: -8.39505,
      longitude: -34.94902,
      identidadeConfere: false,
    },
  });
  check(
    'ponto com identidadeConfere=false vira PENDENTE_IDENTIDADE',
    naoConfere.json?.statusValidacao === 'PENDENTE_IDENTIDADE',
  );

  console.log('\n[5] Exportacao AFD - integridade');
  const filiais = await req('/admin/configuracoes/filiais', { token: admTok });
  const suape = (filiais.json ?? []).find((f) => /suape/i.test(f.nome)) ?? filiais.json?.[0];
  check('ha filial para exportar', !!suape);
  if (suape) {
    await req('/admin/exportacoes/afd', {
      method: 'POST',
      token: admTok,
      body: {
        inicio: '2026-07-20T00:00:00Z',
        fim: '2026-08-31T23:59:59Z',
        filialId: suape.id,
      },
    });
    const lista = await req('/admin/exportacoes', { token: admTok });
    const id = lista.json?.[0]?.id;
    const download = await req(`/admin/exportacoes/${id}/download`, { token: admTok });
    check('AFD gerado passa na verificacao de integridade', download.json?.integridadeOk === true);
  }

  await resetJose(db); // deixa o Jose limpo para a demo
  await db.end();

  console.log('');
  if (falhas > 0) {
    console.error(`E2E HTTP FALHOU: ${falhas} verificacao(oes).`);
    process.exit(1);
  }
  console.log('E2E HTTP OK: login, LGPD, batida, reconhecimento facial e AFD validados.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Erro no E2E HTTP:', e.message);
  process.exit(1);
});
