/* eslint-disable no-console */
/**
 * Sobe o STACK de backend para E2E: Postgres embarcado + roles/schema/RLS +
 * seed da GRAMO + a API HTTP real (2FA desligado via DEV_BYPASS_2FA). Fonte
 * unica, reusada pelo runner de fluxo (HTTP) e pelo E2E de UI (Playwright).
 *
 * Requisito: API buildada (dist). Retorna { stop, baseUrl, pgPort }.
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
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

function migrationsSql() {
  const base = join(apiDir, 'prisma', 'migrations');
  const dirs = readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  return dirs.map((d) => readFileSync(join(base, d, 'migration.sql'), 'utf8')).join('\n');
}

function run(cmd, args, env) {
  return new Promise((resolvePromise, reject) => {
    const p = spawn(cmd, args, { cwd: repoRoot, env: { ...process.env, ...env }, stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolvePromise() : reject(new Error(`${cmd} saiu ${code}`))));
    p.on('error', reject);
  });
}

export async function bootStack({ apiPort, db = 'repp_e2e', pgPort } = {}) {
  if (!apiPort) throw new Error('bootStack: apiPort e obrigatorio');
  const PG_PORT = pgPort ?? 42000 + Math.floor(Math.random() * 15000);
  const BASE = `http://localhost:${apiPort}/api/v1`;
  const { stop: stopPg } = await bootPg(PG_PORT);
  const conn = (user) => ({ host: 'localhost', port: PG_PORT, user, password: user, database: db });
  let api = null;
  const stop = async () => {
    if (api) {
      try {
        api.kill();
      } catch {
        /* ja saiu */
      }
    }
    try {
      await stopPg();
    } catch {
      /* ruido de shutdown */
    }
  };

  try {
    // Roles + banco (superuser) e schema + RLS (owner).
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
    await su.query(`CREATE DATABASE ${db} OWNER repp_owner`);
    await su.query(`GRANT CONNECT ON DATABASE ${db} TO repp_app`);
    await su.query(`GRANT CONNECT ON DATABASE ${db} TO repp_super`);
    await su.end();

    const owner = new Client(conn('repp_owner'));
    owner.on('error', () => {});
    await owner.connect();
    await owner.query(migrationsSql());
    await owner.query(readFileSync(join(apiDir, 'prisma', 'sql', 'rls-policies.sql'), 'utf8'));
    await owner.end();
    console.log('[boot-stack] schema + RLS aplicados');

    const ownerUrl = `postgresql://repp_owner:repp_owner@localhost:${PG_PORT}/${db}`;
    await run('node', [join(repoRoot, 'scripts', 'seed-gramo.mjs')], {
      MIGRATION_DATABASE_URL: ownerUrl,
    });
    console.log('[boot-stack] seed-gramo aplicado');

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
        API_PORT: String(apiPort),
        DATABASE_URL: `postgresql://repp_app:repp_app@localhost:${PG_PORT}/${db}?schema=public`,
        MIGRATION_DATABASE_URL: ownerUrl,
        SUPER_DATABASE_URL: `postgresql://repp_super:repp_super@localhost:${PG_PORT}/${db}?schema=public`,
        JWT_ACCESS_SECRET: 'e2e_access_secret_com_mais_de_32_caracteres',
        JWT_REFRESH_SECRET: 'e2e_refresh_secret_com_mais_de_32_caracteres',
        DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
        DEV_BYPASS_2FA: 'true',
        STORAGE_DRIVER: 'local',
        STORAGE_LOCAL_PATH: storage,
        LOG_JSON: 'false',
      },
    });

    // Espera /ready (janela larga: boot do Nest e lento em maquina apertada).
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
    if (!pronta) throw new Error('API nao respondeu /ready a tempo');
    console.log('[boot-stack] API pronta em', BASE);
    return { stop, baseUrl: BASE, pgPort: PG_PORT };
  } catch (e) {
    await stop();
    throw e;
  }
}
