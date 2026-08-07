/* eslint-disable no-console -- script de CLI: o console e a saida esperada. */
/**
 * Massa de DEMONSTRACAO da GRAMO (para o app parecer "vivo" numa apresentacao).
 * Cria ~36 funcionarios ATIVOS distribuidos nas 3 obras + ~12 dias uteis de
 * marcacoes por pessoa (com faltas e horas extras plausiveis) + a ENTRADA de
 * HOJE (para o telao de presenca mostrar gente trabalhando agora).
 *
 * Os pontos sao gravados com NSR sequencial por filial e HASH DE INTEGRIDADE
 * corretos (replicando o conteudo canonico do backend), entao passam na
 * verificacao do AFD. Coordenadas ficam nulas (dentroRegap=true e setado direto)
 * para garantir que o hash reconstruido bata sem depender da precisao do Decimal.
 *
 * Idempotente: se ja houver marca de demo, nao faz nada. Para refazer do zero,
 * apague a pasta .devdb e rode os seeds de novo.
 *
 * Uso: node scripts/seed-demo.mjs   (com o banco de dev no ar em :54329)
 */
import { hash as argon2 } from '@node-rs/argon2';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';

const OWNER_URL =
  process.env.MIGRATION_DATABASE_URL ??
  'postgresql://repp_owner:repp_owner_dev@localhost:54329/repp_dev';

const SENHA_DEMO = 'Gramo@12345';
const DIAS_HISTORICO = 12; // dias uteis para tras (alem de hoje)
const MARCA_DEMO = '@gramo.demo';

const NOMES = [
  'João Silva',
  'Maria Santos',
  'Carlos Oliveira',
  'Paulo Souza',
  'Pedro Lima',
  'Lucas Pereira',
  'Marcos Costa',
  'Luiz Rodrigues',
  'Gabriel Almeida',
  'Rafael Nascimento',
  'Daniel Araújo',
  'Marcelo Ferreira',
  'Bruno Gomes',
  'Eduardo Barbosa',
  'Felipe Ribeiro',
  'Rodrigo Martins',
  'Fernando Carvalho',
  'Gustavo Rocha',
  'Antônio Alves',
  'Francisco Dias',
  'Tiago Monteiro',
  'André Cardoso',
  'Ricardo Teixeira',
  'Sérgio Correia',
  'Roberto Pinto',
  'Fábio Moreira',
  'Alexandre Ramos',
  'Leonardo Freitas',
  'Vinícius Cunha',
  'Diego Azevedo',
  'Mateus Farias',
  'Guilherme Barros',
  'Rogério Campos',
  'Henrique Cavalcanti',
  'Wesley Machado',
  'Ademir Batista',
];
const CARGOS_OBRA = [
  'Pedreiro',
  'Servente',
  'Carpinteiro',
  'Armador',
  'Eletricista',
  'Encanador',
  'Pintor',
  'Operador de máquina',
  'Mestre de obras',
  'Almoxarife',
];
const CARGOS_ADM = ['Engenheiro civil', 'Técnico de segurança', 'Apontador', 'Analista de RH'];

// --- CPF valido (com digitos verificadores) ---------------------------------
function digito(nums) {
  const len = nums.length + 1;
  const soma = nums.reduce((s, v, i) => s + v * (len - i), 0);
  const r = (soma * 10) % 11;
  return r === 10 ? 0 : r;
}
function gerarCpf(usados) {
  for (;;) {
    const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    if (base.every((d) => d === base[0])) continue;
    const d1 = digito(base);
    const d2 = digito([...base, d1]);
    const cpf = [...base, d1, d2].join('');
    if (!usados.has(cpf)) {
      usados.add(cpf);
      return cpf;
    }
  }
}

// --- Conteudo canonico do ponto (identico ao packages/shared/ponto-hash.ts) --
function canonico(p) {
  return JSON.stringify([
    'repp-ponto-v1',
    p.empresaId,
    p.funcionarioId,
    String(p.nsr),
    p.tipo,
    p.registradoEm,
    p.origemHora,
    p.latitude ?? null,
    p.longitude ?? null,
    p.dentroRegap,
    p.uuidIdempotencia,
  ]);
}
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// America/Recife = UTC-3 (sem horario de verao). Local HH:MM -> instante UTC.
function instanteUtc(ano, mes, dia, horaLocal, minLocal) {
  return new Date(Date.UTC(ano, mes, dia, horaLocal + 3, minLocal, 0, 0));
}
const jitter = (max) => Math.floor(Math.random() * (max + 1));
const parseHora = (hhmm) => hhmm.split(':').map(Number);

async function main() {
  const c = new pg.Client({ connectionString: OWNER_URL });
  await c.connect();
  try {
    const emp = await c.query('SELECT id FROM empresas WHERE subdominio=$1', ['gramo']);
    if (emp.rowCount === 0) {
      console.log('Empresa "gramo" nao existe. Rode antes: node scripts/seed-gramo.mjs');
      return;
    }
    const empresaId = emp.rows[0].id;

    const jaTem = await c.query(
      `SELECT 1 FROM funcionarios WHERE empresa_id=$1 AND email LIKE $2 LIMIT 1`,
      [empresaId, `%${MARCA_DEMO}`],
    );
    if (jaTem.rowCount > 0) {
      console.log('Massa de demo ja aplicada. Nada a fazer. (para refazer: apague .devdb)');
      return;
    }

    const filiais = (
      await c.query('SELECT id, nome FROM filiais WHERE empresa_id=$1 ORDER BY nome', [empresaId])
    ).rows;
    const jornadas = (
      await c.query(
        'SELECT id, nome, hora_entrada, hora_saida, dias_semana, carga_diaria_minutos FROM jornadas WHERE empresa_id=$1',
        [empresaId],
      )
    ).rows;
    if (filiais.length === 0 || jornadas.length === 0) {
      console.log('Faltam filiais/jornadas. Rode node scripts/seed-gramo.mjs primeiro.');
      return;
    }
    const jObra = jornadas.find((j) => /obra/i.test(j.nome)) ?? jornadas[0];
    const jAdm = jornadas.find((j) => /admin/i.test(j.nome)) ?? jornadas[0];
    const nomeMatriz = (filiais.find((f) => /matriz/i.test(f.nome)) ?? filiais[0]).nome;

    // NSR corrente por filial (contador oficial; default = max ja existente).
    const nsrAtual = {};
    for (const f of filiais) {
      const cont = await c.query('SELECT ultimo_nsr FROM contadores_nsr WHERE filial_id=$1', [f.id]);
      if (cont.rowCount > 0) {
        nsrAtual[f.id] = Number(cont.rows[0].ultimo_nsr);
      } else {
        const mx = await c.query('SELECT COALESCE(MAX(nsr),0) m FROM pontos WHERE filial_id=$1', [
          f.id,
        ]);
        nsrAtual[f.id] = Number(mx.rows[0].m);
      }
    }

    const cpfsUsados = new Set(
      (await c.query('SELECT cpf FROM funcionarios WHERE empresa_id=$1', [empresaId])).rows.map(
        (r) => r.cpf,
      ),
    );
    const senhaHash = await argon2(SENHA_DEMO);

    console.log('Semeando massa de demonstracao...');
    await c.query('BEGIN');

    const hoje = new Date();
    let totalFunc = 0;
    let totalPontos = 0;

    for (let i = 0; i < NOMES.length; i++) {
      const nome = NOMES[i];
      const filial = filiais[i % filiais.length];
      const ehAdm = filial.nome === nomeMatriz;
      const jornada = ehAdm ? jAdm : jObra;
      const cargo = ehAdm
        ? CARGOS_ADM[i % CARGOS_ADM.length]
        : CARGOS_OBRA[i % CARGOS_OBRA.length];
      const cpf = gerarCpf(cpfsUsados);
      const email = `demo${String(i + 1).padStart(2, '0')}${MARCA_DEMO}`;
      const funcId = randomUUID();

      await c.query(
        `INSERT INTO funcionarios (id, empresa_id, filial_id, cpf, nome, cargo, email, jornada_id,
           senha_hash, status, foto_aprovada, atualizado_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ATIVO'::"StatusFuncionario", true, now())`,
        [funcId, empresaId, filial.id, cpf, nome, cargo, email, jornada.id, senhaHash],
      );
      totalFunc++;

      const [hEnt, mEnt] = parseHora(jornada.hora_entrada);
      const [hSai, mSai] = parseHora(jornada.hora_saida);
      const dias = jornada.dias_semana; // 0=dom .. 6=sab

      // Historico: DIAS_HISTORICO dias uteis para tras + hoje.
      for (let back = DIAS_HISTORICO; back >= 0; back--) {
        const d = new Date(hoje);
        d.setDate(d.getDate() - back);
        const ano = d.getFullYear();
        const mes = d.getMonth();
        const dia = d.getDate();
        const dow = new Date(Date.UTC(ano, mes, dia, 12)).getUTCDay();
        if (!dias.includes(dow)) continue; // folga

        const ehHoje = back === 0;
        // ~4% de faltas nos dias passados (nao hoje).
        if (!ehHoje && Math.random() < 0.04) continue;

        const marcas = [];
        const entMin = jitter(8);
        marcas.push({ tipo: 'ENTRADA', h: hEnt, m: mEnt + entMin });
        if (!ehHoje) {
          // almoco 12:00-13:00 e saida (com ~20% de hora extra).
          marcas.push({ tipo: 'INICIO_INTERVALO', h: 12, m: 0 });
          marcas.push({ tipo: 'FIM_INTERVALO', h: 13, m: jitter(4) });
          const extra = Math.random() < 0.2 ? 60 + jitter(90) : jitter(10);
          marcas.push({ tipo: 'SAIDA', h: hSai, m: mSai + extra });
        }

        for (const mk of marcas) {
          const nsr = ++nsrAtual[filial.id];
          const registradoEm = instanteUtc(ano, mes, dia, mk.h, mk.m).toISOString();
          const uuidIdem = randomUUID();
          const hashIntegridade = sha256(
            canonico({
              empresaId,
              funcionarioId: funcId,
              nsr,
              tipo: mk.tipo,
              registradoEm,
              origemHora: 'SERVIDOR',
              latitude: null,
              longitude: null,
              dentroRegap: true,
              uuidIdempotencia: uuidIdem,
            }),
          );
          await c.query(
            `INSERT INTO pontos (id, empresa_id, filial_id, funcionario_id, nsr, uuid_idempotencia,
               tipo, registrado_em, origem_hora, dentro_regap, status_validacao, hash_integridade, criado_em)
             VALUES (gen_random_uuid(), $1,$2,$3,$4,$5, $6::"TipoMarcacao", $7,
               'SERVIDOR'::"OrigemHora", true, 'VALIDO'::"StatusValidacaoPonto", $8, now())`,
            [empresaId, filial.id, funcId, nsr, uuidIdem, mk.tipo, registradoEm, hashIntegridade],
          );
          totalPontos++;
        }
      }
    }

    // Atualiza o contador oficial de NSR por filial (para os pontos reais seguirem).
    for (const f of filiais) {
      await c.query(
        `INSERT INTO contadores_nsr (id, empresa_id, filial_id, ultimo_nsr)
         VALUES (gen_random_uuid(), $1, $2, $3)
         ON CONFLICT (filial_id) DO UPDATE SET ultimo_nsr = EXCLUDED.ultimo_nsr`,
        [empresaId, f.id, nsrAtual[f.id]],
      );
    }

    await c.query('COMMIT');
    console.log('\n================ MASSA DE DEMO SEMEADA ================');
    console.log(`Funcionarios: ${totalFunc} (ATIVOS, distribuidos nas ${filiais.length} obras)`);
    console.log(`Marcacoes:    ${totalPontos} (${DIAS_HISTORICO} dias uteis + entrada de hoje)`);
    console.log(`Senha demo:   ${SENHA_DEMO} (todos os funcionarios de demo)`);
    console.log('Abra o Dashboard / Telao (?modo=presenca) / Relatorios para ver "vivo".');
    console.log('======================================================\n');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error('Falha no seed de demo:', e.message);
  process.exit(1);
});
