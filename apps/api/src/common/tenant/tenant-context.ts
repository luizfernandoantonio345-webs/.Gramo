import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de tenant por requisicao, propagado via AsyncLocalStorage.
 *
 * Toda a stack (services, PrismaService) le a empresa corrente daqui, sem
 * precisar passar `empresaId` manualmente em cada chamada. O PrismaService
 * usa esse valor para setar `app.current_empresa_id` na transacao (RLS).
 */
export interface TenantStore {
  empresaId: string;
  /** Id do usuario autenticado (admin/funcionario), para trilha de auditoria. */
  usuarioId?: string;
  usuarioTipo?: 'admin' | 'funcionario' | 'super_admin' | 'sistema';
}

const storage = new AsyncLocalStorage<TenantStore>();

export const TenantContext = {
  /** Executa `fn` com o contexto de tenant ativo. */
  run<T>(store: TenantStore, fn: () => T): T {
    return storage.run(store, fn);
  },

  /** Retorna o contexto atual, ou undefined se fora de uma requisicao com tenant. */
  get(): TenantStore | undefined {
    return storage.getStore();
  },

  /** Retorna a empresa corrente ou lanca -- use quando o tenant e obrigatorio. */
  requireEmpresaId(): string {
    const store = storage.getStore();
    if (!store?.empresaId) {
      throw new Error('TenantContext ausente: nenhuma empresa no contexto da requisicao.');
    }
    return store.empresaId;
  },
};
