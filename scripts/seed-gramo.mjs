/* eslint-disable no-console -- script de CLI: o console e a saida esperada. */
/**
 * Seed single-tenant da GRAMO ENGENHARIA (Fase 1 da entrega). Idempotente.
 * Cria: empresa + admin RH + obras (filiais) com REGAP + jornadas + funcionario
 * de exemplo + feriados. Dados PLAUSIVEIS (troque pelos reais depois).
 *
 * Uso: node scripts/seed-gramo.mjs   (com o banco de dev no ar em :54329)
 */
import { hash } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const OWNER_URL =
  process.env.MIGRATION_DATABASE_URL ??
  'postgresql://repp_owner:repp_owner_dev@localhost:54329/repp_dev';

// --- Dados da GRAMO (exemplo; substitua pelos reais na entrega) ---------------
const EMPRESA = {
  razaoSocial: 'GRAMO ENGENHARIA LTDA',
  cnpj: '19283746000155', // exemplo (14 digitos)
  subdominio: 'gramo',
};
const ADMIN = { nome: 'RH GRAMO', email: 'rh@gramoengenharia.com.br', senha: 'GramoRH@2026' };
const FUNC = { nome: 'Jose da Silva', cpf: '52998224725', senha: 'Gramo@12345' };

// Obra (filial) real da GRAMO com a cerca geografica (REGAP): a Refinaria
// Gabriel Passos (REGAP) da Petrobras, em Betim/MG. Area RESTRITA ao trecho da
// Portaria 3 ate o norte do complexo: centro deslocado ~410 m ao norte do
// centro geografico da refinaria (-19.97676, -44.09681) e raio reduzido de
// 1500 -> 800 m. Coordenadas estimadas pelo mapa -- revisar no painel admin.
const OBRAS = [
  {
    nome: 'Petrobras - Refinaria Gabriel Passos (REGAP)',
    lat: -19.973,
    lng: -44.0968,
    raio: 800,
  },
];
const JORNADAS = [
  // Obra: 07h-16h, seg-sab, banco anual (CCT construcao civil). 8h de carga.
  {
    nome: 'Obra (07h-16h)',
    ent: '07:00',
    sai: '16:00',
    dias: [1, 2, 3, 4, 5, 6],
    carga: 480,
    regime: 'BANCO_ANUAL',
  },
  // Administrativo: 08h-18h, seg-sex, compensacao mensal. 9h - 1h almoco = 8h.
  {
    nome: 'Administrativo (08h-18h)',
    ent: '08:00',
    sai: '18:00',
    dias: [1, 2, 3, 4, 5],
    carga: 480,
    regime: 'COMPENSACAO_MENSAL',
  },
];
const FERIADOS_2026 = [
  { data: '2026-01-01', nome: 'Confraternizacao Universal' },
  { data: '2026-04-21', nome: 'Tiradentes' },
  { data: '2026-05-01', nome: 'Dia do Trabalho' },
  { data: '2026-09-07', nome: 'Independencia' },
  { data: '2026-12-25', nome: 'Natal' },
];

async function main() {
  const c = new pg.Client({ connectionString: OWNER_URL });
  await c.connect();
  try {
    const existe = await c.query('SELECT id FROM empresas WHERE subdominio=$1', [
      EMPRESA.subdominio,
    ]);
    if (existe.rowCount > 0) {
      console.log('Seed GRAMO ja aplicado (empresa "gramo" existe). Nada a fazer.');
      return;
    }
    console.log('Semeando GRAMO ENGENHARIA...');
    await c.query('BEGIN');

    const empresaId = randomUUID();
    await c.query(
      `INSERT INTO empresas (id, razao_social, cnpj, subdominio, atualizado_em)
       VALUES ($1,$2,$3,$4, now())`,
      [empresaId, EMPRESA.razaoSocial, EMPRESA.cnpj, EMPRESA.subdominio],
    );

    // Admin RH
    await c.query(
      `INSERT INTO usuarios_admin (id, empresa_id, nome, email, senha_hash, papel, atualizado_em)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'RH_MASTER'::"PapelAdmin", now())`,
      [empresaId, ADMIN.nome, ADMIN.email.toLowerCase(), await hash(ADMIN.senha)],
    );

    // Jornadas
    const jornadaId = {};
    for (const j of JORNADAS) {
      const id = randomUUID();
      jornadaId[j.nome] = id;
      await c.query(
        `INSERT INTO jornadas (id, empresa_id, nome, hora_entrada, hora_saida, tolerancia_minutos,
           carga_diaria_minutos, dias_semana, regime_horas, limite_extra_diaria_min, ativo, criado_em)
         VALUES ($1,$2,$3,$4,$5,10,$6,$7,$8::"RegimeHoras",120,true, now())`,
        [id, empresaId, j.nome, j.ent, j.sai, j.carga, j.dias, j.regime],
      );
    }

    // Obras (filiais) + REGAP de cada uma
    const filialId = {};
    for (const o of OBRAS) {
      const fid = randomUUID();
      filialId[o.nome] = fid;
      await c.query(
        `INSERT INTO filiais (id, empresa_id, nome, timezone, criado_em)
         VALUES ($1,$2,$3,'America/Sao_Paulo', now())`,
        [fid, empresaId, o.nome],
      );
      await c.query(
        `INSERT INTO regap (id, empresa_id, filial_id, nome, latitude_centro, longitude_centro, raio_metros, ativo, criado_em)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true, now())`,
        [empresaId, fid, `REGAP ${o.nome}`, o.lat, o.lng, o.raio],
      );
    }

    // Feriados nacionais
    for (const f of FERIADOS_2026) {
      await c.query(
        `INSERT INTO feriados (id, empresa_id, data, nome, tipo, criado_em)
         VALUES (gen_random_uuid(), $1, $2::date, $3, 'NACIONAL'::"TipoFeriado", now())`,
        [empresaId, f.data, f.nome],
      );
    }

    // Funcionario de exemplo (ja ATIVO, para demonstrar login+ponto na obra Suape).
    await c.query(
      `INSERT INTO funcionarios (id, empresa_id, filial_id, cpf, nome, cargo, jornada_id,
         senha_hash, status, foto_aprovada, atualizado_em)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Pedreiro', $5, $6, 'ATIVO'::"StatusFuncionario", true, now())`,
      [
        empresaId,
        filialId[OBRAS[0].nome],
        FUNC.cpf,
        FUNC.nome,
        jornadaId['Obra (07h-16h)'],
        await hash(FUNC.senha),
      ],
    );

    await c.query('COMMIT');
    console.log('\n================ GRAMO ENGENHARIA SEMEADA ================');
    console.log(`Empresa:    ${EMPRESA.razaoSocial} (subdominio: ${EMPRESA.subdominio})`);
    console.log(`Obras:      ${OBRAS.map((o) => o.nome).join(' | ')} (cada uma com REGAP)`);
    console.log(`Jornadas:   ${JORNADAS.map((j) => j.nome).join(' | ')}`);
    console.log(`Admin RH:   ${ADMIN.email}  |  senha: ${ADMIN.senha}`);
    console.log(`Funcionario:${FUNC.nome} - CPF ${FUNC.cpf} | senha: ${FUNC.senha} (obra REGAP)`);
    console.log('=========================================================\n');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error('Falha no seed GRAMO:', e.message);
  process.exit(1);
});
