import { Injectable } from '@nestjs/common';
import {
  StatusAusencia,
  StatusContestacao,
  StatusDocumento,
  StatusExcecao,
  StatusFuncionario,
  TipoMarcacao,
} from '@prisma/client';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { EscopoFilialService } from '../common/authz/escopo-filial.service';
import { BancoHorasService } from '../banco-horas/banco-horas.service';
import { PrismaService } from '../prisma/prisma.service';

/** Tipos de marcacao que deixam o funcionario "dentro" (trabalhando agora). */
const TIPOS_PRESENTE: TipoMarcacao[] = [TipoMarcacao.ENTRADA, TipoMarcacao.FIM_INTERVALO];

interface PontoPresenca {
  funcionarioId: string;
  tipo: TipoMarcacao;
  registradoEm: Date;
  funcionario: { nome: string; filial: { nome: string } | null };
}

/**
 * Reduz os pontos de hoje ao "quem esta presente agora": o ultimo ponto de cada
 * funcionario define o estado (ENTRADA/FIM_INTERVALO = dentro; SAIDA/INICIO_
 * INTERVALO = fora). Puro e testavel isoladamente.
 */
export function calcularPresenca(pontosOrdenados: PontoPresenca[]) {
  const ultimoPorFuncionario = new Map<string, PontoPresenca>();
  for (const p of pontosOrdenados) ultimoPorFuncionario.set(p.funcionarioId, p);

  const presentes = [...ultimoPorFuncionario.values()]
    .filter((p) => TIPOS_PRESENTE.includes(p.tipo))
    .map((p) => ({
      funcionario: p.funcionario.nome,
      filial: p.funcionario.filial?.nome ?? 'Sem filial',
      desde: p.registradoEm.toISOString(),
    }))
    .sort((a, b) => a.funcionario.localeCompare(b.funcionario, 'pt-BR'));

  const porFilialMap = new Map<string, number>();
  for (const p of presentes) porFilialMap.set(p.filial, (porFilialMap.get(p.filial) ?? 0) + 1);
  const porFilial = [...porFilialMap.entries()]
    .map(([filial, total]) => ({ filial, total }))
    .sort((a, b) => b.total - a.total);

  return { total: presentes.length, porFilial, presentes };
}

/** ADM 5 -- Dashboard Geral (visao executiva consolidada). So leitura. */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escopo: EscopoFilialService,
    private readonly bancoHoras: BancoHorasService,
  ) {}

  /** Alerta proativo de hora extra do dia (delegado ao BancoHorasService). */
  alertasExtrasHoje(autor: UsuarioAutenticado) {
    return this.bancoHoras.alertasHoraExtraHoje(autor);
  }

  async geral(autor: UsuarioAutenticado) {
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);
    const ha48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const em30dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const f = await this.escopo.escopoFilialId(autor);
    const pf = f.filialId ? { funcionario: { is: { filialId: f.filialId } } } : {};

    return this.prisma.forTenant(async (tx) => {
      const [
        funcionariosAtivos,
        marcacoesHoje,
        foraRegapHoje,
        excecoesPendentes,
        documentosVencendo,
        contestacoesAbertas,
        feriasPendentes,
        alertas,
      ] = await Promise.all([
        tx.funcionario.count({ where: { ...f, status: StatusFuncionario.ATIVO } }),
        tx.ponto.count({ where: { ...f, registradoEm: { gte: inicioHoje } } }),
        tx.ponto.count({ where: { ...f, registradoEm: { gte: inicioHoje }, dentroRegap: false } }),
        tx.aprovacaoExcecao.count({ where: { ...pf, status: StatusExcecao.PENDENTE } }),
        tx.documento.count({
          where: { status: StatusDocumento.APROVADO, dataValidade: { not: null, lte: em30dias } },
        }),
        tx.contestacaoPonto.count({ where: { ...pf, status: StatusContestacao.ABERTA } }),
        tx.feriasAfastamento.count({ where: { ...pf, status: StatusAusencia.PENDENTE } }),
        // Alertas prioritarios: excecoes pendentes ha mais de 48h.
        tx.aprovacaoExcecao.findMany({
          where: { ...pf, status: StatusExcecao.PENDENTE, criadoEm: { lt: ha48h } },
          orderBy: { criadoEm: 'asc' },
          take: 10,
          select: {
            id: true,
            tipo: true,
            criadoEm: true,
            funcionario: { select: { nome: true } },
          },
        }),
      ]);

      // Serie de presenca dos ultimos 7 dias (marcacoes por dia).
      const presenca: Array<{ dia: string; marcacoes: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const ini = new Date(inicioHoje);
        ini.setDate(ini.getDate() - i);
        const fim = new Date(ini);
        fim.setDate(fim.getDate() + 1);
        const n = await tx.ponto.count({ where: { ...f, registradoEm: { gte: ini, lt: fim } } });
        presenca.push({ dia: ini.toISOString().slice(0, 10), marcacoes: n });
      }

      return {
        kpis: {
          funcionariosAtivos,
          marcacoesHoje,
          foraRegapHoje,
          excecoesPendentes,
          documentosVencendo,
          contestacoesAbertas,
          feriasPendentes,
        },
        alertasPrioritarios: alertas.map((a) => ({
          id: a.id,
          tipo: a.tipo,
          funcionario: a.funcionario.nome,
          desde: a.criadoEm.toISOString(),
        })),
        presenca7dias: presenca,
      };
    });
  }

  /**
   * Presenca EM TEMPO REAL: quem esta trabalhando agora (ultimo ponto de hoje =
   * ENTRADA/FIM_INTERVALO). Escopo por filial + RLS. Leitura leve para polling.
   */
  async presencaAgora(autor: UsuarioAutenticado) {
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);
    const f = await this.escopo.escopoFilialId(autor);

    const pontos = await this.prisma.forTenant((tx) =>
      tx.ponto.findMany({
        where: { ...f, registradoEm: { gte: inicioHoje } },
        orderBy: { registradoEm: 'asc' },
        select: {
          funcionarioId: true,
          tipo: true,
          registradoEm: true,
          funcionario: { select: { nome: true, filial: { select: { nome: true } } } },
        },
      }),
    );

    return { atualizadoEm: new Date().toISOString(), ...calcularPresenca(pontos) };
  }
}
