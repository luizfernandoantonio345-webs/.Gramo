import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TipoSujeito } from '@prisma/client';
import { gerarTokenOpaco, hashToken } from '../common/crypto/tokens';
import type { JwtPayload } from '../common/auth/jwt-payload';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';

export interface ParParticipacao {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RespostaTrocaSenhaObrigatoria {
  requiresPasswordChange: true;
  trocaSenhaToken: string;
}

interface ContextoRequisicao {
  ip?: string;
  userAgent?: string;
}

/**
 * Emissao de access token (JWT curto) e refresh token (opaco, rotacionado).
 * O refresh e guardado apenas como hash; a rotacao revoga o anterior a cada uso
 * (deteccao de reuso = sessao comprometida).
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private ttlAccess(): number {
    return Number(process.env.JWT_ACCESS_TTL ?? 900);
  }

  private ttlRefresh(): number {
    return Number(process.env.JWT_REFRESH_TTL ?? 2592000);
  }

  async emitirPar(payload: JwtPayload, ctx: ContextoRequisicao): Promise<ParParticipacao> {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: this.ttlAccess(),
    });
    const refreshToken = await this.criarRefresh(payload.sub, payload.tipo, ctx);
    return { accessToken, refreshToken, expiresIn: this.ttlAccess() };
  }

  private async criarRefresh(
    sujeitoId: string,
    sujeitoTipo: TipoSujeito,
    ctx: ContextoRequisicao,
  ): Promise<string> {
    const token = gerarTokenOpaco();
    const expiraEm = new Date(Date.now() + this.ttlRefresh() * 1000);
    const empresaId = TenantContext.requireEmpresaId();
    await this.prisma.forTenant((tx) =>
      tx.refreshToken.create({
        data: {
          empresaId,
          sujeitoId,
          sujeitoTipo,
          tokenHash: hashToken(token),
          expiraEm,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
      }),
    );
    return token;
  }

  /**
   * Rotaciona: valida o refresh recebido, revoga-o e emite um novo par.
   * Reuso de um refresh ja revogado indica roubo -> lanca Unauthorized.
   */
  async rotacionar(
    refreshToken: string,
    montarPayload: (sujeitoId: string, tipo: TipoSujeito) => Promise<JwtPayload>,
    ctx: ContextoRequisicao,
  ): Promise<ParParticipacao> {
    const tokenHash = hashToken(refreshToken);
    return this.prisma.forTenant(async (tx) => {
      const registro = await tx.refreshToken.findFirst({ where: { tokenHash } });
      if (!registro || registro.revogadoEm || registro.expiraEm.getTime() < Date.now()) {
        throw new UnauthorizedException('Refresh token invalido ou expirado.');
      }
      await tx.refreshToken.update({
        where: { id: registro.id },
        data: { revogadoEm: new Date() },
      });
      const payload = await montarPayload(registro.sujeitoId, registro.sujeitoTipo);
      const accessToken = await this.jwt.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: this.ttlAccess(),
      });
      const novoRefresh = gerarTokenOpaco();
      await tx.refreshToken.create({
        data: {
          empresaId: registro.empresaId,
          sujeitoId: registro.sujeitoId,
          sujeitoTipo: registro.sujeitoTipo,
          tokenHash: hashToken(novoRefresh),
          expiraEm: new Date(Date.now() + this.ttlRefresh() * 1000),
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
      });
      return { accessToken, refreshToken: novoRefresh, expiresIn: this.ttlAccess() };
    });
  }

  /** Logout: revoga o refresh apresentado (se existir). */
  async revogar(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.forTenant(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { tokenHash, revogadoEm: null },
        data: { revogadoEm: new Date() },
      });
    });
  }

  /** Revoga todas as sessoes de um sujeito (ex.: acesso revogado pelo RH). */
  async revogarTodasSessoes(sujeitoId: string): Promise<void> {
    await this.prisma.forTenant(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { sujeitoId, revogadoEm: null },
        data: { revogadoEm: new Date() },
      });
    });
  }

  /** Protocolo de emergencia: revoga TODOS os refresh tokens ativos da empresa. */
  async revogarTodasSessoesDaEmpresa(): Promise<number> {
    return this.prisma.forTenant(async (tx) => {
      const result = await tx.refreshToken.updateMany({
        where: { revogadoEm: null },
        data: { revogadoEm: new Date() },
      });
      return result.count;
    });
  }

  /**
   * Emite token de curta duracao (10 min) para troca de senha obrigatoria.
   * So autoriza o endpoint POST /auth/.../trocar-senha-obrigatorio.
   */
  async emitirTokenTrocaSenha(sujeitoId: string, tipo: TipoSujeito): Promise<string> {
    const empresaId = TenantContext.requireEmpresaId();
    return this.jwt.signAsync(
      { sub: sujeitoId, tipo, empresaId, stage: 'troca_senha' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 600 },
    );
  }

  /** Valida um token de troca de senha obrigatoria. */
  async validarTokenTrocaSenha(token: string): Promise<{ sub: string; tipo: TipoSujeito }> {
    const empresaId = TenantContext.requireEmpresaId();
    try {
      const p = await this.jwt.verifyAsync<{
        sub: string;
        tipo: TipoSujeito;
        empresaId: string;
        stage?: string;
      }>(token, { secret: process.env.JWT_ACCESS_SECRET, algorithms: ['HS256'] });
      if (p.stage !== 'troca_senha' || p.empresaId !== empresaId) {
        throw new UnauthorizedException('Token invalido.');
      }
      return { sub: p.sub, tipo: p.tipo };
    } catch {
      throw new UnauthorizedException('Token de troca de senha invalido ou expirado.');
    }
  }
}
