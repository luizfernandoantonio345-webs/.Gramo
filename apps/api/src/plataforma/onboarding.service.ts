import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PapelAdmin, StatusEmpresa } from '@prisma/client';
import { validarSenha } from '@repp/shared';
import { hashSenha } from '../common/crypto/password';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaSuperService } from './prisma-super.service';
import type { OnboardingDto } from './dto/onboarding.dto';

/**
 * Onboarding self-service: cria uma nova empresa (tenant) + filial matriz +
 * admin RH_MASTER, sem intervencao manual. A empresa e criada pela role
 * `repp_super` (unica que insere em `empresas`); a filial e o admin sao criados
 * ja no escopo do novo tenant (forEmpresa -> RLS aplicado a empresa recem-criada).
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaSuper: PrismaSuperService,
  ) {}

  async cadastrar(dto: OnboardingDto) {
    const politica = validarSenha(dto.adminSenha);
    if (!politica.valido) throw new BadRequestException(politica.erros.join(' '));

    const subdominio = dto.subdominio.toLowerCase();
    const dup = await this.prismaSuper.empresa.findFirst({
      where: { OR: [{ cnpj: dto.cnpj }, { subdominio }] },
      select: { id: true },
    });
    if (dup) throw new ConflictException('CNPJ ou subdominio ja cadastrado.');

    // 1) Empresa (repp_super e a unica role que insere em `empresas`).
    const empresa = await this.prismaSuper.empresa.create({
      data: {
        razaoSocial: dto.razaoSocial,
        cnpj: dto.cnpj,
        subdominio,
        status: StatusEmpresa.ATIVA,
      },
      select: { id: true, subdominio: true },
    });

    // 2) Matriz + admin RH_MASTER, ja no escopo (RLS) do novo tenant.
    const senhaHash = await hashSenha(dto.adminSenha);
    const criado = await this.prisma.forEmpresa(empresa.id, async (tx) => {
      const filial = await tx.filial.create({
        data: { empresaId: empresa.id, nome: 'Matriz' },
        select: { id: true },
      });
      const admin = await tx.usuarioAdmin.create({
        data: {
          empresaId: empresa.id,
          nome: dto.adminNome,
          email: dto.adminEmail.toLowerCase(),
          senhaHash,
          papel: PapelAdmin.RH_MASTER,
        },
        select: { id: true },
      });
      await tx.logAuditoria.create({
        data: {
          empresaId: empresa.id,
          usuarioId: admin.id,
          usuarioTipo: 'admin',
          acao: 'empresa.onboarding',
          entidadeAfetada: 'empresas',
          entidadeId: empresa.id,
          valorNovo: { subdominio, razaoSocial: dto.razaoSocial },
        },
      });
      return { filialId: filial.id, adminId: admin.id };
    });

    return {
      empresaId: empresa.id,
      subdominio: empresa.subdominio,
      filialId: criado.filialId,
      adminEmail: dto.adminEmail.toLowerCase(),
      proximoPasso: 'Faca login como administrador e configure o 2FA no primeiro acesso.',
    };
  }
}
