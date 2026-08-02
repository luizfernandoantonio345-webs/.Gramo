import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { bootPg } from '../pg-embed.mjs';

/**
 * Testes e2e contra um Postgres REAL embarcado. Validam garantias que so o banco
 * pode provar (impossivel em teste de unidade):
 *   1. RLS -- isolamento entre empresas (tenant).
 *   2. NSR -- sequencia sem furos sob concorrencia real (varias conexoes).
 *   3. Imutabilidade -- UPDATE/DELETE de ponto negados a repp_app.
 */
const { Client, Pool } = pg;
const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
// Porta aleatoria: evita colisao com um postmaster remanescente de outra execucao.
const PORT = 40000 + Math.floor(Math.random() * 20000);

let falhas = 0;
function check(nome, cond) {
  if (cond) console.log(`  PASS  ${nome}`);
  else {
    console.error(`  FAIL  ${nome}`);
    falhas++;
  }
}

function lerMigration() {
  // Aplica TODAS as migrations em ordem (nome com timestamp e ordenavel).
  const base = join(apiDir, 'prisma', 'migrations');
  const dirs = readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  return dirs.map((d) => readFileSync(join(base, d, 'migration.sql'), 'utf8')).join('\n');
}
function lerRls() {
  return readFileSync(join(apiDir, 'prisma', 'sql', 'rls-policies.sql'), 'utf8');
}

const uuid = () =>
  '10000000-0000-4000-8000-' + Math.floor(Math.random() * 1e12).toString().padStart(12, '0');

async function main() {
  const { stop } = await bootPg(PORT);
  const conn = (user, database) => ({ host: 'localhost', port: PORT, user, password: user, database });
  // Evita que um erro de conexao durante o teardown vire 'error' nao tratado.
  const novoClient = (user, database) => {
    const c = new Client(conn(user, database));
    c.on('error', () => {});
    return c;
  };

  try {
    // --- Provisiona roles + banco (como superuser) ---
    const su = novoClient('postgres', 'postgres');
    await su.connect();
    await su.query(`CREATE ROLE repp_owner LOGIN SUPERUSER PASSWORD 'repp_owner'`);
    await su.query(`CREATE ROLE repp_app LOGIN PASSWORD 'repp_app' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`);
    await su.query(`CREATE ROLE repp_super LOGIN PASSWORD 'repp_super' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`);
    await su.query(`CREATE DATABASE repp_test OWNER repp_owner`);
    await su.query(`GRANT CONNECT ON DATABASE repp_test TO repp_app`);
    await su.query(`GRANT CONNECT ON DATABASE repp_test TO repp_super`);
    await su.end();

    // --- Schema + RLS (como owner) ---
    const owner = novoClient('repp_owner', 'repp_test');
    await owner.connect();
    await owner.query(lerMigration());
    await owner.query(lerRls());

    // Semeia duas empresas + funcionarios (owner bypassa RLS).
    const empA = uuid();
    const empB = uuid();
    const funcA = uuid();
    const funcB = uuid();
    const filialA = uuid();
    await owner.query(
      `INSERT INTO empresas (id, razao_social, cnpj, subdominio, atualizado_em)
       VALUES ($1,'Empresa A','00000000000101','empa',now()), ($2,'Empresa B','00000000000102','empb',now())`,
      [empA, empB],
    );
    await owner.query(
      `INSERT INTO filiais (id, empresa_id, nome) VALUES ($1,$2,'Matriz A')`,
      [filialA, empA],
    );
    await owner.query(
      `INSERT INTO funcionarios (id, empresa_id, nome, cpf, atualizado_em)
       VALUES ($1,$2,'Ana (A)','11111111111',now()), ($3,$4,'Bruno (B)','22222222222',now())`,
      [funcA, empA, funcB, empB],
    );
    await owner.end();

    // ================= 1. RLS: isolamento por tenant =================
    console.log('\n[1] RLS - isolamento entre empresas');
    const app = novoClient('repp_app', 'repp_test');
    await app.connect();

    await app.query(`SELECT set_config('app.current_empresa_id', $1, false)`, [empA]);
    const visToA = await app.query('SELECT count(*)::int AS n FROM funcionarios');
    check('empresa A ve apenas os proprios funcionarios (1)', visToA.rows[0].n === 1);
    const vazamento = await app.query('SELECT count(*)::int AS n FROM funcionarios WHERE cpf = $1', ['22222222222']);
    check('empresa A NAO ve funcionario da empresa B (0)', vazamento.rows[0].n === 0);

    await app.query(`SELECT set_config('app.current_empresa_id', $1, false)`, [empB]);
    const visToB = await app.query('SELECT count(*)::int AS n FROM funcionarios');
    check('empresa B ve apenas os proprios funcionarios (1)', visToB.rows[0].n === 1);

    await app.query(`SELECT set_config('app.current_empresa_id', '', false)`);
    const semTenant = await app.query('SELECT count(*)::int AS n FROM funcionarios');
    check('sem tenant no contexto -> nenhuma linha visivel (0)', semTenant.rows[0].n === 0);

    // Resolver de subdominio (SECURITY DEFINER) funciona sem tenant.
    const resolv = await app.query(`SELECT id, status FROM resolve_empresa_by_subdominio('empa')`);
    check('resolve_empresa_by_subdominio devolve a empresa correta', resolv.rows[0]?.id === empA);

    // ================= 2. NSR: concorrencia real =================
    console.log('\n[2] NSR - sequencia sem furos sob concorrencia');
    const N = 60;
    const pool = new Pool({ ...conn('repp_app', 'repp_test'), max: 10 });
    const tarefas = Array.from({ length: N }, () =>
      (async () => {
        const c = await pool.connect();
        try {
          await c.query('BEGIN');
          await c.query(`SELECT set_config('app.current_empresa_id', $1, true)`, [empA]);
          const r = await c.query(
            `INSERT INTO contadores_nsr (id, empresa_id, filial_id, ultimo_nsr)
             VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 1)
             ON CONFLICT (filial_id) DO UPDATE SET ultimo_nsr = contadores_nsr.ultimo_nsr + 1
             RETURNING ultimo_nsr`,
            [empA, filialA],
          );
          await c.query('COMMIT');
          return Number(r.rows[0].ultimo_nsr);
        } catch (e) {
          await c.query('ROLLBACK');
          throw e;
        } finally {
          c.release();
        }
      })(),
    );
    const nsrs = (await Promise.all(tarefas)).sort((a, b) => a - b);
    const esperado = Array.from({ length: N }, (_, i) => i + 1);
    check(`NSR gerou 1..${N} sem furos nem duplicatas`, JSON.stringify(nsrs) === JSON.stringify(esperado));
    check('NSR sem valores repetidos', new Set(nsrs).size === N);
    await pool.end();

    // ================= 3. Imutabilidade do ponto =================
    console.log('\n[3] Imutabilidade - UPDATE/DELETE de ponto negados');
    // Insere um ponto valido como owner (bypassa RLS).
    const owner2 = novoClient('repp_owner', 'repp_test');
    await owner2.connect();
    const pontoId = uuid();
    await owner2.query(
      `INSERT INTO pontos (id, empresa_id, filial_id, funcionario_id, nsr, uuid_idempotencia, tipo,
         registrado_em, origem_hora, dentro_regap, status_validacao, hash_integridade)
       VALUES ($1,$2,$3,$4, 1, $5, 'ENTRADA'::"TipoMarcacao", now(), 'SERVIDOR'::"OrigemHora",
         true, 'VALIDO'::"StatusValidacaoPonto", 'hash-abc')`,
      [pontoId, empA, filialA, funcA, uuid()],
    );
    await owner2.end();

    await app.query(`SELECT set_config('app.current_empresa_id', $1, false)`, [empA]);
    let updateNegado = false;
    try {
      await app.query('UPDATE pontos SET status_validacao = $1 WHERE id = $2', ['PENDENTE_REGAP', pontoId]);
    } catch {
      updateNegado = true;
    }
    check('UPDATE em pontos e negado a repp_app', updateNegado);

    let deleteNegado = false;
    try {
      await app.query('DELETE FROM pontos WHERE id = $1', [pontoId]);
    } catch {
      deleteNegado = true;
    }
    check('DELETE em pontos e negado a repp_app', deleteNegado);

    // Assinaturas virtuais tambem sao append-only (privilegio revogado).
    let updAssinNegado = false;
    try {
      await app.query(`UPDATE assinaturas_virtuais SET hash_assinatura = 'x'`);
    } catch {
      updAssinNegado = true;
    }
    check('UPDATE em assinaturas_virtuais e negado a repp_app', updAssinNegado);

    let delAssinNegado = false;
    try {
      await app.query('DELETE FROM assinaturas_virtuais');
    } catch {
      delAssinNegado = true;
    }
    check('DELETE em assinaturas_virtuais e negado a repp_app', delAssinNegado);

    await app.end();

    // ============ 4. Super Admin (ADM 0): boundary no nivel do banco ============
    console.log('\n[4] Super Admin - ve plataforma, NUNCA dados operacionais');
    const sup = novoClient('repp_super', 'repp_test');
    await sup.connect();

    // Ve TODAS as empresas (metadados de plataforma), sem tenant.
    const empresas = await sup.query('SELECT count(*)::int AS n FROM empresas');
    check('repp_super ve todas as empresas (>=2)', empresas.rows[0].n >= 2);

    // Barreira dura: negado em pontos, funcionarios, documentos, assinaturas.
    for (const tabela of ['pontos', 'funcionarios', 'documentos', 'assinaturas_virtuais', 'consentimentos_lgpd']) {
      let negado = false;
      try {
        await sup.query(`SELECT count(*) FROM ${tabela}`);
      } catch {
        negado = true;
      }
      check(`repp_super NAO acessa ${tabela} (dados operacionais)`, negado);
    }

    // Metricas de uso via funcao SECURITY DEFINER (agregados, nao os dados).
    const metricas = await sup.query('SELECT * FROM metricas_uso_empresa($1)', [empA]);
    check('metricas_uso_empresa retorna agregados', typeof metricas.rows[0].funcionarios_ativos === 'number');

    await sup.end();
  } finally {
    // O encerramento do Postgres nunca deve mascarar o resultado dos testes.
    try {
      await stop();
    } catch {
      /* ignora ruido de shutdown */
    }
  }

  console.log('');
  if (falhas > 0) {
    console.error(`E2E FALHOU: ${falhas} verificacao(oes).`);
    process.exit(1);
  }
  console.log('E2E OK: RLS, concorrencia do NSR e imutabilidade validados.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
