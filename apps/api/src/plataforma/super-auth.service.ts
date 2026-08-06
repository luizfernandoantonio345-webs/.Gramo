import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TipoSujeito } from '@prisma/client';
import { estaBloqueado, minutosRestantes, registrarFalha } from '@repp/shared';
import { cifrar, decifrar } from '../common/crypto/aes';
import { hashSenha, verificarSenha } from '../common/crypto/password';
import { gerarTokenOpaco, hashToken } from '../common/crypto/tokens';
import { gerarSegredoTotp, otpauthUrl, verificarTotp } from '../common/crypto/totp';
import { PrismaSuperService } from './prisma-super.service';

interface Ctx {
  ip?: string;
  userAgent?: string;
}

const DESAFIO_TTL = 300;

@Injectable()
export class SuperAuthService implements OnModuleInit {
  private readonly logger = new Logger(SuperAuthService.name);

  constructor(
    private readonly prisma: PrismaSuperService,
    private readonly jwt: JwtService,
  ) {}

  /** Bootstrap: cria o primeiro Super Admin a partir de env, se a tabela estiver vazia. */
  async onModuleInit(): Promise<void> {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const senha = process.env.SUPER_ADMIN_SENHA;
    if (!email || !senha) return;
    try {
      const total = await this.prisma.superAdmin.count();
      if (total > 0) return;
      await this.prisma.superAdmin.create({
        data: {
          nome: 'Super Admin',
          email: email.toLowerCase(),
          senhaHash: await hashSenha(senha),
        },
      });
      this.logger.warn(
        `Super Admin inicial criado (${email}). Configure o 2FA no primeiro acesso.`,
      );
    } catch (e) {
      this.logger.warn(`Bootstrap do Super Admin ignorado: ${(e as Error).message}`);
    }
  }

  async login(
    email: string,
    senha: string,
  ): Promise<
    | { desafioToken: string; setup2fa: boolean }
    | { accessToken: string; refreshToken: string; expiresIn: number }
  > {
    const agora = new Date();
    const sa = await this.prisma.superAdmin.findFirst({ where: { email: email.toLowerCase() } });
    const invalido = new UnauthorizedException('Credenciais invalidas.');
    if (!sa || !sa.ativo) throw invalido;

    if (
      estaBloqueado({ tentativasFalhas: sa.tentativasFalhas, bloqueadoAte: sa.bloqueadoAte }, agora)
    ) {
      const m = minutosRestantes(
        { tentativasFalhas: sa.tentativasFalhas, bloqueadoAte: sa.bloqueadoAte },
        agora,
      );
      throw new UnauthorizedException(`Conta bloqueada. Tente em ${m} min.`);
    }
    if (!(await verificarSenha(sa.senhaHash, senha))) {
      const novo = registrarFalha(
        { tentativasFalhas: sa.tentativasFalhas, bloqueadoAte: sa.bloqueadoAte },
        agora,
      );
      await this.prisma.superAdmin.update({
        where: { id: sa.id },
        data: { tentativasFalhas: novo.tentativasFalhas, bloqueadoAte: novo.bloqueadoAte },
      });
      throw invalido;
    }
    await this.prisma.superAdmin.update({
      where: { id: sa.id },
      data: { tentativasFalhas: 0, bloqueadoAte: null },
    });

    // DEV ONLY: bypass de 2FA para demonstracao local (gated por env + NODE_ENV).
    if (process.env.DEV_BYPASS_2FA === 'true' && process.env.NODE_ENV !== 'production') {
      await this.registrarLog(sa.id, 'super.login', 'super_admins', sa.id, {});
      return this.emitirPar(sa.id, {});
    }

    const desafioToken = await this.jwt.signAsync(
      { sub: sa.id, tipo: TipoSujeito.SUPER_ADMIN, stage: '2fa' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: DESAFIO_TTL },
    );
    return { desafioToken, setup2fa: !sa.totpAtivado };
  }

  async iniciarSetup2fa(desafioToken: string): Promise<{ otpauthUrl: string; segredo: string }> {
    const sub = await this.validarDesafio(desafioToken);
    const sa = await this.prisma.superAdmin.findUniqueOrThrow({ where: { id: sub } });
    if (sa.totpAtivado) throw new ConflictException('2FA ja ativado.');
    const segredo = gerarSegredoTotp();
    await this.prisma.superAdmin.update({
      where: { id: sub },
      data: { totpSecret: cifrar(segredo) },
    });
    return { otpauthUrl: otpauthUrl(sa.email, 'Plataforma', segredo), segredo };
  }

  async verificar2fa(desafioToken: string, codigo: string, ctx: Ctx) {
    const sub = await this.validarDesafio(desafioToken);
    const sa = await this.prisma.superAdmin.findUniqueOrThrow({ where: { id: sub } });
    if (!sa.totpSecret) throw new BadRequestException('2FA nao iniciado.');
    if (!verificarTotp(codigo, decifrar(sa.totpSecret))) {
      throw new UnauthorizedException('Codigo invalido.');
    }
    await this.prisma.superAdmin.update({
      where: { id: sa.id },
      data: { totpAtivado: true, ultimoLoginEm: new Date() },
    });
    await this.registrarLog(sa.id, 'super.login', 'super_admins', sa.id, ctx);
    return this.emitirPar(sa.id, ctx);
  }

  async refresh(refreshToken: string, ctx: Ctx) {
    const tokenHash = hashToken(refreshToken);
    const reg = await this.prisma.superRefreshToken.findFirst({ where: { tokenHash } });
    if (!reg || reg.revogadoEm || reg.expiraEm.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh invalido ou expirado.');
    }
    await this.prisma.superRefreshToken.update({
      where: { id: reg.id },
      data: { revogadoEm: new Date() },
    });
    return this.emitirPar(reg.superAdminId, ctx);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.superRefreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
  }

  // ---- helpers ----

  private async emitirPar(superAdminId: string, ctx: Ctx) {
    const accessToken = await this.jwt.signAsync(
      { sub: superAdminId, tipo: TipoSujeito.SUPER_ADMIN, empresaId: '' },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: Number(process.env.JWT_ACCESS_TTL ?? 900),
      },
    );
    const refreshToken = gerarTokenOpaco();
    await this.prisma.superRefreshToken.create({
      data: {
        superAdminId,
        tokenHash: hashToken(refreshToken),
        expiraEm: new Date(Date.now() + Number(process.env.JWT_REFRESH_TTL ?? 2592000) * 1000),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
    });
    return { accessToken, refreshToken, expiresIn: Number(process.env.JWT_ACCESS_TTL ?? 900) };
  }

  private async validarDesafio(desafioToken: string): Promise<string> {
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; tipo: string; stage?: string }>(
        desafioToken,
        {
          secret: process.env.JWT_ACCESS_SECRET,
          algorithms: ['HS256'],
        },
      );
      if (p.stage !== '2fa' || p.tipo !== TipoSujeito.SUPER_ADMIN) {
        throw new UnauthorizedException('Desafio invalido.');
      }
      return p.sub;
    } catch {
      throw new UnauthorizedException('Desafio de 2FA invalido ou expirado.');
    }
  }

  private async registrarLog(
    superAdminId: string | null,
    acao: string,
    entidade: string,
    entidadeId: string | null,
    ctx: Ctx,
    valorNovo?: unknown,
  ) {
    await this.prisma.logSuperAdmin.create({
      data: {
        superAdminId: superAdminId ?? undefined,
        acao,
        entidadeAfetada: entidade,
        entidadeId: entidadeId ?? undefined,
        ip: ctx.ip,
        valorNovo: (valorNovo as object) ?? undefined,
      },
    });
  }

  /** Reuso interno para registrar acoes vindas do SuperAdminService. */
  async log(
    superAdminId: string,
    acao: string,
    entidade: string,
    entidadeId: string | null,
    ctx: Ctx,
    valorNovo?: unknown,
  ) {
    await this.registrarLog(superAdminId, acao, entidade, entidadeId, ctx, valorNovo);
  }
}
