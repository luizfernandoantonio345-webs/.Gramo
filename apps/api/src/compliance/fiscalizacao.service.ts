import { Injectable } from '@nestjs/common';
import { TipoExportacao, TipoMarcacao } from '@prisma/client';
import { BOM_UTF8, montarCsv } from '@repp/shared';
import { EscopoFilialService } from '../common/authz/escopo-filial.service';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { PrismaService } from '../prisma/prisma.service';
import { ExportacaoService } from './exportacao.service';

const ROTULO_TIPO: Record<TipoMarcacao, string> = {
  ENTRADA: 'Entrada',
  INICIO_INTERVALO: 'Inicio intervalo',
  FIM_INTERVALO: 'Fim intervalo',
  SAIDA: 'Saida',
};

/**
 * ADM 6 -- pacote de fiscalizacao: gera AFD + AEJ do periodo e consolida um
 * manifesto com os hashes e a contagem da trilha de auditoria/acesso. E o que o
 * auditor do trabalho recebe. Tambem gera o espelho gerencial em CSV (RH/Excel).
 */
@Injectable()
export class FiscalizacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportacao: ExportacaoService,
    private readonly escopo: EscopoFilialService,
  ) {}

  /**
   * Espelho de ponto do periodo em CSV (gerencial, legivel no Excel) -- distinto
   * do AFD/AEJ (leiaute legal). Escopo por filial + RLS. Retorna o texto pronto
   * (com BOM UTF-8) para download direto no cliente.
   */
  async espelhoCsv(inicio: Date, fim: Date, autor: UsuarioAutenticado, filialId?: string) {
    const filiais = await this.escopo.filiaisPermitidas(autor);
    const escopoFilial = filiais === null ? {} : { filialId: { in: filiais } };

    const pontos = await this.prisma.forTenant((tx) =>
      tx.ponto.findMany({
        where: {
          ...escopoFilial,
          ...(filialId ? { filialId } : {}),
          registradoEm: { gte: inicio, lte: fim },
        },
        orderBy: [{ funcionario: { nome: 'asc' } }, { registradoEm: 'asc' }],
        select: {
          nsr: true,
          tipo: true,
          registradoEm: true,
          statusValidacao: true,
          dentroRegap: true,
          funcionario: { select: { nome: true, cpf: true } },
        },
      }),
    );

    const fmt = (d: Date, opt: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...opt }).format(d);

    const linhas = pontos.map((p) => [
      p.funcionario.nome,
      p.funcionario.cpf,
      fmt(p.registradoEm, { day: '2-digit', month: '2-digit', year: 'numeric' }),
      fmt(p.registradoEm, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      ROTULO_TIPO[p.tipo] ?? p.tipo,
      p.nsr.toString(),
      p.statusValidacao,
      p.dentroRegap ? 'Sim' : 'Nao',
    ]);

    const csv = montarCsv(
      ['Funcionario', 'CPF', 'Data', 'Hora', 'Tipo', 'NSR', 'Status', 'Dentro da area'],
      linhas,
    );
    const periodo = `${inicio.toISOString().slice(0, 10)}_a_${fim.toISOString().slice(0, 10)}`;
    return {
      nomeArquivo: `espelho_ponto_${periodo}.csv`,
      conteudo: BOM_UTF8 + csv,
      totalMarcacoes: pontos.length,
    };
  }

  async pacote(inicio: Date, fim: Date, autor: UsuarioAutenticado, filialId?: string) {
    const afd = await this.exportacao.exportar(TipoExportacao.AFD, inicio, fim, autor, filialId);
    const aej = await this.exportacao.exportar(TipoExportacao.AEJ, inicio, fim, autor, filialId);

    const [totalAuditoria, totalAcesso, totalMarcacoes] = await this.prisma.forTenant((tx) =>
      Promise.all([
        tx.logAuditoria.count({ where: { timestamp: { gte: inicio, lte: fim } } }),
        tx.logAcesso.count({ where: { timestamp: { gte: inicio, lte: fim } } }),
        tx.ponto.count({ where: { registradoEm: { gte: inicio, lte: fim } } }),
      ]),
    );

    return {
      periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
      geradoEm: new Date().toISOString(),
      afd: { id: afd.id, hash: afd.hashArquivo, total: afd.totalRegistros },
      aej: { id: aej.id, hash: aej.hashArquivo, total: aej.totalRegistros },
      trilha: { logsAuditoria: totalAuditoria, logsAcesso: totalAcesso, marcacoes: totalMarcacoes },
      chaveServidorId: afd.chaveServidorId,
    };
  }
}
