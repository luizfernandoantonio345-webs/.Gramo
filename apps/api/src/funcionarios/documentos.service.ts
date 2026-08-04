import { BadRequestException, Injectable } from '@nestjs/common';
import { StatusDocumento } from '@prisma/client';
import { DOCUMENTOS_EXIGIDOS, documentoVencido, rotuloDocumento } from '@repp/shared';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { EnviarDocumentoDto } from './dto/funcionario.dto';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MIMES_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png'];

@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Lista o status de cada documento exigido do funcionario (com efetivo VENCIDO). */
  async statusExigidos(funcionarioId: string) {
    const agora = new Date();
    const docs = await this.prisma.forTenant((tx) =>
      tx.documento.findMany({ where: { funcionarioId }, orderBy: { criadoEm: 'desc' } }),
    );
    return DOCUMENTOS_EXIGIDOS.map((tipo) => {
      const doc = docs.find((d) => d.tipo === tipo);
      const status = this.statusEfetivo(doc?.status ?? null, doc?.dataValidade ?? null, agora);
      return {
        tipo,
        rotulo: rotuloDocumento(tipo),
        documentoId: doc?.id ?? null,
        status: doc ? status : StatusDocumento.PENDENTE,
        motivoRejeicao: doc?.motivoRejeicao ?? null,
        dataValidade: doc?.dataValidade?.toISOString() ?? null,
      };
    });
  }

  /** Envio de documento (upload). Guarda o arquivo cifrado; status EM_ANALISE. */
  async enviar(funcionarioId: string, dto: EnviarDocumentoDto) {
    const bytes = this.tamanhoBytes(dto.arquivoBase64);
    if (bytes === 0) throw new BadRequestException('Arquivo vazio.');
    if (bytes > MAX_BYTES) throw new BadRequestException('Arquivo excede 10MB.');
    if (dto.mime && !MIMES_ACEITOS.includes(dto.mime)) {
      throw new BadRequestException('Formato invalido. Aceitos: PDF, JPG, PNG.');
    }

    const arquivoRef = await this.storage.salvarArquivo(dto.arquivoBase64, 'documento');
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const doc = await tx.documento.create({
        data: {
          empresaId,
          funcionarioId,
          tipo: dto.tipo,
          arquivoRef,
          nomeArquivo: dto.nomeArquivo,
          mime: dto.mime,
          status: StatusDocumento.EM_ANALISE,
          dataValidade: dto.dataValidade ? new Date(dto.dataValidade) : null,
        },
        select: { id: true, tipo: true, status: true },
      });
      // Trilha de auditoria: toda escrita de negocio deixa rastro (quem/quando/o
      // que). O ator do upload e o proprio funcionario.
      await tx.logAuditoria.create({
        data: {
          empresaId,
          usuarioId: funcionarioId,
          usuarioTipo: 'funcionario',
          acao: 'documento.enviar',
          entidadeAfetada: 'documentos',
          entidadeId: doc.id,
          valorNovo: { tipo: dto.tipo, nomeArquivo: dto.nomeArquivo ?? null },
        },
      });
      return doc;
    });
  }

  private statusEfetivo(
    status: StatusDocumento | null,
    dataValidade: Date | null,
    agora: Date,
  ): StatusDocumento {
    if (!status) return StatusDocumento.PENDENTE;
    if (status === StatusDocumento.APROVADO && documentoVencido(dataValidade, agora)) {
      return StatusDocumento.VENCIDO;
    }
    return status;
  }

  private tamanhoBytes(base64OuDataUrl: string): number {
    const base64 = base64OuDataUrl.includes(',')
      ? base64OuDataUrl.slice(base64OuDataUrl.indexOf(',') + 1)
      : base64OuDataUrl;
    const semPad = base64.replace(/=+$/, '');
    return Math.floor((semPad.length * 3) / 4);
  }
}
