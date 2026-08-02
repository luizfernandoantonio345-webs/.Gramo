import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StatusEmpresa, StatusFatura } from '@prisma/client';
import { PrismaSuperService } from './prisma-super.service';
import { SuperAuthService } from './super-auth.service';
import type { CriarEmpresaDto, CriarPlanoDto, GerarFaturaDto } from './dto/plataforma.dto';

interface Ctx {
  ip?: string;
  userAgent?: string;
}

/** ADM 0 -- gestao da plataforma (empresas, uso, planos, faturamento). */
@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaSuperService,
    private readonly auth: SuperAuthService,
  ) {}

  // ---- Empresas ----

  async listarEmpresas() {
    return this.prisma.empresa.findMany({
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        razaoSocial: true,
        cnpj: true,
        subdominio: true,
        status: true,
        dataAtivacao: true,
        planoRef: { select: { nome: true } },
      },
    });
  }

  async criarEmpresa(dto: CriarEmpresaDto, superAdminId: string, ctx: Ctx) {
    const dupl = await this.prisma.empresa.findFirst({
      where: { OR: [{ cnpj: dto.cnpj }, { subdominio: dto.subdominio }] },
      select: { id: true },
    });
    if (dupl) throw new ConflictException('CNPJ ou subdominio ja cadastrado.');
    const empresa = await this.prisma.empresa.create({
      data: {
        razaoSocial: dto.razaoSocial,
        cnpj: dto.cnpj,
        subdominio: dto.subdominio.toLowerCase(),
        planoId: dto.planoId,
        status: StatusEmpresa.ATIVA,
      },
      select: { id: true, razaoSocial: true, subdominio: true, status: true },
    });
    await this.auth.log(superAdminId, 'empresa.criar', 'empresas', empresa.id, ctx, {
      razaoSocial: dto.razaoSocial,
      subdominio: dto.subdominio,
    });
    return empresa;
  }

  /** Suspensao NUNCA apaga dados (soft, reversivel). */
  async alterarStatus(id: string, status: StatusEmpresa, superAdminId: string, ctx: Ctx) {
    const emp = await this.prisma.empresa.findFirst({ where: { id }, select: { status: true } });
    if (!emp) throw new NotFoundException('Empresa nao encontrada.');
    await this.prisma.empresa.update({ where: { id }, data: { status } });
    await this.auth.log(superAdminId, 'empresa.status', 'empresas', id, ctx, {
      de: emp.status,
      para: status,
    });
    return { id, status };
  }

  /** Metadados de uso (agregados via SECURITY DEFINER; NUNCA le dados operacionais). */
  async uso(empresaId: string) {
    const emp = await this.prisma.empresa.findFirst({ where: { id: empresaId }, select: { id: true } });
    if (!emp) throw new NotFoundException('Empresa nao encontrada.');
    return this.prisma.metricasUso(empresaId);
  }

  // ---- Planos ----

  async listarPlanos() {
    return this.prisma.plano.findMany({ orderBy: { precoMensalCentavos: 'asc' } });
  }

  async criarPlano(dto: CriarPlanoDto, superAdminId: string, ctx: Ctx) {
    const plano = await this.prisma.plano.create({
      data: {
        nome: dto.nome,
        precoMensalCentavos: dto.precoMensalCentavos,
        limiteFuncionarios: dto.limiteFuncionarios,
        limiteArmazenamentoMb: dto.limiteArmazenamentoMb,
      },
    });
    await this.auth.log(superAdminId, 'plano.criar', 'planos', plano.id, ctx, { nome: dto.nome });
    return plano;
  }

  // ---- Faturamento ----

  async gerarFatura(dto: GerarFaturaDto, superAdminId: string, ctx: Ctx) {
    // A cobranca no gateway externo e infra (fora do escopo): guardamos a fatura
    // e o gatewayRef quando integrado. Aqui criamos a fatura PENDENTE.
    const fatura = await this.prisma.fatura.create({
      data: {
        empresaId: dto.empresaId,
        competencia: dto.competencia,
        valorCentavos: dto.valorCentavos,
        vencimento: new Date(dto.vencimento),
        status: StatusFatura.PENDENTE,
      },
      select: { id: true, competencia: true, valorCentavos: true, status: true },
    });
    await this.auth.log(superAdminId, 'fatura.gerar', 'faturas', fatura.id, ctx, {
      empresaId: dto.empresaId,
      competencia: dto.competencia,
    });
    return fatura;
  }

  async listarFaturas(empresaId?: string) {
    return this.prisma.fatura.findMany({
      where: { empresaId },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        empresaId: true,
        competencia: true,
        valorCentavos: true,
        status: true,
        vencimento: true,
        pagoEm: true,
      },
    });
  }

  async marcarFaturaPaga(id: string, superAdminId: string, ctx: Ctx) {
    const f = await this.prisma.fatura.findFirst({ where: { id }, select: { status: true } });
    if (!f) throw new NotFoundException('Fatura nao encontrada.');
    await this.prisma.fatura.update({
      where: { id },
      data: { status: StatusFatura.PAGA, pagoEm: new Date() },
    });
    await this.auth.log(superAdminId, 'fatura.pagar', 'faturas', id, ctx, { status: StatusFatura.PAGA });
    return { id, status: StatusFatura.PAGA };
  }
}
