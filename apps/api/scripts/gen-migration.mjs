import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootPg, urlFor } from '../test/pg-embed.mjs';

/**
 * Gera uma migration do Prisma usando um Postgres embarcado (aplica as
 * migrations existentes e cria a nova para o diff do schema).
 * Uso: node scripts/gen-migration.mjs <nome>   (default: init)
 */
const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nome = process.argv[2] ?? 'init';
const PORT = 55000 + Math.floor(Math.random() * 5000);

const { pg, stop } = await bootPg(PORT);
try {
  await pg.createDatabase('repp_dev');
  const url = urlFor(PORT, 'postgres', 'postgres', 'repp_dev');
  const env = { ...process.env, DATABASE_URL: url, MIGRATION_DATABASE_URL: url };

  console.log(`> prisma migrate dev --name ${nome}`);
  execSync(`npx prisma migrate dev --name ${nome} --skip-generate`, {
    cwd: apiDir,
    env,
    stdio: 'inherit',
  });
  console.log('Migration gerada em apps/api/prisma/migrations.');
} finally {
  try {
    await stop();
  } catch {
    /* ignora ruido de shutdown do Postgres */
  }
}
process.exit(0);
