import { createHash } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { TipoExportacao } from '@prisma/client';
import { SignatureService } from '../assinaturas/signature.service';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AejService } from './aej.service';
import { AfdService } from './afd.service';

@Injectable()
export class ExportacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly signature: SignatureService,
    private readonly afd: AfdService,
    private readonly aej: AejService,
  ) {}

  /** Gera AFD ou AEJ do periodo, cifra, calcula hash, assina e registra (imutavel). */
  async exportar(
    tipo: TipoExportacao,
    inicio: Date,
    fim: Date,
    autor: UsuarioAutenticado,
    filialId?: string,
  ) {
    const { conteudo, total } =
      tipo === TipoExportacao.AFD
        ? await this.afd.gerar(inicio, fim, filialId)
        : await this.aej.gerar(inicio, fim, filialId);

    const bytes = Buffer.from(conteudo, 'utf8');
    const hashArquivo = createHash('sha256').update(bytes).digest('hex');
    const assinaturaServidor = this.signature.assinar(hashArquivo);
    const arquivoRef = await this.storage.salvarArquivo(bytes.toString('base64'), 'exportacao');

    const empresaId = TenantContext.requireEmpresaId();
    const periodoReferencia = `${this.dataIso(inicio)}_${this.dataIso(fim)}`;

    const registro = await this.prisma.forTenant(async (tx) => {
      const exp = await tx.exportacaoAfdAej.create({
        data: {
          empresaId,
          tipoArquivo: tipo,
          periodoReferencia,
          dataInicial: inicio,
          dataFinal: fim,
          arquivoRef,
          hashArquivo,
          assinaturaServidor,
          chaveServidorId: this.signature.chaveId,
          totalRegistros: total,
          geradoPorAdminId: autor.sub,
        },
        select: { id: true, criadoEm: true },
      });
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: autor.sub,
          usuarioTipo: 'admin',
          acao: 'exportacao.gerar',
          entidadeAfetada: 'exportacoes_afd_aej',
          entidadeId: exp.id,
          valorNovo: { tipo, periodoReferencia, hashArquivo, total },
        },
      });
      return exp;
    });

    return {
      id: registro.id,
      tipo,
      periodoReferencia,
      totalRegistros: total,
      hashArquivo,
      assinaturaServidor,
      chaveServidorId: this.signature.chaveId,
      criadoEm: registro.criadoEm.toISOString(),
    };
  }

  async listar() {
    return this.prisma.forTenant((tx) =>
      tx.exportacaoAfdAej.findMany({
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          tipoArquivo: true,
          periodoReferencia: true,
          totalRegistros: true,
          hashArquivo: true,
          criadoEm: true,
        },
      }),
    );
  }

  /** Baixa uma exportacao (decifra) e confere a integridade (re-hash). */
  async download(id: string) {
    const reg = await this.prisma.forTenant((tx) =>
      tx.exportacaoAfdAej.findFirst({ where: { id } }),
    );
    if (!reg) throw new NotFoundException('Exportacao nao encontrada.');
    const bytes = await this.storage.lerImagem(reg.arquivoRef);
    const hashConfere = createHash('sha256').update(bytes).digest('hex') === reg.hashArquivo;
    return {
      tipo: reg.tipoArquivo,
      periodoReferencia: reg.periodoReferencia,
      hashArquivo: reg.hashArquivo,
      assinaturaValida: this.signature.verificar(reg.hashArquivo, reg.assinaturaServidor),
      integridadeOk: hashConfere,
      conteudoBase64: bytes.toString('base64'),
    };
  }

  private dataIso(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
