import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PapelAdmin } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { RolesGuard } from './roles.guard';

function ctxCom(papel: PapelAdmin | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user: papel ? { papel } : {} }) }),
  } as unknown as ExecutionContext;
}

function reflectorCom(papeis: PapelAdmin[] | undefined): Reflector {
  return { getAllAndOverride: () => papeis } as unknown as Reflector;
}

describe('RolesGuard', () => {
  it('permite quando a rota nao exige papel', () => {
    const guard = new RolesGuard(reflectorCom(undefined));
    expect(guard.canActivate(ctxCom(PapelAdmin.FINANCEIRO))).toBe(true);
  });

  it('permite quando o papel esta na lista', () => {
    const guard = new RolesGuard(reflectorCom([PapelAdmin.RH_MASTER]));
    expect(guard.canActivate(ctxCom(PapelAdmin.RH_MASTER))).toBe(true);
  });

  it('nega quando o papel nao esta na lista', () => {
    const guard = new RolesGuard(reflectorCom([PapelAdmin.RH_MASTER]));
    expect(() => guard.canActivate(ctxCom(PapelAdmin.AUDITORIA))).toThrow(/Permissao insuficiente/);
  });
});
