import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../common/tenant/tenant-context';

/**
 * PrismaService com enforcement de tenant no nivel do banco.
 *
 * `forTenant()` abre uma transacao, seta `app.current_empresa_id` via SET LOCAL
 * (escopo da transacao) e roda as queries dentro dela. Combinado com as policies
 * de RLS (prisma/sql/rls-policies.sql), garante que uma query so ve/escreve
 * dados da empresa corrente -- mesmo que a aplicacao esqueca um filtro WHERE.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conectado ao PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Executa `fn` numa transacao com o tenant corrente aplicado no banco (RLS).
   * A empresa vem do TenantContext (definido pelo TenantMiddleware).
   */
  async forTenant<T>(fn: (tx: PrismaTxClient) => Promise<T>): Promise<T> {
    const empresaId = TenantContext.requireEmpresaId();
    return this.forEmpresa(empresaId, fn);
  }

  /**
   * Como forTenant, mas com a empresa informada explicitamente -- usado no
   * onboarding self-service (a empresa acabou de ser criada e ainda nao ha
   * contexto de tenant na requisicao). O RLS continua ativo (escopo da empresa).
   */
  async forEmpresa<T>(empresaId: string, fn: (tx: PrismaTxClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      // SET LOCAL vale apenas para esta transacao. Parametro seguro via $1.
      await tx.$executeRaw`SELECT set_config('app.current_empresa_id', ${empresaId}, true)`;
      return fn(tx);
    });
  }

  /**
   * Resolve a empresa pelo subdominio ANTES de haver tenant no contexto (login).
   * Usa a funcao SECURITY DEFINER resolve_empresa_by_subdominio, que devolve
   * apenas metadados de roteamento (id/status) -- nunca dado operacional.
   */
  async resolverEmpresaPorSubdominio(
    subdominio: string,
  ): Promise<{ id: string; status: string } | null> {
    const linhas = await this.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status FROM resolve_empresa_by_subdominio(${subdominio})
    `;
    return linhas[0] ?? null;
  }
}

/** Tipo do client transacional entregue a `forTenant`. */
export type PrismaTxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
