import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { EventoAcesso, StatusFuncionario, TipoSujeito } from '@prisma/client';
import {
  estaBloqueado,
  isCpfValido,
  minutosRestantes,
  normalizarCpf,
  registrarFalha,
  validarSenha,
} from '@repp/shared';
import { hashSenha, verificarSenha } from '../common/crypto/password';
import { gerarCodigoConvite, gerarTokenOpaco, hashToken } from '../common/crypto/tokens';
import type { JwtPayload, UsuarioAutenticado } from '../common/auth/jwt-payload';
import { NotificacaoService } from '../common/notificacoes/notificacao.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import { AccessLogService } from './access-log.service';
import { TokensService, type ParParticipacao } from './tokens.service';

interface Ctx {
  ip?: string;
  userAgent?: string;
}

const CONVITE_VALIDADE_DIAS = 7;
const RECUPERACAO_VALIDADE_MIN = 30;

@Injectable()
export class FuncionarioAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly log: AccessLogService,
    private readonly notificacao: NotificacaoService,
  ) {}

  /**
   * Primeiro acesso: valida o codigo de convite, define a senha e registra o
   * consentimento LGPD (biometria). Ativa o funcionario. A captura da foto de
   * referencia em si e feita na Fase 2 (subsistema facial).
   */
  async primeiroAcesso(
    codigo: string,
    cpf: string,
    senha: string,
    aceiteTermos: boolean,
    ctx: Ctx,
  ): Promise<ParParticipacao> {
    if (!aceiteTermos) {
      throw new BadRequestException('E necessario aceitar os termos e o consentimento LGPD.');
    }
    const politica = validarSenha(senha);
    if (!politica.valido) throw new BadRequestException(politica.erros.join(' '));

    const cpfNorm = normalizarCpf(cpf);
    const empresaId = TenantContext.requireEmpresaId();
    const codigoHash = hashToken(codigo.toUpperCase());

    return this.prisma.forTenant(async (tx) => {
      const convite = await tx.convite.findFirst({
        where: { codigoHash, usadoEm: null },
        include: { funcionario: true },
      });
      if (!convite || convite.expiraEm.getTime() < Date.now()) {
        throw new UnauthorizedException('Convite invalido ou expirado.');
      }
      if (normalizarCpf(convite.funcionario.cpf) !== cpfNorm) {
        throw new UnauthorizedException('CPF nao confere com o convite.');
      }
      if (convite.funcionario.senhaHash) {
        throw new ConflictException('Este funcionario ja realizou o primeiro acesso.');
      }

      const senhaHash = await hashSenha(senha);
      await tx.funcionario.update({
        where: { id: convite.funcionarioId },
        data: { senhaHash, status: StatusFuncionario.ATIVO },
      });
      await tx.convite.update({ where: { id: convite.id }, data: { usadoEm: new Date() } });
      await tx.consentimentoLgpd.create({
        data: {
          empresaId,
          funcionarioId: convite.funcionarioId,
          finalidade: 'biometria_facial',
          versaoTermo: 'v1',
          concedido: true,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
      });
      await tx.logAcesso.create({
        data: {
          empresaId,
          evento: EventoAcesso.PRIMEIRO_ACESSO,
          sujeitoTipo: TipoSujeito.FUNCIONARIO,
          sujeitoId: convite.funcionarioId,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
      });

      const payload = this.montarPayload(convite.funcionarioId);
      return this.tokens.emitirPar(payload, ctx);
    });
  }

  async login(cpf: string, senha: string, ctx: Ctx): Promise<ParParticipacao & { status: StatusFuncionario }> {
    const agora = new Date();
    const cpfNorm = normalizarCpf(cpf);
    const credenciaisInvalidas = new UnauthorizedException('CPF ou senha invalidos.');

    const funcionario = await this.prisma.forTenant((tx) =>
      tx.funcionario.findFirst({ where: { cpf: cpfNorm } }),
    );
    if (!funcionario || !funcionario.senhaHash || funcionario.status === StatusFuncionario.DESLIGADO) {
      await this.log.registrar({
        evento: EventoAcesso.LOGIN_FALHA,
        sujeitoTipo: TipoSujeito.FUNCIONARIO,
        identificador: cpfNorm,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw credenciaisInvalidas;
    }

    const estado = { tentativasFalhas: funcionario.tentativasFalhas, bloqueadoAte: funcionario.bloqueadoAte };
    if (estaBloqueado(estado, agora)) {
      throw new UnauthorizedException(`Conta bloqueada. Tente novamente em ${minutosRestantes(estado, agora)} min.`);
    }

    if (!(await verificarSenha(funcionario.senhaHash, senha))) {
      const novo = registrarFalha(estado, agora);
      await this.prisma.forTenant((tx) =>
        tx.funcionario.update({
          where: { id: funcionario.id },
          data: { tentativasFalhas: novo.tentativasFalhas, bloqueadoAte: novo.bloqueadoAte },
        }),
      );
      await this.log.registrar({
        evento: novo.bloqueadoAte ? EventoAcesso.BLOQUEIO_TENTATIVAS : EventoAcesso.LOGIN_FALHA,
        sujeitoTipo: TipoSujeito.FUNCIONARIO,
        sujeitoId: funcionario.id,
        identificador: cpfNorm,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw credenciaisInvalidas;
    }

    await this.prisma.forTenant((tx) =>
      tx.funcionario.update({
        where: { id: funcionario.id },
        data: { tentativasFalhas: 0, bloqueadoAte: null, ultimoLoginEm: new Date() },
      }),
    );
    await this.log.registrar({
      evento: EventoAcesso.LOGIN_SUCESSO,
      sujeitoTipo: TipoSujeito.FUNCIONARIO,
      sujeitoId: funcionario.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    const par = await this.tokens.emitirPar(this.montarPayload(funcionario.id), ctx);
    return { ...par, status: funcionario.status };
  }

  async refresh(refreshToken: string, ctx: Ctx): Promise<ParParticipacao> {
    return this.tokens.rotacionar(
      refreshToken,
      async (sujeitoId, tipo) => {
        if (tipo !== TipoSujeito.FUNCIONARIO) throw new UnauthorizedException('Token invalido.');
        const f = await this.prisma.forTenant((tx) => tx.funcionario.findFirstOrThrow({ where: { id: sujeitoId } }));
        if (f.status === StatusFuncionario.DESLIGADO) throw new UnauthorizedException('Acesso encerrado.');
        return this.montarPayload(f.id);
      },
      ctx,
    );
  }

  /**
   * "Esqueci minha senha": gera token de recuperacao. SEMPRE responde 200 (nao
   * revela se o CPF existe). O token e enviado ao e-mail cadastrado (SMTP em
   * producao; log em dev, se o funcionario tiver e-mail).
   */
  async recuperarSenha(cpf: string, _ctx: Ctx): Promise<void> {
    const cpfNorm = normalizarCpf(cpf);
    const empresaId = TenantContext.requireEmpresaId();
    const funcionario = await this.prisma.forTenant((tx) => tx.funcionario.findFirst({ where: { cpf: cpfNorm } }));
    if (!funcionario) return;

    const token = gerarTokenOpaco();
    await this.prisma.forTenant((tx) =>
      tx.tokenRecuperacao.create({
        data: {
          empresaId,
          sujeitoId: funcionario.id,
          sujeitoTipo: TipoSujeito.FUNCIONARIO,
          tokenHash: hashToken(token),
          expiraEm: new Date(Date.now() + RECUPERACAO_VALIDADE_MIN * 60 * 1000),
        },
      }),
    );
    // Envia o token ao e-mail cadastrado pelo RH (SMTP em prod; log em dev).
    await this.notificacao.enviarEmail(
      funcionario.email,
      'REP-P - Recuperacao de senha',
      `Use este codigo para redefinir sua senha (valido por ${RECUPERACAO_VALIDADE_MIN} min): ${token}`,
    );
  }

  async redefinirSenha(token: string, novaSenha: string, ctx: Ctx): Promise<void> {
    const politica = validarSenha(novaSenha);
    if (!politica.valido) throw new BadRequestException(politica.erros.join(' '));

    const empresaId = TenantContext.requireEmpresaId();
    const tokenHash = hashToken(token);
    const sujeitoId = await this.prisma.forTenant(async (tx) => {
      const reg = await tx.tokenRecuperacao.findFirst({ where: { tokenHash, usadoEm: null } });
      if (!reg || reg.expiraEm.getTime() < Date.now()) {
        throw new UnauthorizedException('Token de recuperacao invalido ou expirado.');
      }
      const senhaHash = await hashSenha(novaSenha);
      await tx.funcionario.update({
        where: { id: reg.sujeitoId },
        data: { senhaHash, tentativasFalhas: 0, bloqueadoAte: null },
      });
      await tx.tokenRecuperacao.update({ where: { id: reg.id }, data: { usadoEm: new Date() } });
      await tx.logAcesso.create({
        data: {
          empresaId,
          evento: EventoAcesso.SENHA_REDEFINIDA,
          sujeitoTipo: TipoSujeito.FUNCIONARIO,
          sujeitoId: reg.sujeitoId,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
      });
      return reg.sujeitoId;
    });
    // Revoga sessoes ativas apos troca de senha.
    await this.tokens.revogarTodasSessoes(sujeitoId);
  }

  // ---- Convite (gerado pelo RH) ----

  async criarConvite(
    dados: {
      nome: string;
      cpf: string;
      cargo?: string;
      filialId?: string;
      jornadaId?: string;
      email?: string;
      telefone?: string;
    },
    autor: UsuarioAutenticado,
  ): Promise<{ codigo: string; expiraEm: Date }> {
    const cpfNorm = normalizarCpf(dados.cpf);
    if (!isCpfValido(cpfNorm)) throw new BadRequestException('CPF invalido.');

    const empresaId = TenantContext.requireEmpresaId();
    const codigo = gerarCodigoConvite();
    const expiraEm = new Date(Date.now() + CONVITE_VALIDADE_DIAS * 24 * 60 * 60 * 1000);

    const emailDestino = await this.prisma.forTenant(async (tx) => {
      const existente = await tx.funcionario.findFirst({ where: { cpf: cpfNorm } });
      if (existente?.senhaHash) {
        throw new ConflictException('Funcionario com este CPF ja tem acesso ativo.');
      }
      const funcionario =
        existente ??
        (await tx.funcionario.create({
          data: {
            empresaId,
            nome: dados.nome,
            cpf: cpfNorm,
            cargo: dados.cargo,
            email: dados.email,
            telefone: dados.telefone,
            filialId: dados.filialId,
            jornadaId: dados.jornadaId,
            status: StatusFuncionario.PENDENTE_CADASTRO,
          },
        }));
      await tx.convite.create({
        data: {
          empresaId,
          funcionarioId: funcionario.id,
          codigoHash: hashToken(codigo),
          expiraEm,
          criadoPorAdminId: autor.sub,
        },
      });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'convite.gerar',
          entidadeAfetada: 'funcionarios',
          entidadeId: funcionario.id,
          valorNovo: { nome: dados.nome, cpf: cpfNorm },
        },
      });
      return funcionario.email;
    });
    // Envia o codigo de convite ao e-mail (se cadastrado). RH tambem ve o codigo.
    await this.notificacao.enviarEmail(
      emailDestino,
      'REP-P - Convite de primeiro acesso',
      `Voce foi convidado a acessar o REP-P. Seu codigo de primeiro acesso: ${codigo} (valido por ${CONVITE_VALIDADE_DIAS} dias).`,
    );
    return { codigo, expiraEm };
  }

  private montarPayload(id: string): JwtPayload {
    return { sub: id, tipo: TipoSujeito.FUNCIONARIO, empresaId: TenantContext.requireEmpresaId() };
  }
}
