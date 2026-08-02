import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StatusContestacao } from '@prisma/client';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { EscopoFilialService } from '../common/authz/escopo-filial.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import type { AbrirContestacaoDto, ResponderContestacaoDto } from './dto/ausencias.dto';

/** ADM 11 -- Central de Contestacao de Ponto. */
@Injectable()
export class ContestacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escopo: EscopoFilialService,
  ) {}

  // ---- Funcionario ----

  /** Abre contestacao de uma marcacao PROPRIA (anti-IDOR: valida a posse). */
  async abrir(funcionarioId: string, dto: AbrirContestacaoDto) {
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const ponto = await tx.ponto.findFirst({
        where: { id: dto.pontoId, funcionarioId },
        select: { id: true },
      });
      if (!ponto) throw new NotFoundException('Marcacao nao encontrada.');
      return tx.contestacaoPonto.create({
        data: {
          empresaId,
          funcionarioId,
          pontoId: dto.pontoId,
          motivo: dto.motivo,
          status: StatusContestacao.ABERTA,
        },
        select: { id: true, status: true },
      });
    });
  }

  async minhas(funcionarioId: string) {
    return this.prisma.forTenant((tx) =>
      tx.contestacaoPonto.findMany({
        where: { funcionarioId },
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          motivo: true,
          status: true,
          resposta: true,
          criadoEm: true,
          ponto: { select: { nsr: true, tipo: true, registradoEm: true } },
        },
      }),
    );
  }

  // ---- Admin (ADM 11) ----

  async listar(autor: UsuarioAutenticado, status?: StatusContestacao) {
    const f = await this.escopo.escopoFilialId(autor);
    const funcFiltro = f.filialId ? { funcionario: { is: { filialId: f.filialId } } } : {};
    return this.prisma.forTenant((tx) =>
      tx.contestacaoPonto.findMany({
        where: { ...funcFiltro, status },
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          motivo: true,
          status: true,
          resposta: true,
          criadoEm: true,
          funcionario: { select: { nome: true, cpf: true, filialId: true } },
          ponto: { select: { nsr: true, tipo: true, registradoEm: true } },
        },
      }),
    );
  }

  /** Resposta do RH (obrigatoria). Fica vinculada ao log de auditoria (ADM 11). */
  async responder(id: string, dto: ResponderContestacaoDto, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    const filiais = await this.escopo.filiaisPermitidas(autor);
    return this.prisma.forTenant(async (tx) => {
      const c = await tx.contestacaoPonto.findFirst({
        where: { id },
        include: { funcionario: { select: { filialId: true } } },
      });
      if (!c) throw new NotFoundException('Contestacao nao encontrada.');
      if (filiais !== null && (!c.funcionario.filialId || !filiais.includes(c.funcionario.filialId))) {
        throw new NotFoundException('Contestacao fora do seu escopo de filial.');
      }
      if (c.status !== StatusContestacao.ABERTA) {
        throw new BadRequestException('Contestacao ja respondida.');
      }
      const atualizada = await tx.contestacaoPonto.update({
        where: { id },
        data: {
          status: StatusContestacao.RESPONDIDA,
          resposta: dto.resposta,
          respondidoPorId: autor.sub,
          dataResposta: new Date(),
        },
        select: { id: true, status: true },
      });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'contestacao.responder',
          entidadeAfetada: 'contestacoes_ponto',
          entidadeId: id,
          valorNovo: { resposta: dto.resposta },
        },
      });
      return atualizada;
    });
  }
}
