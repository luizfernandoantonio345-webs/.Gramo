import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { hashToken } from '../common/crypto/tokens';
import { PrismaService } from '../prisma/prisma.service';

/** Dispositivo resolvido pelo token e anexado a requisicao. */
export interface DispositivoKioskCtx {
  id: string;
  filialId: string;
}

/**
 * Autenticacao do QUIOSQUE (nao ha JWT de funcionario). O tablet envia o header
 * `X-Kiosk-Token`; validamos pelo hash contra um dispositivo ATIVO da empresa
 * corrente (a empresa vem do subdominio via TenantMiddleware, entao a busca ja e
 * isolada por RLS). Resolve tambem a filial do dispositivo.
 */
@Injectable()
export class KioskGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { kiosk?: DispositivoKioskCtx }>();
    const bruto = req.headers['x-kiosk-token'];
    const token = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim();
    if (!token) throw new UnauthorizedException('Token do dispositivo ausente.');

    const dispositivo = await this.prisma.forTenant((tx) =>
      tx.dispositivoKiosk.findFirst({
        where: { tokenHash: hashToken(token), ativo: true },
        select: { id: true, filialId: true },
      }),
    );
    if (!dispositivo) {
      throw new UnauthorizedException('Dispositivo de quiosque invalido ou revogado.');
    }
    req.kiosk = dispositivo;
    return true;
  }
}
