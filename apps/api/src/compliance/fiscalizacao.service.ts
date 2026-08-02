import { Injectable } from '@nestjs/common';
import { TipoExportacao } from '@prisma/client';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { PrismaService } from '../prisma/prisma.service';
import { ExportacaoService } from './exportacao.service';

/**
 * ADM 6 -- pacote de fiscalizacao: gera AFD + AEJ do periodo e consolida um
 * manifesto com os hashes e a contagem da trilha de auditoria/acesso. E o que o
 * auditor do trabalho recebe.
 */
@Injectable()
export class FiscalizacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportacao: ExportacaoService,
  ) {}

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
