import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '../common/auth/jwt-payload';

/** Injeta o Super Admin autenticado (definido pelo SuperAuthGuard). */
export const CurrentSuperAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const req = ctx.switchToHttp().getRequest<{ superAdmin: JwtPayload }>();
    return req.superAdmin;
  },
);
