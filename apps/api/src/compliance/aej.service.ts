import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Geracao do AEJ (Arquivo Eletronico de Jornada -- Portaria 671). Exporta as
 * jornadas tratadas do periodo em estrutura JSON documentada. O leiaute oficial
 * deve ser conferido no validador gov.br antes do go-live (estrutura v1).
 */
@Injectable()
export class AejService {
  constructor(private readonly prisma: PrismaService) {}

  async gerar(inicio: Date, fim: Date, filialId?: string): Promise<{ conteudo: string; total: number }> {
    return this.prisma.forTenant(async (tx) => {
      const empresa = await tx.empresa.findFirstOrThrow({
        select: { cnpj: true, razaoSocial: true },
      });
      const pontos = await tx.ponto.findMany({
        where: {
          registradoEm: { gte: inicio, lte: fim },
          ...(filialId ? { funcionario: { is: { filialId } } } : {}),
        },
        orderBy: [{ funcionarioId: 'asc' }, { registradoEm: 'asc' }],
        select: {
          nsr: true,
          tipo: true,
          registradoEm: true,
          origemHora: true,
          dentroRegap: true,
          statusValidacao: true,
          hashIntegridade: true,
          funcionario: { select: { cpf: true, nome: true } },
        },
      });

      // Agrupa por funcionario.
      const porFuncionario = new Map<
        string,
        { cpf: string; nome: string; marcacoes: unknown[] }
      >();
      for (const p of pontos) {
        const chave = p.funcionario.cpf;
        if (!porFuncionario.has(chave)) {
          porFuncionario.set(chave, { cpf: p.funcionario.cpf, nome: p.funcionario.nome, marcacoes: [] });
        }
        porFuncionario.get(chave)!.marcacoes.push({
          nsr: p.nsr.toString(),
          tipo: p.tipo,
          dataHora: p.registradoEm.toISOString(),
          origemHora: p.origemHora,
          dentroRegap: p.dentroRegap,
          statusValidacao: p.statusValidacao,
          hash: p.hashIntegridade,
        });
      }

      const aej = {
        versao: 'repp-aej-v1',
        empregador: { cnpj: empresa.cnpj, razaoSocial: empresa.razaoSocial },
        periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
        geradoEm: new Date().toISOString(),
        empregados: [...porFuncionario.values()],
      };
      return { conteudo: JSON.stringify(aej, null, 2), total: pontos.length };
    });
  }
}
