import { Injectable } from '@nestjs/common';
import { PublicoComunicado } from '@prisma/client';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CriarComunicadoDto } from './dto/comunicados.dto';

/** ADM 8 -- Comunicados e Notificacoes. */
@Injectable()
export class ComunicadosService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Admin ----

  async criar(dto: CriarComunicadoDto, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const c = await tx.comunicado.create({
        data: {
          empresaId,
          titulo: dto.titulo,
          mensagem: dto.mensagem,
          publicoTipo: dto.publicoTipo,
          publicoValor: dto.publicoValor,
          criadoPorAdminId: autor.sub,
        },
        select: { id: true },
      });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'comunicado.criar',
          entidadeAfetada: 'comunicados',
          entidadeId: c.id,
          valorNovo: { titulo: dto.titulo, publicoTipo: dto.publicoTipo },
        },
      });
      return c;
    });
  }

  /** Historico com taxa de visualizacao (numero de leituras por comunicado). */
  async historico() {
    return this.prisma.forTenant((tx) =>
      tx.comunicado.findMany({
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          titulo: true,
          publicoTipo: true,
          publicoValor: true,
          criadoEm: true,
          _count: { select: { leituras: true } },
        },
      }),
    );
  }

  // ---- Funcionario ----

  /** Comunicados destinados ao funcionario (por publico-alvo), com flag de lido. */
  async paraFuncionario(funcionarioId: string) {
    return this.prisma.forTenant(async (tx) => {
      const func = await tx.funcionario.findUniqueOrThrow({
        where: { id: funcionarioId },
        select: { filialId: true, cargo: true },
      });
      const comunicados = await tx.comunicado.findMany({
        where: {
          OR: [
            { publicoTipo: PublicoComunicado.TODOS },
            { publicoTipo: PublicoComunicado.FILIAL, publicoValor: func.filialId ?? '__none__' },
            { publicoTipo: PublicoComunicado.CARGO, publicoValor: func.cargo ?? '__none__' },
            { publicoTipo: PublicoComunicado.FUNCIONARIO, publicoValor: funcionarioId },
          ],
        },
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          titulo: true,
          mensagem: true,
          criadoEm: true,
          leituras: { where: { funcionarioId }, select: { id: true } },
        },
      });
      return comunicados.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        mensagem: c.mensagem,
        criadoEm: c.criadoEm.toISOString(),
        lido: c.leituras.length > 0,
      }));
    });
  }

  async marcarLido(funcionarioId: string, comunicadoId: string) {
    const empresaId = TenantContext.requireEmpresaId();
    await this.prisma.forTenant((tx) =>
      tx.comunicadoLeitura.upsert({
        where: { comunicadoId_funcionarioId: { comunicadoId, funcionarioId } },
        create: { empresaId, comunicadoId, funcionarioId },
        update: {},
      }),
    );
    return { ok: true };
  }
}
