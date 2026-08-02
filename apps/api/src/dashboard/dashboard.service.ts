import { Injectable } from '@nestjs/common';
import {
  StatusAusencia,
  StatusContestacao,
  StatusDocumento,
  StatusExcecao,
  StatusFuncionario,
} from '@prisma/client';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { EscopoFilialService } from '../common/authz/escopo-filial.service';
import { PrismaService } from '../prisma/prisma.service';

/** ADM 5 -- Dashboard Geral (visao executiva consolidada). So leitura. */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escopo: EscopoFilialService,
  ) {}

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
}
