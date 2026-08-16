import { bootStack } from '../../api/test/e2e/boot-stack.mjs';

/**
 * Sobe o backend real (PG embarcado + seed + API na porta 3000) antes dos testes
 * de integracao. Guarda o `stop` no globalThis para o globalTeardown encerrar.
 */
export default async function globalSetup(): Promise<void> {
  const { stop } = await bootStack({ apiPort: 3000 });
  (globalThis as unknown as { __E2E_STACK_STOP__?: () => Promise<void> }).__E2E_STACK_STOP__ = stop;
}
