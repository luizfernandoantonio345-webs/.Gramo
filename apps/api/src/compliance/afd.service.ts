import { BadRequestException, Injectable } from '@nestjs/common';
import { montarAfd, soNumeros, validarAfd, type MarcacaoAfd } from '@repp/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Geracao do AFD (Portaria 671). O AFD e POR ESTABELECIMENTO (o NSR e sequencial
 * por filial); por isso exige a filial quando ha mais de uma. O arquivo e
 * auto-validado (validarAfd) antes de retornar -- nunca exporta arquivo quebrado.
 * Layout centralizado em @repp/shared/afd (confirmar no verificador oficial MTE).
 */
@Injectable()
export class AfdService {
  constructor(private readonly prisma: PrismaService) {}

  async gerar(inicio: Date, fim: Date, filialId?: string): Promise<{ conteudo: string; total: number }> {
    return this.prisma.forTenant(async (tx) => {
      const empresa = await tx.empresa.findFirstOrThrow({ select: { cnpj: true, razaoSocial: true } });

      // AFD e por estabelecimento: resolve a filial (obrigatoria se houver >1).
      const filiais = await tx.filial.findMany({ select: { id: true, cnpj: true } });
      let filial = filialId ? filiais.find((f) => f.id === filialId) : undefined;
      if (filialId && !filial) throw new BadRequestException('Filial nao encontrada.');
      if (!filial) {
        if (filiais.length > 1) {
          throw new BadRequestException(
            'Informe a filial: o AFD e por estabelecimento (NSR sequencial por filial).',
          );
        }
        filial = filiais[0];
      }

      const pontos = await tx.ponto.findMany({
        where: {
          registradoEm: { gte: inicio, lte: fim },
          ...(filial ? { funcionario: { is: { filialId: filial.id } } } : {}),
        },
        orderBy: { nsr: 'asc' },
        select: {
          nsr: true,
          registradoEm: true,
          hashIntegridade: true,
          funcionario: { select: { cpf: true } },
        },
      });
      const marcacoes: MarcacaoAfd[] = pontos.map((p) => ({
        nsr: p.nsr.toString(),
        dataHora: p.registradoEm,
        cpf: soNumeros(p.funcionario.cpf),
        hash: p.hashIntegridade,
      }));
      const conteudo = montarAfd(
        {
          tipoIdentificador: 1,
          cpfCnpj: filial?.cnpj ?? empresa.cnpj,
          cno: null,
          razaoSocial: empresa.razaoSocial,
        },
        marcacoes,
        { inicio, fim },
        new Date(),
      );

      // Defesa em profundidade: nunca exporta um AFD estruturalmente invalido.
      const check = validarAfd(conteudo);
      if (!check.valido) {
        throw new BadRequestException(`AFD invalido: ${check.erros.join(' ')}`);
      }
      return { conteudo, total: marcacoes.length };
    });
  }
}
