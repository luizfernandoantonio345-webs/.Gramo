import { Injectable, NotFoundException } from '@nestjs/common';
import { normalizarCpf } from '@repp/shared';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { gerarTokenOpaco, hashToken } from '../common/crypto/tokens';
import { TenantContext } from '../common/tenant/tenant-context';
import { PontoService } from '../pontos/ponto.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CriarDispositivoDto, KioskPontoDto } from './dto/kiosk.dto';
import type { DispositivoKioskCtx } from './kiosk.guard';

/**
 * Quiosque (tablet fixo na portaria). Um dispositivo autenticado por token bate
 * ponto de qualquer funcionario DA SUA FILIAL por CPF. Reusa integralmente o
 * PontoService (NSR, hash, REGAP, imutabilidade, "nunca bloqueia").
 */
@Injectable()
export class KioskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ponto: PontoService,
  ) {}

  // ---- Admin (RH): gestao de dispositivos ----

  /** Cadastra um quiosque. O token e retornado UMA vez (depois so o hash fica). */
  async criar(dto: CriarDispositivoDto, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    const token = `kiosk_${gerarTokenOpaco()}`;
    const disp = await this.prisma.forTenant(async (tx) => {
      const filial = await tx.filial.findFirst({
        where: { id: dto.filialId },
        select: { id: true },
      });
      if (!filial) throw new NotFoundException('Filial nao encontrada.');
      const d = await tx.dispositivoKiosk.create({
        data: {
          empresaId,
          filialId: dto.filialId,
          nome: dto.nome,
          tokenHash: hashToken(token),
          criadoPorAdminId: autor.sub,
        },
        select: { id: true, nome: true, filialId: true },
      });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'kiosk.criar',
          entidadeAfetada: 'dispositivos_kiosk',
          entidadeId: d.id,
          valorNovo: { nome: dto.nome, filialId: dto.filialId },
        },
      });
      return d;
    });
    return { ...disp, token }; // token so agora -- guarde no tablet
  }

  async listar() {
    return this.prisma.forTenant((tx) =>
      tx.dispositivoKiosk.findMany({
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          nome: true,
          filialId: true,
          ativo: true,
          ultimoUsoEm: true,
          criadoEm: true,
        },
      }),
    );
  }

  async revogar(id: string, autor: UsuarioAutenticado) {
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const d = await tx.dispositivoKiosk.findFirst({ where: { id }, select: { id: true } });
      if (!d) throw new NotFoundException('Dispositivo nao encontrado.');
      await tx.dispositivoKiosk.update({ where: { id }, data: { ativo: false } });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'kiosk.revogar',
          entidadeAfetada: 'dispositivos_kiosk',
          entidadeId: id,
          valorNovo: { ativo: false },
        },
      });
      return { id, ativo: false };
    });
  }

  // ---- Quiosque: bater ponto por CPF ----

  async baterPonto(dispositivo: DispositivoKioskCtx, dto: KioskPontoDto) {
    const cpf = normalizarCpf(dto.cpf);
    const funcionario = await this.prisma.forTenant((tx) =>
      tx.funcionario.findFirst({
        where: { cpf, filialId: dispositivo.filialId },
        select: { id: true, nome: true, desativadoEm: true },
      }),
    );
    // Falha de identificacao NAO e bloqueio de ponto -- e CPF desconhecido nesta
    // unidade; devolvemos erro claro para o quiosque orientar a pessoa.
    if (!funcionario || funcionario.desativadoEm) {
      throw new NotFoundException('CPF nao encontrado nesta unidade. Procure o RH.');
    }

    const resumo = await this.ponto.registrar(funcionario.id, {
      uuidIdempotencia: dto.uuidIdempotencia,
      latitude: dto.latitude,
      longitude: dto.longitude,
      precisaoMetros: dto.precisaoMetros,
      fotoBase64: dto.fotoBase64,
      tipo: dto.tipo,
    });

    // Marca o uso do dispositivo (telemetria leve).
    await this.prisma.forTenant((tx) =>
      tx.dispositivoKiosk.update({
        where: { id: dispositivo.id },
        data: { ultimoUsoEm: new Date() },
      }),
    );

    return { funcionario: funcionario.nome, ...resumo };
  }
}
