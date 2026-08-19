import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Status de compliance REP-P (Portaria 671) para o painel de homologacao. */
@Injectable()
export class ComplianceStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async status() {
    return this.prisma.forTenant(async (tx) => {
      const [totalFuncionarios, funcionariosSemPis, totalMarcacoes, ultimaExportacao, contadorNsr] =
        await Promise.all([
          tx.funcionario.count({ where: { desativadoEm: null } }),
          tx.funcionario.count({ where: { desativadoEm: null, pis: null } }),
          tx.ponto.count(),
          tx.exportacaoAfdAej.findFirst({
            where: { tipoArquivo: 'AFD' },
            orderBy: { criadoEm: 'desc' },
            select: { criadoEm: true },
          }),
          tx.contadorNsr.findFirst({ orderBy: { ultimoNsr: 'desc' }, select: { ultimoNsr: true } }),
        ]);

      return {
        totalFuncionarios,
        funcionariosSemPis,
        totalMarcacoes,
        ultimaExportacaoAfd: ultimaExportacao?.criadoEm?.toISOString() ?? null,
        nsrAtual: contadorNsr ? Number(contadorNsr.ultimoNsr) : 0,
      };
    });
  }
}
