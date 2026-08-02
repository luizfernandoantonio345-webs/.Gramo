import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { TenantContext } from '../tenant/tenant-context';
import type { JwtPayload, UsuarioAutenticado } from './jwt-payload';

/**
 * Valida o access token (Bearer) e vincula o usuario ao tenant da requisicao.
 *
 * Defesa contra replay entre empresas: o `empresaId` do token DEVE bater com o
 * tenant resolvido pelo subdominio (TenantMiddleware). Se um token de outra
 * empresa for apresentado, e rejeitado mesmo sendo assinado corretamente.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: UsuarioAutenticado; empresaId?: string }>();
    const token = this.extrairBearer(req);
    if (!token) throw new UnauthorizedException('Token ausente.');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Token invalido ou expirado.');
    }

    if (!req.empresaId || payload.empresaId !== req.empresaId) {
      throw new UnauthorizedException('Token nao pertence a esta empresa.');
    }

    req.user = payload;
    // Enriquecemos o contexto de tenant com o autor, para a trilha de auditoria.
    const store = TenantContext.get();
    if (store) {
      store.usuarioId = payload.sub;
      store.usuarioTipo = payload.tipo === 'FUNCIONARIO' ? 'funcionario' : 'admin';
    }
    return true;
  }

  private extrairBearer(req: Request): string | null {
    const auth = req.header('authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice('Bearer '.length).trim();
  }
}
