import { Injectable } from '@nestjs/common';
import { Prisma, StatusExcecao } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditoriaQuery } from './dto/auditoria.dto';

/**
 * ADM 6 -- Relatorios e Auditoria (a principal protecao juridica). Leitura da
 * trilha imutavel (logs_auditoria/logs_acesso) e das excecoes decididas. Escopo
 * por empresa (RLS); acesso restrito a RH Master e Auditoria (somente leitura).
 */
@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Trilha de auditoria (acoes) filtravel e paginada. */
  async trilha(q: AuditoriaQuery) {
    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;
    const where: Prisma.LogAuditoriaWhereInput = {
      acao: q.acao ? { contains: q.acao, mode: 'insensitive' } : undefined,
      entidadeAfetada: q.entidade,
      timestamp: this.periodo(q.de, q.ate),
    };
    return this.prisma.forTenant(async (tx) => {
      const [itens, total] = await Promise.all([
        tx.logAuditoria.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            usuarioId: true,
            usuarioTipo: true,
            acao: true,
            entidadeAfetada: true,
            entidadeId: true,
            valorAnterior: true,
            valorNovo: true,
            ip: true,
            timestamp: true,
          },
        }),
        tx.logAuditoria.count({ where }),
      ]);
      return { itens, total, limit, offset };
    });
  }

  /** Log de acessos (login/2FA/logout/bloqueio). */
  async acessos(q: AuditoriaQuery) {
    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;
    const where: Prisma.LogAcessoWhereInput = { timestamp: this.periodo(q.de, q.ate) };
    return this.prisma.forTenant(async (tx) => {
      const [itens, total] = await Promise.all([
        tx.logAcesso.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            sujeitoTipo: true,
            identificador: true,
            evento: true,
            ip: true,
            timestamp: true,
          },
        }),
        tx.logAcesso.count({ where }),
      ]);
      return { itens, total, limit, offset };
    });
  }

  /** Relatorio de excecoes decididas (aprovadas/recusadas) com justificativas. */
  async aprovacoes() {
    return this.prisma.forTenant((tx) =>
      tx.aprovacaoExcecao.findMany({
        where: { status: { in: [StatusExcecao.APROVADA, StatusExcecao.RECUSADA] } },
        orderBy: { dataResposta: 'desc' },
        take: 200,
        select: {
          id: true,
          tipo: true,
          status: true,
          motivo: true,
          motivoResposta: true,
          dataResposta: true,
          aprovadorId: true,
          funcionario: { select: { nome: true, cpf: true } },
          ponto: { select: { nsr: true, registradoEm: true } },
        },
      }),
    );
  }

  private periodo(de?: string, ate?: string): Prisma.DateTimeFilter | undefined {
    if (!de && !ate) return undefined;
    return { gte: de ? new Date(de) : undefined, lte: ate ? new Date(ate) : undefined };
  }
}
