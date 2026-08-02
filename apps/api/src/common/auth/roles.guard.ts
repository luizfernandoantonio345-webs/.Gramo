import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PapelAdmin } from '@prisma/client';
import type { Request } from 'express';
import type { UsuarioAutenticado } from './jwt-payload';
import { ROLES_KEY } from './roles.decorator';

/**
 * Autorizacao por papel (ADM 1). Deve rodar apos o JwtAuthGuard.
 * Sem @Roles na rota, nao restringe (apenas exige estar autenticado).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const papeisExigidos = this.reflector.getAllAndOverride<PapelAdmin[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!papeisExigidos || papeisExigidos.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: UsuarioAutenticado }>();
    const papel = req.user?.papel;
    if (!papel || !papeisExigidos.includes(papel)) {
      throw new ForbiddenException('Permissao insuficiente para esta acao.');
    }
    return true;
  }
}
