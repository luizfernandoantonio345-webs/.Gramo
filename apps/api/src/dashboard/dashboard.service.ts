import { BadRequestException, Injectable } from '@nestjs/common';
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

  /**
   * Comparativo executivo ENTRE OBRAS (filiais) no periodo: headcount ativo,
   * marcacoes, e o indicador-chave de conformidade -- % de marcacoes FORA da
   * REGAP (geofence do canteiro). Visao que um gestor de multiplos canteiros usa
   * para priorizar atencao. Agregacoes baratas (groupBy), respeitando escopo/RLS.
   */
  async comparativoObras(autor: UsuarioAutenticado, inicioIso?: string, fimIso?: string) {
    const agora = new Date();
    const inicio = inicioIso
      ? new Date(inicioIso)
      : new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fim = fimIso ? new Date(fimIso) : agora;
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
      throw new BadRequestException('Periodo invalido.');
    }
    const scope = await this.escopo.escopoFilialId(autor);

    return this.prisma.forTenant(async (tx) => {
      const [filiais, ativos, marc, fora] = await Promise.all([
        tx.filial.findMany({
          where: scope.filialId ? { id: scope.filialId } : {},
          select: { id: true, nome: true },
          orderBy: { nome: 'asc' },
        }),
        tx.funcionario.groupBy({
          by: ['filialId'],
          where: { status: StatusFuncionario.ATIVO, ...scope },
          _count: { _all: true },
        }),
        tx.ponto.groupBy({
          by: ['filialId'],
          where: { registradoEm: { gte: inicio, lte: fim }, ...scope },
          _count: { _all: true },
        }),
        tx.ponto.groupBy({
          by: ['filialId'],
          where: { registradoEm: { gte: inicio, lte: fim }, dentroRegap: false, ...scope },
          _count: { _all: true },
        }),
      ]);

      const paraMapa = (arr: Array<{ filialId: string | null; _count: { _all: number } }>) =>
        new Map(arr.map((a) => [a.filialId, a._count._all]));
      const mAtivos = paraMapa(ativos);
      const mMarc = paraMapa(marc);
      const mFora = paraMapa(fora);

      const obras = filiais
        .map((f) => {
          const marcacoes = mMarc.get(f.id) ?? 0;
          const foraRegap = mFora.get(f.id) ?? 0;
          return {
            filialId: f.id,
            obra: f.nome,
            funcionariosAtivos: mAtivos.get(f.id) ?? 0,
            marcacoes,
            foraRegap,
            // 1 casa decimal; 0 quando nao houve marcacao no periodo.
            percentualForaRegap:
              marcacoes > 0 ? Math.round((foraRegap / marcacoes) * 1000) / 10 : 0,
          };
        })
        // Prioriza quem tem maior % fora da REGAP (mais risco de conformidade).
        .sort(
          (a, b) =>
            b.percentualForaRegap - a.percentualForaRegap ||
            b.funcionariosAtivos - a.funcionariosAtivos,
        );

      return { periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() }, obras };
    });
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
