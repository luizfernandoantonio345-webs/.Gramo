/* eslint-disable no-console -- script de CLI: o console e a saida esperada. */
/**
 * E2E de FLUXO AUTOSSUFICIENTE (HTTP) do .GRAMO -- sobe TUDO sozinho, sem depender
 * do stack de dev: Postgres embarcado + roles/schema/RLS + seed da GRAMO + a API
 * HTTP real, e entao exercita "login real -> dashboard -> bater ponto".
 *
 * Roda no CI (Postgres embarcado, sem Docker) e localmente. 2FA e desligado via
 * DEV_BYPASS_2FA (NODE_ENV != production), como manda o env.ts.
 *
 * Requisito: a API tem de estar BUILDADA (dist). CI: `nest build`; local: SWC.
 * Uso: node apps/api/test/e2e/run-e2e-fluxo.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { bootPg } from '../pg-embed.mjs';

const { Client } = pg;
const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoRoot = resolve(apiDir, '..', '..');
const PG_PORT = 42000 + Math.floor(Math.random() * 15000);
const API_PORT = 43000 + Math.floor(Math.random() * 15000);
const DB = 'repp_e2e';
const TENANT = 'gramo';
const BASE = `http://localhost:${API_PORT}/api/v1`;

let falhas = 0;
const check = (nome, cond) => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${nome}`);
  if (!cond) falhas++;
};
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

function migrationsSql() {
  const base = join(apiDir, 'prisma', 'migrations');
  const dirs = readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  return dirs.map((d) => readFileSync(join(base, d, 'migration.sql'), 'utf8')).join('\n');
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

function run(cmd, args, env) {
  return new Promise((resolvePromise, reject) => {
    const p = spawn(cmd, args, { cwd: repoRoot, env: { ...process.env, ...env }, stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolvePromise() : reject(new Error(`${cmd} saiu ${code}`))));
    p.on('error', reject);
  });
}

async function main() {
  const { stop } = await bootPg(PG_PORT);
  const conn = (user) => ({ host: 'localhost', port: PG_PORT, user, password: user, database: DB });
  let api = null;

  try {
    // 1) Provisiona roles + banco (superuser) e aplica schema + RLS (owner).
    const su = new Client({ ...conn('postgres'), database: 'postgres' });
    su.on('error', () => {});
    await su.connect();
    await su.query(`CREATE ROLE repp_owner LOGIN SUPERUSER PASSWORD 'repp_owner'`);
    await su.query(
      `CREATE ROLE repp_app LOGIN PASSWORD 'repp_app' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
    );
    await su.query(
      `CREATE ROLE repp_super LOGIN PASSWORD 'repp_super' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
    );
    await su.query(`CREATE DATABASE ${DB} OWNER repp_owner`);
    await su.query(`GRANT CONNECT ON DATABASE ${DB} TO repp_app`);
    await su.query(`GRANT CONNECT ON DATABASE ${DB} TO repp_super`);
    await su.end();

    const owner = new Client(conn('repp_owner'));
    owner.on('error', () => {});
    await owner.connect();
    await owner.query(migrationsSql());
    await owner.query(readFileSync(join(apiDir, 'prisma', 'sql', 'rls-policies.sql'), 'utf8'));
    await owner.end();
    console.log('[setup] schema + RLS aplicados');

    // 2) Seed da GRAMO (empresa gramo + RH + Jose + obra/REGAP + jornadas).
    const ownerUrl = `postgresql://repp_owner:repp_owner@localhost:${PG_PORT}/${DB}`;
    await run('node', [join(repoRoot, 'scripts', 'seed-gramo.mjs')], {
      MIGRATION_DATABASE_URL: ownerUrl,
    });
    console.log('[setup] seed-gramo aplicado');

    // 3) Sobe a API HTTP real (2FA desligado por DEV_BYPASS_2FA em NODE_ENV=test).
    const mainJs = existsSync(join(apiDir, 'dist', 'src', 'main.js'))
      ? join(apiDir, 'dist', 'src', 'main.js')
      : join(apiDir, 'dist', 'main.js');
    if (!existsSync(mainJs)) throw new Error('API nao buildada (dist ausente). Rode o build antes.');
    const storage = mkdtempSync(join(tmpdir(), 'repp-e2e-storage-'));
    api = spawn('node', [mainJs], {
      cwd: apiDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        API_PORT: String(API_PORT),
        DATABASE_URL: `postgresql://repp_app:repp_app@localhost:${PG_PORT}/${DB}?schema=public`,
        MIGRATION_DATABASE_URL: ownerUrl,
        SUPER_DATABASE_URL: `postgresql://repp_super:repp_super@localhost:${PG_PORT}/${DB}?schema=public`,
        JWT_ACCESS_SECRET: 'e2e_access_secret_com_mais_de_32_caracteres',
        JWT_REFRESH_SECRET: 'e2e_refresh_secret_com_mais_de_32_caracteres',
        DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
        DEV_BYPASS_2FA: 'true',
        STORAGE_DRIVER: 'local',
        STORAGE_LOCAL_PATH: storage,
        LOG_JSON: 'false',
      },
    });

    // 4) Espera a API responder /ready (janela larga: boot do Nest e lento em
    // maquina apertada; no CI sobe rapido).
    let pronta = false;
    for (let i = 0; i < 120; i++) {
      try {
        const r = await fetch(`${BASE}/health/ready`);
        const j = await r.json();
        if (j.db === 'up') {
          pronta = true;
          break;
        }
      } catch {
        /* ainda subindo */
      }
      await pausa(1000);
    }
    check('API subiu e conectou ao banco', pronta);
    if (!pronta) throw new Error('API nao respondeu /ready a tempo');

    // 5) FLUXO: login admin -> dashboard.
    console.log('\n[fluxo] login admin -> dashboard');
    const adm = await req('/auth/admin/login', {
      method: 'POST',
      body: { email: 'rh@gramoengenharia.com.br', senha: 'GramoRH@2026' },
    });
    const admTok = adm.json?.accessToken;
    check('admin autentica sem 2FA (bypass) e recebe accessToken', !!admTok);

    const dash = await req('/admin/dashboard', { token: admTok });
    check('dashboard responde 200', dash.status === 200);
    check(
      'dashboard traz KPIs (funcionariosAtivos numerico)',
      typeof dash.json?.kpis?.funcionariosAtivos === 'number',
    );
    check('dashboard tem serie de presenca (7 dias)', Array.isArray(dash.json?.presenca7dias));

    const alertas = await req('/admin/dashboard/alertas-ponto', { token: admTok });
    check('endpoint de alerta ao vivo responde 200', alertas.status === 200);

    // 6) FLUXO: login funcionario -> bater ponto (NUNCA bloqueia, NSR atribuido).
    console.log('\n[fluxo] login funcionario -> bater ponto');
    const func = await req('/auth/funcionario/login', {
      method: 'POST',
      body: { cpf: '52998224725', senha: 'Gramo@12345' },
    });
    const funcTok = func.json?.accessToken;
    check('funcionario autentica e recebe accessToken', !!funcTok);

    const batida = await req('/pontos', {
      method: 'POST',
      token: funcTok,
      body: { uuidIdempotencia: crypto.randomUUID(), latitude: -19.973, longitude: -44.0968 },
    });
    check('ponto registrado com NSR (backend real)', typeof batida.json?.nsr === 'number');
  } finally {
    if (api) {
      try {
        api.kill();
      } catch {
        /* ja saiu */
      }
    }
    try {
      await stop();
    } catch {
      /* ruido de shutdown */
    }
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
