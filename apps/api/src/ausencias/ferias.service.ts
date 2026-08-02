import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StatusAusencia } from '@prisma/client';
import { periodoValido } from '@repp/shared';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { EscopoFilialService } from '../common/authz/escopo-filial.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import type { DecidirFeriasDto, SolicitarFeriasDto } from './dto/ausencias.dto';

/** ADM 10 -- Ferias e Afastamentos. */
@Injectable()
export class FeriasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escopo: EscopoFilialService,
  ) {}

  // ---- Funcionario ----

  async solicitar(funcionarioId: string, dto: SolicitarFeriasDto) {
    if (!periodoValido(dto.dataInicio, dto.dataFim)) {
      throw new BadRequestException('Periodo invalido (inicio deve ser <= fim).');
    }
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant((tx) =>
      tx.feriasAfastamento.create({
        data: {
          empresaId,
          funcionarioId,
          tipo: dto.tipo,
          dataInicio: new Date(dto.dataInicio),
          dataFim: new Date(dto.dataFim),
          motivo: dto.motivo,
          status: StatusAusencia.PENDENTE,
        },
        select: { id: true, status: true },
      }),
    );
  }

  async minhas(funcionarioId: string) {
    return this.prisma.forTenant((tx) =>
      tx.feriasAfastamento.findMany({
        where: { funcionarioId },
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          tipo: true,
          dataInicio: true,
          dataFim: true,
          status: true,
          motivoResposta: true,
        },
      }),
    );
  }

  // ---- Admin (ADM 10) ----

  async listar(autor: UsuarioAutenticado, status?: StatusAusencia) {
    const f = await this.escopo.escopoFilialId(autor);
    const funcFiltro = f.filialId ? { funcionario: { is: { filialId: f.filialId } } } : {};
    return this.prisma.forTenant((tx) =>
      tx.feriasAfastamento.findMany({
        where: { ...funcFiltro, status },
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          tipo: true,
          dataInicio: true,
          dataFim: true,
          status: true,
          motivo: true,
          funcionario: { select: { id: true, nome: true, filialId: true } },
        },
      }),
    );
  }

  async decidir(id: string, dto: DecidirFeriasDto, aprovador: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    const filiais = await this.escopo.filiaisPermitidas(aprovador);
    return this.prisma.forTenant(async (tx) => {
      const sol = await tx.feriasAfastamento.findFirst({
        where: { id },
        include: { funcionario: { select: { filialId: true } } },
      });
      if (!sol) throw new NotFoundException('Solicitacao nao encontrada.');
      if (filiais !== null && (!sol.funcionario.filialId || !filiais.includes(sol.funcionario.filialId))) {
        throw new NotFoundException('Solicitacao fora do seu escopo de filial.');
      }
      if (sol.status !== StatusAusencia.PENDENTE) {
        throw new BadRequestException('Solicitacao ja decidida.');
      }
      const status = dto.aprovar ? StatusAusencia.APROVADA : StatusAusencia.RECUSADA;
      const atualizada = await tx.feriasAfastamento.update({
        where: { id },
        data: {
          status,
          aprovadorId: aprovador.sub,
          motivoResposta: dto.motivoResposta,
          dataResposta: new Date(),
        },
        select: { id: true, status: true },
      });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: aprovador.sub,
          usuarioTipo: 'admin',
          acao: 'ausencia.decidir',
          entidadeAfetada: 'ferias_afastamentos',
          entidadeId: id,
          valorNovo: { status },
        },
      });
      return atualizada;
    });
  }

  /** Calendario de ausencias aprovadas que se sobrepoem ao periodo. */
  async calendario(deIso: string, ateIso: string, autor: UsuarioAutenticado) {
    const f = await this.escopo.escopoFilialId(autor);
    const funcFiltro = f.filialId ? { funcionario: { is: { filialId: f.filialId } } } : {};
    return this.prisma.forTenant((tx) =>
      tx.feriasAfastamento.findMany({
        where: {
          ...funcFiltro,
          status: StatusAusencia.APROVADA,
          dataInicio: { lte: new Date(ateIso.slice(0, 10)) },
          dataFim: { gte: new Date(deIso.slice(0, 10)) },
        },
        orderBy: { dataInicio: 'asc' },
        select: {
          id: true,
          tipo: true,
          dataInicio: true,
          dataFim: true,
          funcionario: { select: { nome: true } },
        },
      }),
    );
  }
}
