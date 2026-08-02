import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TipoSujeito } from '@prisma/client';
import type { Request } from 'express';
import type { JwtPayload } from '../common/auth/jwt-payload';

/**
 * Guard do Super Admin (ADM 0). Valida o access token e exige tipo SUPER_ADMIN.
 * NAO exige tenant (a plataforma opera acima das empresas).
 */
@Injectable()
export class SuperAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { superAdmin?: JwtPayload }>();
    const auth = req.header('authorization');
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Token ausente.');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(auth.slice(7).trim(), {
        secret: process.env.JWT_ACCESS_SECRET,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Token invalido ou expirado.');
    }
    if (payload.tipo !== TipoSujeito.SUPER_ADMIN) {
      throw new UnauthorizedException('Acesso restrito ao Super Admin.');
    }
    req.superAdmin = payload;
    return true;
  }
}
