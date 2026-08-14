import { ForbiddenException, Injectable } from '@nestjs/common';
import { PapelAdmin } from '@prisma/client';
import type { UsuarioAutenticado } from '../auth/jwt-payload';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Escopo por filial (autorizacao intra-tenant). A RLS isola por EMPRESA; este
 * servico restringe o GESTOR_FILIAL as filiais que ele gerencia (AdminFilialAcesso).
 * RH_MASTER/FINANCEIRO/AUDITORIA veem toda a empresa.
 */
@Injectable()
export class EscopoFilialService {
  constructor(private readonly prisma: PrismaService) {}

  /** True se o papel deve ser restringido por filial. Puro. */
  restringe(papel?: PapelAdmin | null): boolean {
    return papel === PapelAdmin.GESTOR_FILIAL;
  }

  /** Filiais que o usuario pode acessar, ou null (= todas, sem restricao). */
  async filiaisPermitidas(user: UsuarioAutenticado): Promise<string[] | null> {
    if (!this.restringe(user.papel)) return null;
    const acessos = await this.prisma.forTenant((tx) =>
      tx.adminFilialAcesso.findMany({ where: { adminId: user.sub }, select: { filialId: true } }),
    );
    return acessos.map((a) => a.filialId);
  }

  /**
   * Fragmento de `where` do Prisma para o campo `filialId` (ou undefined quando
   * sem restricao). Uso: `where: { ...await escopoFilialId(user) }`.
   */
  async escopoFilialId(user: UsuarioAutenticado): Promise<{ filialId?: { in: string[] } }> {
    const filiais = await this.filiaisPermitidas(user);
    return filiais === null ? {} : { filialId: { in: filiais } };
  }

  /** Garante que o usuario pode agir sobre uma filial especifica (mutacoes). */
  async garantirFilial(
    user: UsuarioAutenticado,
    filialId: string | null | undefined,
  ): Promise<void> {
    const filiais = await this.filiaisPermitidas(user);
    if (filiais === null) return; // sem restricao
    if (!filialId || !filiais.includes(filialId)) {
      throw new ForbiddenException('Acesso restrito as filiais sob sua gestao.');
    }
  }
}
