import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TipoIntegracao } from '@prisma/client';
import { gerarTokenOpaco, hashToken } from '../common/crypto/tokens';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import type { AtualizarIntegracaoDto, GerarChaveDto } from './dto/integracoes.dto';

/**
 * ADM 9 -- Integracoes. Gerencia chaves de API (token guardado so como hash) e a
 * configuracao das integracoes (folha/eSocial). A TRANSMISSAO em si (envio ao
 * eSocial/gateway de folha) e infra externa -- aqui ficam credenciais e estado.
 */
@Injectable()
export class IntegracoesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Chaves de API ----

  /** Gera uma chave. O token e retornado UMA vez (depois so o hash fica guardado). */
  async gerarChave(dto: GerarChaveDto, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    const token = `repp_${gerarTokenOpaco()}`;
    const chave = await this.prisma.forTenant(async (tx) => {
      const c = await tx.chaveApi.create({
        data: {
          empresaId,
          nome: dto.nome,
          prefixo: token.slice(0, 12),
          tokenHash: hashToken(token),
          escopo: dto.escopo ?? 'leitura',
          criadoPorAdminId: autor.sub,
        },
        select: { id: true, prefixo: true, escopo: true },
      });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'chave_api.gerar',
          entidadeAfetada: 'chaves_api',
          entidadeId: c.id,
          valorNovo: { nome: dto.nome, escopo: c.escopo },
        },
      });
      return c;
    });
    return { ...chave, token }; // token so agora
  }

  async listarChaves() {
    return this.prisma.forTenant((tx) =>
      tx.chaveApi.findMany({
        orderBy: { criadoEm: 'desc' },
        select: { id: true, nome: true, prefixo: true, escopo: true, revogadaEm: true, criadoEm: true },
      }),
    );
  }

  async revogarChave(id: string, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const c = await tx.chaveApi.findFirst({ where: { id } });
      if (!c) throw new NotFoundException('Chave nao encontrada.');
      await tx.chaveApi.update({ where: { id }, data: { revogadaEm: new Date() } });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'chave_api.revogar',
          entidadeAfetada: 'chaves_api',
          entidadeId: id,
          valorNovo: { revogada: true },
        },
      });
      return { id, revogada: true };
    });
  }

  // ---- Configuracao de integracoes ----

  async listarConfig() {
    return this.prisma.forTenant((tx) =>
      tx.integracaoConfig.findMany({
        select: { id: true, tipo: true, ativo: true, atualizadoEm: true },
      }),
    );
  }

  async atualizarConfig(tipo: TipoIntegracao, dto: AtualizarIntegracaoDto, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const config = (dto.config ?? undefined) as Prisma.InputJsonValue | undefined;
      const cfg = await tx.integracaoConfig.upsert({
        where: { empresaId_tipo: { empresaId, tipo } },
        create: { empresaId, tipo, ativo: dto.ativo, config },
        update: { ativo: dto.ativo, config },
        select: { id: true, tipo: true, ativo: true },
      });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'integracao.configurar',
          entidadeAfetada: 'integracoes_config',
          entidadeId: cfg.id,
          valorNovo: { tipo, ativo: dto.ativo },
        },
      });
      return cfg;
    });
  }
}
