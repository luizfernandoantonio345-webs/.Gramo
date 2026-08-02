import { Injectable } from '@nestjs/common';
import { EventoAcesso, TipoSujeito } from '@prisma/client';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';

export interface DadosAcesso {
  evento: EventoAcesso;
  sujeitoTipo: TipoSujeito;
  sujeitoId?: string;
  /** CPF/e-mail tentado -- registrado inclusive quando o login falha. */
  identificador?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Log de acessos (ADM 1). Append-only (RLS revoga UPDATE/DELETE em logs_acesso).
 * Registra sucesso, falha, logout, 2FA, bloqueio -- prova de auditoria.
 */
@Injectable()
export class AccessLogService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(dados: DadosAcesso): Promise<void> {
    const empresaId = TenantContext.requireEmpresaId();
    await this.prisma.forTenant((tx) =>
      tx.logAcesso.create({
        data: {
          empresaId,
          evento: dados.evento,
          sujeitoTipo: dados.sujeitoTipo,
          sujeitoId: dados.sujeitoId,
          identificador: dados.identificador,
          ip: dados.ip,
          userAgent: dados.userAgent,
        },
      }),
    );
  }
}
