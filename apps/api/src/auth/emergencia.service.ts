import { Injectable } from '@nestjs/common';
import { EventoAcesso, TipoSujeito } from '@prisma/client';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import { AccessLogService } from './access-log.service';
import { TokensService } from './tokens.service';

export interface ResultadoProtocolo {
  sessoesRevogadas: number;
  adminsAfetados: number;
  funcionariosAfetados: number;
  timestamp: string;
}

export interface RegistroLogAcesso {
  id: string;
  sujeitoId: string | null;
  sujeitoTipo: string;
  identificador: string | null;
  evento: string;
  ip: string | null;
  userAgent: string | null;
  timestamp: Date;
}

/**
 * Protocolo de seguranca emergencial.
 *
 * Acionado quando credenciais foram comprometidas ou compartilhadas com terceiros.
 * Duas acoes atomicas:
 *   1. Revoga TODOS os refresh tokens ativos da empresa (efeito imediato).
 *   2. Marca todos os admins e funcionarios com `forcaTrocaSenha = true`, obrigando
 *      redefinicao na proxima tentativa de login.
 *
 * Os access tokens (JWT) sao stateless e expiram em ate 15 min (JWT_ACCESS_TTL).
 * Rotar o JWT_ACCESS_SECRET invalida tudo imediatamente mas afeta todos os tenants
 * e requer reinicializacao do servidor -- use essa medida apenas em casos extremos.
 */
@Injectable()
export class EmergenciaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly log: AccessLogService,
  ) {}

  async acionarProtocolo(autor: UsuarioAutenticado): Promise<ResultadoProtocolo> {
    const empresaId = TenantContext.requireEmpresaId();
    const timestamp = new Date().toISOString();

    // Passo 1: revoga todos os refresh tokens ativos (impede renovacao de sessao).
    const sessoesRevogadas = await this.tokens.revogarTodasSessoesDaEmpresa();

    // Passo 2: marca todos os usuarios para troca de senha obrigatoria.
    const [adminsResult, funcionariosResult] = await this.prisma.forTenant(async (tx) => {
      const admins = await tx.usuarioAdmin.updateMany({
        where: { ativo: true },
        data: { forcaTrocaSenha: true },
      });
      // Somente funcionarios que ja fizeram o primeiro acesso (senhaHash preenchido).
      const funcionarios = await tx.funcionario.updateMany({
        where: { senhaHash: { not: null } },
        data: { forcaTrocaSenha: true },
      });
      return [admins, funcionarios] as const;
    });

    // Passo 3: trilha de auditoria.
    await this.prisma.forTenant((tx) =>
      tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'emergencia.protocolo_seguranca',
          entidadeAfetada: 'empresa',
          entidadeId: empresaId,
          valorNovo: {
            sessoesRevogadas,
            adminsAfetados: adminsResult.count,
            funcionariosAfetados: funcionariosResult.count,
            motivo: 'credenciais_comprometidas',
            acionadoPor: autor.sub,
            timestamp,
          },
        },
      }),
    );

    await this.log.registrar({
      evento: EventoAcesso.ACESSO_REVOGADO,
      sujeitoTipo: TipoSujeito.ADMIN,
      sujeitoId: autor.sub,
    });

    return {
      sessoesRevogadas,
      adminsAfetados: adminsResult.count,
      funcionariosAfetados: funcionariosResult.count,
      timestamp,
    };
  }

  /**
   * Retorna os logs de acesso de um periodo para auditoria do acesso externo.
   * Limitado a 1000 registros por consulta (use intervalos menores se necessario).
   */
  async consultarLogsAcesso(de: Date, ate: Date): Promise<RegistroLogAcesso[]> {
    return this.prisma.forTenant((tx) =>
      tx.logAcesso.findMany({
        where: { timestamp: { gte: de, lte: ate } },
        orderBy: { timestamp: 'asc' },
        take: 1000,
      }),
    );
  }

  /**
   * Retorna os logs de auditoria de mutacoes do periodo (quem alterou o que).
   * Util para identificar acoes realizadas durante o acesso externo.
   */
  async consultarLogsAuditoria(de: Date, ate: Date): Promise<unknown[]> {
    return this.prisma.forTenant((tx) =>
      tx.logAuditoria.findMany({
        where: { timestamp: { gte: de, lte: ate } },
        orderBy: { timestamp: 'asc' },
        take: 500,
      }),
    );
  }
}
