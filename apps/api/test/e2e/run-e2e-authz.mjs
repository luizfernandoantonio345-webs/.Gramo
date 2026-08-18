/* eslint-disable no-console -- script de CLI: o console e a saida esperada. */
/**
 * E2E de AUTORIZACAO / IDOR autossuficiente (H3 da auditoria). Sobe o backend
 * real (boot-stack) e prova, via HTTP, que um GESTOR_FILIAL restrito a UMA obra
 * NAO acessa recursos de outra obra da MESMA empresa (broken access control /
 * IDOR). Domínio sensível -> agora coberto no CI.
 *
 * Uso: node apps/api/test/e2e/run-e2e-authz.mjs
 */
import { hash as argon2 } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { bootStack } from './boot-stack.mjs';

const API_PORT = 44000 + Math.floor(Math.random() * 15000);
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
  return { status: r.status };
}

async function main() {
  const { stop, baseUrl, pgPort } = await bootStack({ apiPort: API_PORT });
  const db = new pg.Client(`postgresql://repp_owner:repp_owner@localhost:${pgPort}/repp_e2e`);
  db.on('error', () => {});

  try {
    await db.connect();

    // Empresa gramo + obra existente (REGAP) + funcionario existente (Jose).
    const emp = (await db.query("SELECT id FROM empresas WHERE subdominio=$1", [TENANT])).rows[0].id;
    const filA = (
      await db.query('SELECT id FROM filiais WHERE empresa_id=$1 ORDER BY nome LIMIT 1', [emp])
    ).rows[0].id;
    const funcA = (
      await db.query('SELECT id FROM funcionarios WHERE empresa_id=$1 AND filial_id=$2 LIMIT 1', [
        emp,
        filA,
      ])
    ).rows[0].id;

    // Cria uma SEGUNDA obra + um funcionario nela (fora do escopo do gestor).
    const filB = randomUUID();
    await db.query('INSERT INTO filiais (id, empresa_id, nome) VALUES ($1,$2,$3)', [
      filB,
      emp,
      'Obra Norte (e2e)',
    ]);
    const funcB = randomUUID();
    await db.query(
      `INSERT INTO funcionarios (id, empresa_id, filial_id, nome, cpf, atualizado_em)
       VALUES ($1,$2,$3,'Maria (Obra Norte)','98765432100',now())`,
      [funcB, emp, filB],
    );

    // Gestor restrito a filA (REGAP).
    const email = 'gestor.authz@gramoengenharia.com.br';
    const senha = 'GestorAuthz@2026';
    const adminId = (
      await db.query(
        `INSERT INTO usuarios_admin (id, empresa_id, nome, email, senha_hash, papel, atualizado_em)
         VALUES (gen_random_uuid(), $1, 'Gestor REGAP (authz)', $2, $3, 'GESTOR_FILIAL'::"PapelAdmin", now())
         RETURNING id`,
        [emp, email, await argon2(senha)],
      )
    ).rows[0].id;
    await db.query(
      'INSERT INTO admin_filial_acesso (id, empresa_id, admin_id, filial_id) VALUES (gen_random_uuid(), $1, $2, $3)',
      [emp, adminId, filA],
    );

    // Login do gestor (2FA desligado no backend de teste).
    const login = await fetch(`${baseUrl}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Subdominio': TENANT },
      body: JSON.stringify({ email, senha }),
    });
    const token = (await login.json())?.accessToken;
    check('gestor de filial autentica', !!token);

    // IDOR: recurso da PROPRIA obra -> 200; recurso de OUTRA obra -> 403.
    const dentro = await req(baseUrl, `/admin/funcionarios/${funcA}/documentos`, { token });
    check('gestor LE documentos da propria obra (200)', dentro.status === 200);
    const fora = await req(baseUrl, `/admin/funcionarios/${funcB}/documentos`, { token });
    check('gestor NAO le documentos de outra obra (403)', fora.status === 403);
    const foraFoto = await req(baseUrl, `/admin/funcionarios/${funcB}/foto-referencia`, { token });
    check('gestor NAO le foto de referencia de outra obra (403)', foraFoto.status === 403);

    // Sem token: negado.
    const semAuth = await req(baseUrl, `/admin/funcionarios/${funcA}/documentos`);
    check('sem token -> 401', semAuth.status === 401);
  } finally {
    try {
      await db.end();
    } catch {
      /* ignora */
    }
    await stop();
  }

  console.log('');
  if (falhas > 0) {
    console.error(`E2E AUTHZ FALHOU: ${falhas} verificacao(oes).`);
    process.exit(1);
  }
  console.log('E2E AUTHZ OK: IDOR multi-filial bloqueado no backend (broken access control).');
  process.exit(0);
}

main().catch((e) => {
  console.error('Erro no E2E de authz:', e.message);
  process.exit(1);
});
