import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(AfdService.name);
  constructor(private readonly prisma: PrismaService) {}

  async gerar(
    inicio: Date,
    fim: Date,
    filialId?: string,
  ): Promise<{ conteudo: string; total: number }> {
    return this.prisma.forTenant(async (tx) => {
      const empresa = await tx.empresa.findFirstOrThrow({
        select: { cnpj: true, razaoSocial: true, numeroInpi: true },
      });

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
          funcionario: { select: { cpf: true, pis: true } },
        },
      });

      // Aviso: funcionarios sem PIS geram AFD com CPF como fallback.
      // O RH deve preencher o PIS de todos antes da fiscalizacao.
      const semPis = pontos.filter((p) => !p.funcionario.pis);
      if (semPis.length > 0) {
        this.logger.warn(
          `AFD: ${semPis.length} marcacoes de funcionarios sem PIS cadastrado -- usando CPF como fallback. Preencha o PIS em Funcionarios para conformidade com a Portaria 671.`,
        );
      }

      const marcacoes: MarcacaoAfd[] = pontos.map((p) => ({
        nsr: p.nsr.toString(),
        dataHora: p.registradoEm,
        nis: soNumeros(p.funcionario.pis ?? p.funcionario.cpf),
        hash: p.hashIntegridade,
      }));
      if (!empresa.numeroInpi) {
        this.logger.warn(
          'AFD: numero INPI nao configurado. Preencha em Configuracoes > Dados da Empresa para conformidade com Portaria 671 Art. 89.',
        );
      }
      const conteudo = montarAfd(
        {
          tipoIdentificador: 1,
          cpfCnpj: filial?.cnpj ?? empresa.cnpj,
          cno: null,
          razaoSocial: empresa.razaoSocial,
          numeroInpi: empresa.numeroInpi ?? undefined,
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
