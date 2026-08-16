/** Encerra o backend (API + Postgres embarcado) subido no globalSetup. */
export default async function globalTeardown(): Promise<void> {
  const g = globalThis as unknown as { __E2E_STACK_STOP__?: () => Promise<void> };
  await g.__E2E_STACK_STOP__?.();
}
