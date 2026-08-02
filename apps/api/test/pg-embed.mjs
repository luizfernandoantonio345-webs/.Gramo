import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

/**
 * Sobe um PostgreSQL real EMBARCADO (binario portatil, sem Docker/admin) para
 * gerar migration e rodar os testes e2e (RLS, concorrencia do NSR, imutabilidade)
 * em maquinas sem Postgres instalado.
 */
export async function bootPg(port) {
  const dir = mkdtempSync(join(tmpdir(), 'repp-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();

  const stop = async () => {
    try {
      await pg.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  return { pg, port, dir, stop };
}

export function urlFor(port, user, pass, db) {
  return `postgresql://${user}:${pass}@localhost:${port}/${db}?schema=public`;
}
