import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash } from '@node-rs/argon2';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

/**
 * Ambiente de desenvolvimento LOCAL sem Docker: sobe um PostgreSQL real
 * embarcado (persistente), cria as 3 roles, aplica migrations + RLS e semeia uma
 * empresa-piloto + admin. Mantem o banco de pe ate voce parar (Ctrl+C).
 *
 * Uso:
 *   node scripts/dev-local.mjs             # sobe e mantem rodando (use num terminal dedicado)
 *   node scripts/dev-local.mjs --setup-only  # so prepara e sai (para testes)
 */
const { Client } = pg;
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(raiz, 'apps', 'api');
const dataDir = join(raiz, '.devdb');
const PORT = 54329;
const DB = 'repp_dev';
const setupOnly = process.argv.includes('--setup-only');

const SENHAS = { owner: 'repp_owner_dev', app: 'repp_app_dev', super: 'repp_super_dev' };
const ADMIN = { email: 'admin@piloto.local', senha: 'Piloto@12345', subdominio: 'piloto' };

function migrations() {
  const base = join(apiDir, 'prisma', 'migrations');
  return readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .map((d) => readFileSync(join(base, d, 'migration.sql'), 'utf8'))
    .join('\n');
}
const rls = () => readFileSync(join(apiDir, 'prisma', 'sql', 'rls-policies.sql'), 'utf8');
const conn = (user, pass, database) => ({ host: 'localhost', port: PORT, user, password: pass, database });

async function main() {
  const jaInicializado = existsSync(join(dataDir, 'PG_VERSION'));
  const pgsql = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: true,
  });
  if (!jaInicializado) {
    console.log('Inicializando cluster PostgreSQL local em .devdb ...');
    await pgsql.initialise();
  }
  await pgsql.start();
  console.log(`PostgreSQL local no ar em localhost:${PORT}`);

  // --- roles + banco (como superuser postgres) ---
  const su = new Client(conn('postgres', 'postgres', 'postgres'));
  su.on('error', () => {});
  await su.connect();
  await criarRole(su, 'repp_owner', SENHAS.owner, 'SUPERUSER');
  await criarRole(su, 'repp_app', SENHAS.app, 'NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS');
  await criarRole(su, 'repp_super', SENHAS.super, 'NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS');
  const existeDb = await su.query('SELECT 1 FROM pg_database WHERE datname=$1', [DB]);
  if (existeDb.rowCount === 0) await su.query(`CREATE DATABASE ${DB} OWNER repp_owner`);
  await su.query(`GRANT CONNECT ON DATABASE ${DB} TO repp_app`);
  await su.query(`GRANT CONNECT ON DATABASE ${DB} TO repp_super`);
  await su.end();

  // --- schema + RLS + seed (como owner) ---
  const owner = new Client(conn('repp_owner', SENHAS.owner, DB));
  owner.on('error', () => {});
  await owner.connect();
  const temSchema = await owner.query(`SELECT to_regclass('public.empresas') AS t`);
  if (!temSchema.rows[0].t) {
    console.log('Aplicando migrations...');
    await owner.query(migrations());
  } else {
    console.log('Schema ja existe -- pulando migrations.');
  }
  console.log('Aplicando RLS...');
  await owner.query(rls());
  await seed(owner);
  await owner.end();

  const urlApp = `postgresql://repp_app:${SENHAS.app}@localhost:${PORT}/${DB}?schema=public`;
  const urlSuper = `postgresql://repp_super:${SENHAS.super}@localhost:${PORT}/${DB}?schema=public`;
  const urlOwner = `postgresql://repp_owner:${SENHAS.owner}@localhost:${PORT}/${DB}?schema=public`;

  console.log('\n================ AMBIENTE LOCAL PRONTO ================');
  console.log('Use estas variaveis no apps/api (.env ou export):');
  console.log(`  DATABASE_URL=${urlApp}`);
  console.log(`  SUPER_DATABASE_URL=${urlSuper}`);
  console.log(`  MIGRATION_DATABASE_URL=${urlOwner}`);
  console.log(`  SUPER_ADMIN_EMAIL=super@piloto.local`);
  console.log(`  SUPER_ADMIN_SENHA=Super@12345`);
  console.log('\nLogin da empresa-piloto (admin de RH):');
  console.log(`  subdominio: ${ADMIN.subdominio}  |  email: ${ADMIN.email}  |  senha: ${ADMIN.senha}`);
  console.log('  (no 1o login o sistema pede para configurar o 2FA)');
  console.log('======================================================\n');

  if (setupOnly) {
    await pgsql.stop();
    console.log('setup-only: banco preparado e parado. Rode sem a flag para manter no ar.');
    return;
  }
  console.log('Banco no ar. Deixe este terminal aberto. Ctrl+C para parar.');
  const parar = async () => {
    console.log('\nParando PostgreSQL local...');
    try { await pgsql.stop(); } catch { /* noop */ }
    process.exit(0);
  };
  process.on('SIGINT', parar);
  process.on('SIGTERM', parar);
  setInterval(() => {}, 1 << 30); // mantem o processo vivo
}

async function criarRole(su, nome, senha, atributos) {
  const existe = await su.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [nome]);
  if (existe.rowCount === 0) {
    await su.query(`CREATE ROLE ${nome} LOGIN PASSWORD '${senha}' ${atributos}`);
  }
}

async function seed(owner) {
  const jaTem = await owner.query('SELECT 1 FROM empresas WHERE subdominio=$1', [ADMIN.subdominio]);
  if (jaTem.rowCount > 0) {
    console.log('Seed ja aplicado (empresa piloto existe).');
    return;
  }
  console.log('Semeando empresa-piloto + admin de RH...');
  const empresaId = randomUUID();
  await owner.query(
    `INSERT INTO empresas (id, razao_social, cnpj, subdominio, atualizado_em)
     VALUES ($1,'Empresa Piloto Ltda','00000000000100',$2, now())`,
    [empresaId, ADMIN.subdominio],
  );
  const senhaHash = await hash(ADMIN.senha);
  await owner.query(
    `INSERT INTO usuarios_admin (id, empresa_id, nome, email, senha_hash, papel, atualizado_em)
     VALUES (gen_random_uuid(), $1, 'RH Master (piloto)', $2, $3, 'RH_MASTER'::"PapelAdmin", now())`,
    [empresaId, ADMIN.email, senhaHash],
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
