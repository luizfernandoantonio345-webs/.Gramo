import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UsuarioAutenticado } from './jwt-payload';

/** Injeta o usuario autenticado (definido pelo JwtAuthGuard) no handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    const req = ctx.switchToHttp().getRequest<{ user: UsuarioAutenticado }>();
    return req.user;
  },
);
