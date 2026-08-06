import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from './tenant-context';

/**
 * Resolve a empresa (tenant) ANTES das credenciais e ativa o TenantContext para
 * toda a requisicao. A empresa vem do subdominio (Host) ou do header
 * `X-Tenant-Subdominio` (util em dev/localhost, onde nao ha subdominio real).
 *
 * Isolamento: sem tenant valido, a requisicao nao prossegue. Empresa suspensa/
 * cancelada e barrada aqui (403).
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Health/docs e as rotas de PLATAFORMA (Super Admin) nao dependem de tenant.
    // Usa originalUrl (caminho completo, independente de prefixo/versao aplicados
    // ao req.path) e checa por segmento (evita falso-positivo de substring).
    const url = (req.originalUrl || req.url || '').split('?')[0] ?? '';
    if (url.startsWith('/api/docs') || /^\/api(\/v\d+)?\/(health|super|publico)(\/|$)/.test(url)) {
      return next();
    }

    const subdominio = this.extrairSubdominio(req);
    if (!subdominio) {
      throw new BadRequestException('Empresa nao identificada (subdominio ausente).');
    }

    const empresa = await this.prisma.resolverEmpresaPorSubdominio(subdominio);
    if (!empresa) {
      throw new BadRequestException('Empresa nao encontrada para o subdominio informado.');
    }
    if (empresa.status !== 'ATIVA') {
      throw new ForbiddenException('Empresa suspensa ou cancelada.');
    }

    // Anexa para uso posterior (guards) e ativa o ALS para o resto da request.
    (req as Request & { empresaId?: string }).empresaId = empresa.id;
    TenantContext.run({ empresaId: empresa.id }, () => next());
  }

  private extrairSubdominio(req: Request): string | null {
    const header = req.header('x-tenant-subdominio');
    if (header) return header.trim().toLowerCase();

    // Ex.: empresax.seuapp.com -> "empresax". Ignora www e hosts sem subdominio.
    const host = (req.hostname || '').split(':')[0] ?? '';
    const partes = host.split('.');
    if (partes.length >= 3 && partes[0] !== 'www') {
      return (partes[0] ?? '').toLowerCase();
    }
    return null;
  }
}
