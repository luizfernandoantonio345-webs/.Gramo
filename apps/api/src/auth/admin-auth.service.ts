import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventoAcesso, PapelAdmin, TipoSujeito } from '@prisma/client';
import { estaBloqueado, minutosRestantes, registrarFalha, validarSenha } from '@repp/shared';
import { cifrar, decifrar } from '../common/crypto/aes';
import { hashSenha, verificarSenha } from '../common/crypto/password';
import { gerarSegredoTotp, otpauthUrl, verificarTotp } from '../common/crypto/totp';
import type { JwtPayload, UsuarioAutenticado } from '../common/auth/jwt-payload';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import { AccessLogService } from './access-log.service';
import { TokensService, type ParParticipacao } from './tokens.service';

interface Ctx {
  ip?: string;
  userAgent?: string;
}

const DESAFIO_TTL = 300; // 5 min para completar o 2FA

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly tokens: TokensService,
    private readonly log: AccessLogService,
  ) {}

  /**
   * Passo 1: valida e-mail + senha. NUNCA emite tokens aqui -- 2FA e obrigatorio
   * para admin. Retorna um desafio de curta duracao para o passo de 2FA.
   */
  async login(
    email: string,
    senha: string,
    ctx: Ctx,
  ): Promise<{ desafioToken: string; setup2fa: boolean } | ParParticipacao> {
    const agora = new Date();
    const admin = await this.prisma.forTenant((tx) =>
      tx.usuarioAdmin.findFirst({ where: { email: email.toLowerCase() } }),
    );

    // Resposta generica para nao revelar existencia de e-mail.
    const credenciaisInvalidas = new UnauthorizedException('Credenciais invalidas.');

    if (!admin || !admin.ativo) {
      await this.log.registrar({
        evento: EventoAcesso.LOGIN_FALHA,
        sujeitoTipo: TipoSujeito.ADMIN,
        identificador: email,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw credenciaisInvalidas;
    }

    if (
      estaBloqueado(
        { tentativasFalhas: admin.tentativasFalhas, bloqueadoAte: admin.bloqueadoAte },
        agora,
      )
    ) {
      const mins = minutosRestantes(
        { tentativasFalhas: admin.tentativasFalhas, bloqueadoAte: admin.bloqueadoAte },
        agora,
      );
      throw new UnauthorizedException(`Conta bloqueada. Tente novamente em ${mins} min.`);
    }

    const senhaOk = await verificarSenha(admin.senhaHash, senha);
    if (!senhaOk) {
      await this.registrarFalhaLogin(
        admin.id,
        admin.tentativasFalhas,
        admin.bloqueadoAte,
        agora,
        email,
        ctx,
      );
      throw credenciaisInvalidas;
    }

    // Senha correta: zera lockout e emite desafio de 2FA.
    await this.prisma.forTenant((tx) =>
      tx.usuarioAdmin.update({
        where: { id: admin.id },
        data: { tentativasFalhas: 0, bloqueadoAte: null },
      }),
    );

    // Bypass de 2FA em duas situacoes:
    //  (a) DEV local: DEV_BYPASS_2FA=true e NODE_ENV != production; OU
    //  (b) opt-out explicito: ADMIN_2FA_OPCIONAL=true (vale ATE em producao).
    // (b) e uma decisao consciente do operador -- 2FA e uma protecao importante;
    // e totalmente reversivel (basta remover a env e reiniciar a API).
    const bypass2fa =
      (process.env.DEV_BYPASS_2FA === 'true' && process.env.NODE_ENV !== 'production') ||
      process.env.ADMIN_2FA_OPCIONAL === 'true';
    if (bypass2fa) {
      await this.log.registrar({
        evento: EventoAcesso.LOGIN_SUCESSO,
        sujeitoTipo: TipoSujeito.ADMIN,
        sujeitoId: admin.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return this.tokens.emitirPar(this.montarPayload(admin.id, admin.papel), ctx);
    }

    const desafioToken = await this.jwt.signAsync(
      {
        sub: admin.id,
        empresaId: TenantContext.requireEmpresaId(),
        tipo: TipoSujeito.ADMIN,
        stage: '2fa',
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: DESAFIO_TTL },
    );
    return { desafioToken, setup2fa: !admin.totpAtivado };
  }

  /**
   * Passo 2a (primeiro acesso): gera o segredo TOTP e devolve a URL otpauth para
   * o QR Code. O segredo e guardado CIFRADO (AES-256), ainda inativo.
   */
  async iniciarSetup2fa(desafioToken: string): Promise<{ otpauthUrl: string; segredo: string }> {
    const { sub } = await this.validarDesafio(desafioToken);
    const admin = await this.prisma.forTenant((tx) =>
      tx.usuarioAdmin.findFirstOrThrow({ where: { id: sub } }),
    );
    if (admin.totpAtivado) {
      throw new ConflictException('2FA ja esta ativado para este administrador.');
    }
    const segredo = gerarSegredoTotp();
    const empresa = await this.prisma.forTenant((tx) =>
      tx.empresa.findFirstOrThrow({ select: { razaoSocial: true } }),
    );
    await this.prisma.forTenant((tx) =>
      tx.usuarioAdmin.update({ where: { id: sub }, data: { totpSecret: cifrar(segredo) } }),
    );
    return { otpauthUrl: otpauthUrl(admin.email, empresa.razaoSocial, segredo), segredo };
  }

  /**
   * Passo 2b: verifica o codigo TOTP. Conclui o setup (ativa o 2FA) quando for
   * o primeiro acesso e emite o par de tokens da sessao.
   */
  async verificar2fa(desafioToken: string, codigo: string, ctx: Ctx): Promise<ParParticipacao> {
    const { sub } = await this.validarDesafio(desafioToken);
    const admin = await this.prisma.forTenant((tx) =>
      tx.usuarioAdmin.findFirstOrThrow({ where: { id: sub } }),
    );
    if (!admin.totpSecret) {
      throw new BadRequestException('2FA nao iniciado. Refaca o login e configure o autenticador.');
    }

    const segredo = decifrar(admin.totpSecret);
    if (!verificarTotp(codigo, segredo)) {
      await this.log.registrar({
        evento: EventoAcesso.TWO_FA_FALHA,
        sujeitoTipo: TipoSujeito.ADMIN,
        sujeitoId: admin.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('Codigo de verificacao invalido.');
    }

    await this.prisma.forTenant((tx) =>
      tx.usuarioAdmin.update({
        where: { id: admin.id },
        data: { totpAtivado: true, ultimoLoginEm: new Date() },
      }),
    );
    await this.log.registrar({
      evento: EventoAcesso.LOGIN_SUCESSO,
      sujeitoTipo: TipoSujeito.ADMIN,
      sujeitoId: admin.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    const payload = this.montarPayload(admin.id, admin.papel);
    return this.tokens.emitirPar(payload, ctx);
  }

  /** Renova a sessao a partir do refresh token. */
  async refresh(refreshToken: string, ctx: Ctx): Promise<ParParticipacao> {
    return this.tokens.rotacionar(
      refreshToken,
      async (sujeitoId, tipo) => {
        if (tipo !== TipoSujeito.ADMIN) throw new UnauthorizedException('Token invalido.');
        const admin = await this.prisma.forTenant((tx) =>
          tx.usuarioAdmin.findFirstOrThrow({ where: { id: sujeitoId } }),
        );
        if (!admin.ativo) throw new UnauthorizedException('Acesso revogado.');
        return this.montarPayload(admin.id, admin.papel);
      },
      ctx,
    );
  }

  async logout(refreshToken: string, ctx: Ctx, sujeitoId?: string): Promise<void> {
    await this.tokens.revogar(refreshToken);
    await this.log.registrar({
      evento: EventoAcesso.LOGOUT,
      sujeitoTipo: TipoSujeito.ADMIN,
      sujeitoId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  // ---- Gestao de administradores (somente RH_MASTER, imposto no controller) --

  async criarAdmin(
    dados: {
      nome: string;
      email: string;
      senhaProvisoria: string;
      papel: PapelAdmin;
      filialIds?: string[];
    },
    autor: UsuarioAutenticado,
  ): Promise<{ id: string }> {
    const politica = validarSenha(dados.senhaProvisoria);
    if (!politica.valido) throw new BadRequestException(politica.erros.join(' '));

    const email = dados.email.toLowerCase();
    const jaExiste = await this.prisma.forTenant((tx) =>
      tx.usuarioAdmin.findFirst({ where: { email } }),
    );
    if (jaExiste) throw new ConflictException('Ja existe um administrador com este e-mail.');

    const senhaHash = await hashSenha(dados.senhaProvisoria);
    const empresaId = TenantContext.requireEmpresaId();
    const criado = await this.prisma.forTenant(async (tx) => {
      const admin = await tx.usuarioAdmin.create({
        data: { empresaId, nome: dados.nome, email, senhaHash, papel: dados.papel },
      });
      if (dados.filialIds?.length) {
        await tx.adminFilialAcesso.createMany({
          data: dados.filialIds.map((filialId) => ({ empresaId, adminId: admin.id, filialId })),
        });
      }
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'admin.criar',
          entidadeAfetada: 'usuarios_admin',
          entidadeId: admin.id,
          valorNovo: { nome: dados.nome, email, papel: dados.papel },
        },
      });
      return admin;
    });
    return { id: criado.id };
  }

  async listarAdmins(): Promise<
    Array<{
      id: string;
      nome: string;
      email: string;
      papel: PapelAdmin;
      ativo: boolean;
      totpAtivado: boolean;
    }>
  > {
    return this.prisma.forTenant((tx) =>
      tx.usuarioAdmin.findMany({
        select: { id: true, nome: true, email: true, papel: true, ativo: true, totpAtivado: true },
        orderBy: { nome: 'asc' },
      }),
    );
  }

  async revogarAcesso(adminId: string, autor: UsuarioAutenticado): Promise<void> {
    if (adminId === autor.sub) {
      throw new BadRequestException('Voce nao pode revogar o proprio acesso.');
    }
    const empresaId = TenantContext.requireEmpresaId();
    await this.prisma.forTenant(async (tx) => {
      const admin = await tx.usuarioAdmin.findFirst({ where: { id: adminId } });
      if (!admin) throw new BadRequestException('Administrador nao encontrado.');
      await tx.usuarioAdmin.update({ where: { id: adminId }, data: { ativo: false } });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'admin.revogar',
          entidadeAfetada: 'usuarios_admin',
          entidadeId: adminId,
          valorAnterior: { ativo: true },
          valorNovo: { ativo: false },
        },
      });
    });
    await this.tokens.revogarTodasSessoes(adminId);
    await this.log.registrar({
      evento: EventoAcesso.ACESSO_REVOGADO,
      sujeitoTipo: TipoSujeito.ADMIN,
      sujeitoId: adminId,
    });
  }

  // ---- helpers ----

  private montarPayload(id: string, papel: PapelAdmin): JwtPayload {
    return { sub: id, tipo: TipoSujeito.ADMIN, empresaId: TenantContext.requireEmpresaId(), papel };
  }

  private async validarDesafio(desafioToken: string): Promise<{ sub: string }> {
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; empresaId: string; stage?: string }>(
        desafioToken,
        { secret: process.env.JWT_ACCESS_SECRET, algorithms: ['HS256'] },
      );
      if (p.stage !== '2fa' || p.empresaId !== TenantContext.requireEmpresaId()) {
        throw new UnauthorizedException('Desafio invalido.');
      }
      return { sub: p.sub };
    } catch {
      throw new UnauthorizedException('Desafio de 2FA invalido ou expirado.');
    }
  }

  private async registrarFalhaLogin(
    adminId: string,
    tentativas: number,
    bloqueadoAte: Date | null,
    agora: Date,
    email: string,
    ctx: Ctx,
  ): Promise<void> {
    const novo = registrarFalha({ tentativasFalhas: tentativas, bloqueadoAte }, agora);
    await this.prisma.forTenant((tx) =>
      tx.usuarioAdmin.update({
        where: { id: adminId },
        data: { tentativasFalhas: novo.tentativasFalhas, bloqueadoAte: novo.bloqueadoAte },
      }),
    );
    await this.log.registrar({
      evento: novo.bloqueadoAte ? EventoAcesso.BLOQUEIO_TENTATIVAS : EventoAcesso.LOGIN_FALHA,
      sujeitoTipo: TipoSujeito.ADMIN,
      sujeitoId: adminId,
      identificador: email,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }
}
