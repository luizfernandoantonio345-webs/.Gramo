import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TipoSujeito } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantContext } from '../tenant/tenant-context';

function ctx(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function reqCom(empresaId: string, tokenEmpresaId: string) {
  return {
    empresaId,
    header: (h: string) => (h.toLowerCase() === 'authorization' ? 'Bearer tok' : undefined),
    _tokenEmpresaId: tokenEmpresaId,
  } as Record<string, unknown>;
}

function jwtFake(empresaId: string): JwtService {
  return {
    verifyAsync: async () => ({ sub: 'u1', tipo: TipoSujeito.ADMIN, empresaId }),
  } as unknown as JwtService;
}

describe('JwtAuthGuard (vinculo de tenant)', () => {
  it('aceita quando o empresaId do token bate com o tenant', async () => {
    const guard = new JwtAuthGuard(jwtFake('emp-1'));
    const req = reqCom('emp-1', 'emp-1');
    const ok = await TenantContext.run({ empresaId: 'emp-1' }, () => guard.canActivate(ctx(req)));
    expect(ok).toBe(true);
    expect((req as { user?: { sub: string } }).user?.sub).toBe('u1');
  });

  it('rejeita token de outra empresa (anti-replay entre tenants)', async () => {
    const guard = new JwtAuthGuard(jwtFake('emp-2'));
    const req = reqCom('emp-1', 'emp-2');
    await expect(
      TenantContext.run({ empresaId: 'emp-1' }, () => guard.canActivate(ctx(req))),
    ).rejects.toThrow(/nao pertence a esta empresa/);
  });

  it('rejeita quando falta o token', async () => {
    const guard = new JwtAuthGuard(jwtFake('emp-1'));
    const req = { empresaId: 'emp-1', header: () => undefined } as Record<string, unknown>;
    await expect(guard.canActivate(ctx(req))).rejects.toThrow(/Token ausente/);
  });
});
