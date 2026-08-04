import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma da PLATAFORMA: conecta como `repp_super`, role sem acesso a
 * dados operacionais (biometria/ponto/documentos) -- o isolamento e garantido no
 * banco (ver rls-policies.sql). NAO usa TenantContext (opera acima dos tenants).
 *
 * Usa SUPER_DATABASE_URL; se ausente (dev com um unico banco), cai para
 * DATABASE_URL com aviso. Em PRODUCAO isso e proibido (fail-fast): a plataforma
 * exige a role dedicada `repp_super` -- ver S4 na auditoria/SECURITY-REVIEW.
 */
@Injectable()
export class PrismaSuperService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaSuperService.name);

  constructor() {
    // Fail-fast em producao: sem a role dedicada, o super cairia para repp_app
    // (sem acesso a plataforma) -- melhor derrubar o boot do que rodar quebrado.
    if (!process.env.SUPER_DATABASE_URL && process.env.NODE_ENV === 'production') {
      throw new Error(
        'SUPER_DATABASE_URL e obrigatorio em producao (role repp_super da plataforma).',
      );
    }
    super({ datasourceUrl: process.env.SUPER_DATABASE_URL ?? process.env.DATABASE_URL });
    if (!process.env.SUPER_DATABASE_URL) {
      this.logger.warn(
        'SUPER_DATABASE_URL ausente -- usando DATABASE_URL. Em producao, use a role repp_super.',
      );
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (e) {
      this.logger.warn(`Plataforma sem conexao propria: ${(e as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Metricas de uso agregadas (via funcao SECURITY DEFINER; nunca le os dados). */
  async metricasUso(empresaId: string): Promise<{
    funcionariosAtivos: number;
    marcacoesMes: number;
    documentos: number;
  }> {
    const linhas = await this.$queryRaw<
      Array<{ funcionarios_ativos: number; marcacoes_mes: number; documentos: number }>
    >`SELECT * FROM metricas_uso_empresa(${empresaId}::uuid)`;
    const r = linhas[0] ?? { funcionarios_ativos: 0, marcacoes_mes: 0, documentos: 0 };
    return {
      funcionariosAtivos: Number(r.funcionarios_ativos),
      marcacoesMes: Number(r.marcacoes_mes),
      documentos: Number(r.documentos),
    };
  }
}
