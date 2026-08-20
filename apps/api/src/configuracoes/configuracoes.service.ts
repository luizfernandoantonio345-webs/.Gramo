import { Injectable, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AtualizarEmpresaDto,
  AtualizarJornadaDto,
  CriarFeriadoDto,
  CriarFilialDto,
  CriarJornadaDto,
} from './dto/configuracoes.dto';

/** ADM 7 -- Configuracoes da Empresa: filiais, jornadas padrao e feriados. */
@Injectable()
export class ConfiguracoesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Filiais (estabelecimentos: cada uma tem seu contador de NSR) ----

  async listarFiliais() {
    return this.prisma.forTenant((tx) =>
      tx.filial.findMany({
        orderBy: { nome: 'asc' },
        select: { id: true, nome: true, cnpj: true, timezone: true, criadoEm: true },
      }),
    );
  }

  async criarFilial(dto: CriarFilialDto, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const f = await tx.filial.create({
        data: {
          empresaId,
          nome: dto.nome,
          cnpj: dto.cnpj ?? null,
          timezone: dto.timezone ?? 'America/Sao_Paulo',
        },
        select: { id: true, nome: true, cnpj: true, timezone: true, criadoEm: true },
      });
      await this.audit(tx, empresaId, autor, 'filial.criar', 'filiais', f.id, { nome: dto.nome });
      return f;
    });
  }

  // ---- Jornadas ----

  async listarJornadas() {
    return this.prisma.forTenant((tx) => tx.jornada.findMany({ orderBy: { nome: 'asc' } }));
  }

  async criarJornada(dto: CriarJornadaDto, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const j = await tx.jornada.create({
        data: {
          empresaId,
          nome: dto.nome,
          horaEntrada: dto.horaEntrada,
          horaSaida: dto.horaSaida,
          toleranciaMinutos: dto.toleranciaMinutos ?? 10,
          diasSemana: dto.diasSemana,
          cargaDiariaMinutos: dto.cargaDiariaMinutos,
          regimeHoras: dto.regimeHoras,
          limiteExtraDiariaMin: dto.limiteExtraDiariaMin,
        },
      });
      await this.audit(tx, empresaId, autor, 'jornada.criar', 'jornadas', j.id, { nome: dto.nome });
      return j;
    });
  }

  async atualizarJornada(id: string, dto: AtualizarJornadaDto, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const atual = await tx.jornada.findFirst({ where: { id } });
      if (!atual) throw new NotFoundException('Jornada nao encontrada.');
      const j = await tx.jornada.update({ where: { id }, data: { ...dto } });
      await this.audit(tx, empresaId, autor, 'jornada.atualizar', 'jornadas', id, { ...dto });
      return j;
    });
  }

  // ---- Feriados ----

  async listarFeriados() {
    return this.prisma.forTenant((tx) => tx.feriado.findMany({ orderBy: { data: 'asc' } }));
  }

  async criarFeriado(dto: CriarFeriadoDto, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const f = await tx.feriado.create({
        data: {
          empresaId,
          filialId: dto.filialId,
          data: new Date(dto.data.slice(0, 10)),
          nome: dto.nome,
          tipo: dto.tipo,
        },
      });
      await this.audit(tx, empresaId, autor, 'feriado.criar', 'feriados', f.id, {
        data: dto.data.slice(0, 10),
        nome: dto.nome,
      });
      return f;
    });
  }

  async removerFeriado(id: string, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const f = await tx.feriado.findFirst({ where: { id } });
      if (!f) throw new NotFoundException('Feriado nao encontrado.');
      await tx.feriado.delete({ where: { id } });
      await this.audit(tx, empresaId, autor, 'feriado.remover', 'feriados', id, {
        nome: f.nome,
      });
      return { id };
    });
  }

  // ---- Dados da empresa ----

  async dadosEmpresa() {
    return this.prisma.forTenant((tx) =>
      tx.empresa.findFirstOrThrow({
        select: {
          id: true,
          razaoSocial: true,
          cnpj: true,
          subdominio: true,
          status: true,
          numeroInpi: true,
        },
      }),
    );
  }

  async atualizarEmpresa(dto: AtualizarEmpresaDto, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const empresa = await tx.empresa.update({
        where: { id: empresaId },
        data: { numeroInpi: dto.numeroInpi ?? null },
        select: {
          id: true,
          razaoSocial: true,
          cnpj: true,
          subdominio: true,
          status: true,
          numeroInpi: true,
        },
      });
      await this.audit(tx, empresaId, autor, 'empresa.atualizar', 'empresas', empresaId, {
        numeroInpi: dto.numeroInpi,
      });
      return empresa;
    });
  }

  private async audit(
    tx: Parameters<Parameters<PrismaService['forTenant']>[0]>[0],
    empresaId: string,
    autor: UsuarioAutenticado,
    acao: string,
    entidade: string,
    entidadeId: string,
    valorNovo: unknown,
  ) {
    await tx.logAuditoria.create({
      data: {
        empresaId,
        usuarioId: autor.sub,
        usuarioTipo: 'admin',
        acao,
        entidadeAfetada: entidade,
        entidadeId,
        valorNovo: valorNovo as object,
      },
    });
  }
}
