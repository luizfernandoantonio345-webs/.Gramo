import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { MetodoAssinatura, StatusAssinatura } from '@prisma/client';
import { montarManifestoAssinatura } from '@repp/shared';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { verificarSenha } from '../common/crypto/password';
import { TenantContext } from '../common/tenant/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type {
  EnviarAssinaturaDto,
  FilaAssinaturaQuery,
} from './dto/assinatura.dto';
import { SignatureService } from './signature.service';

interface Ctx {
  ip?: string;
  userAgent?: string;
}

const MAX_BYTES = 15 * 1024 * 1024; // 15MB (holerite/comunicado)
const MIMES_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png'];

@Injectable()
export class AssinaturaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly signature: SignatureService,
  ) {}

  // =================== ADM 3 (RH) ===================

  async enviar(dto: EnviarAssinaturaDto, autor: UsuarioAutenticado) {
    const bytes = this.decodificar(dto.arquivoBase64);
    if (bytes.length === 0) throw new BadRequestException('Arquivo vazio.');
    if (bytes.length > MAX_BYTES) throw new BadRequestException('Arquivo excede 15MB.');
    if (dto.mime && !MIMES_ACEITOS.includes(dto.mime)) {
      throw new BadRequestException('Formato invalido. Aceitos: PDF, JPG, PNG.');
    }
    const empresaId = TenantContext.requireEmpresaId();

    const existeFunc = await this.prisma.forTenant((tx) =>
      tx.funcionario.findFirst({ where: { id: dto.funcionarioId }, select: { id: true } }),
    );
    if (!existeFunc) throw new NotFoundException('Funcionario nao encontrado.');

    const hashDocumento = this.signature.hashDocumento(bytes);
    const arquivoRef = await this.storage.salvarArquivo(dto.arquivoBase64, 'assinatura');

    return this.prisma.forTenant(async (tx) => {
      const doc = await tx.documentoAssinatura.create({
        data: {
          empresaId,
          funcionarioId: dto.funcionarioId,
          tipo: dto.tipo,
          titulo: dto.titulo,
          competencia: dto.competencia,
          arquivoRef,
          hashDocumento,
          mime: dto.mime,
          tamanhoBytes: bytes.length,
          permiteDownloadAntesAssinatura: dto.permiteDownloadAntesAssinatura ?? false,
          enviadoPorAdminId: autor.sub,
          status: StatusAssinatura.ENVIADO,
        },
        select: { id: true, status: true, hashDocumento: true },
      });
      await this.audit(tx, empresaId, autor.sub, 'assinatura.enviar', doc.id, {
        funcionarioId: dto.funcionarioId,
        tipo: dto.tipo,
        titulo: dto.titulo,
      });
      return doc;
    });
  }

  async enviarLote(itens: EnviarAssinaturaDto[], autor: UsuarioAutenticado) {
    const resultados: Array<{ funcionarioId: string; titulo: string; ok: boolean; erro?: string }> = [];
    for (const item of itens) {
      try {
        await this.enviar(item, autor);
        resultados.push({ funcionarioId: item.funcionarioId, titulo: item.titulo, ok: true });
      } catch (e) {
        resultados.push({
          funcionarioId: item.funcionarioId,
          titulo: item.titulo,
          ok: false,
          erro: e instanceof Error ? e.message : 'erro',
        });
      }
    }
    return { total: itens.length, enviados: resultados.filter((r) => r.ok).length, resultados };
  }

  async fila(q: FilaAssinaturaQuery) {
    return this.prisma.forTenant((tx) =>
      tx.documentoAssinatura.findMany({
        where: { status: q.status, competencia: q.competencia, funcionarioId: q.funcionarioId },
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          tipo: true,
          titulo: true,
          competencia: true,
          status: true,
          criadoEm: true,
          visualizadoEm: true,
          funcionario: { select: { id: true, nome: true, cpf: true } },
        },
      }),
    );
  }

  /** Detalhe da assinatura (ADM 3): hash, timestamp, IP/dispositivo. */
  async detalhe(id: string) {
    const doc = await this.prisma.forTenant((tx) =>
      tx.documentoAssinatura.findFirst({
        where: { id },
        include: { assinatura: true, funcionario: { select: { nome: true, cpf: true } } },
      }),
    );
    if (!doc) throw new NotFoundException('Documento nao encontrado.');
    return doc;
  }

  // =================== Tela 2 (Funcionario) ===================

  async listar(funcionarioId: string) {
    return this.prisma.forTenant((tx) =>
      tx.documentoAssinatura.findMany({
        where: { funcionarioId },
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          tipo: true,
          titulo: true,
          competencia: true,
          status: true,
          criadoEm: true,
          permiteDownloadAntesAssinatura: true,
        },
      }),
    );
  }

  /** Visualiza o documento (marca VISUALIZADO). Retorna o conteudo para leitura. */
  async visualizar(funcionarioId: string, id: string) {
    const doc = await this.prisma.forTenant(async (tx) => {
      const d = await tx.documentoAssinatura.findFirst({ where: { id, funcionarioId } });
      if (!d) throw new NotFoundException('Documento nao encontrado.');
      if (d.status === StatusAssinatura.ENVIADO) {
        await tx.documentoAssinatura.update({
          where: { id },
          data: { status: StatusAssinatura.VISUALIZADO, visualizadoEm: new Date() },
        });
      }
      return d;
    });
    const bytes = await this.storage.lerImagem(doc.arquivoRef); // decifra
    const podeBaixar = doc.permiteDownloadAntesAssinatura || doc.status === StatusAssinatura.ASSINADO;
    return {
      id: doc.id,
      titulo: doc.titulo,
      mime: doc.mime,
      podeBaixar,
      conteudoBase64: bytes.toString('base64'),
    };
  }

  /**
   * Assina o documento. Re-autentica o funcionario (prova de intencao/identidade),
   * grava o registro IMUTAVEL com hash + timestamp + assinatura Ed25519 do
   * servidor. Irreversivel (unico por documento).
   */
  async assinar(
    funcionarioId: string,
    id: string,
    senha: string,
    metodo: MetodoAssinatura,
    ctx: Ctx,
  ) {
    const empresaId = TenantContext.requireEmpresaId();
    const { doc, cpf, senhaHash } = await this.prisma.forTenant(async (tx) => {
      const d = await tx.documentoAssinatura.findFirst({ where: { id, funcionarioId } });
      if (!d) throw new NotFoundException('Documento nao encontrado.');
      const f = await tx.funcionario.findUniqueOrThrow({
        where: { id: funcionarioId },
        select: { cpf: true, senhaHash: true },
      });
      return { doc: d, cpf: f.cpf, senhaHash: f.senhaHash };
    });

    if (doc.status === StatusAssinatura.ASSINADO) {
      throw new ConflictException('Documento ja assinado.');
    }
    if (doc.status === StatusAssinatura.RECUSADO) {
      throw new ConflictException('Documento recusado nao pode ser assinado.');
    }
    if (!senhaHash || !(await verificarSenha(senhaHash, senha))) {
      throw new UnauthorizedException('Senha incorreta. A assinatura exige confirmacao.');
    }

    const timestamp = new Date();
    const manifesto = montarManifestoAssinatura({
      empresaId,
      documentoId: doc.id,
      funcionarioId,
      cpf,
      tipo: doc.tipo,
      titulo: doc.titulo,
      competencia: doc.competencia,
      hashDocumento: doc.hashDocumento,
      metodo,
      timestamp: timestamp.toISOString(),
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    });
    const hashAssinatura = createHash('sha256').update(manifesto).digest('hex');
    const assinaturaServidor = this.signature.assinar(manifesto);

    return this.prisma.forTenant(async (tx) => {
      const assinatura = await tx.assinaturaVirtual.create({
        data: {
          empresaId,
          documentoAssinaturaId: doc.id,
          funcionarioId,
          hashDocumento: doc.hashDocumento,
          hashAssinatura,
          assinaturaServidor,
          chaveServidorId: this.signature.chaveId,
          metodo,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          timestampAssinatura: timestamp,
        },
        select: { id: true, hashAssinatura: true, timestampAssinatura: true },
      });
      await tx.documentoAssinatura.update({
        where: { id: doc.id },
        data: { status: StatusAssinatura.ASSINADO },
      });
      await this.audit(tx, empresaId, funcionarioId, 'assinatura.assinar', doc.id, {
        hashAssinatura,
        chaveServidorId: this.signature.chaveId,
      });
      return { status: StatusAssinatura.ASSINADO, ...assinatura };
    });
  }

  async recusar(funcionarioId: string, id: string, motivo: string, ctx: Ctx) {
    const empresaId = TenantContext.requireEmpresaId();
    return this.prisma.forTenant(async (tx) => {
      const d = await tx.documentoAssinatura.findFirst({ where: { id, funcionarioId } });
      if (!d) throw new NotFoundException('Documento nao encontrado.');
      if (d.status === StatusAssinatura.ASSINADO) {
        throw new ConflictException('Documento ja assinado.');
      }
      await tx.documentoAssinatura.update({
        where: { id },
        data: { status: StatusAssinatura.RECUSADO, motivoRecusa: motivo, recusadoEm: new Date() },
      });
      // Notificacao ao RH: registrada no log (push e infra, fora do escopo da fase).
      await this.audit(tx, empresaId, funcionarioId, 'assinatura.recusar', id, { motivo, ip: ctx.ip });
      return { status: StatusAssinatura.RECUSADO };
    });
  }

  async historico(funcionarioId: string) {
    return this.prisma.forTenant((tx) =>
      tx.documentoAssinatura.findMany({
        where: { funcionarioId, status: StatusAssinatura.ASSINADO },
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          tipo: true,
          titulo: true,
          competencia: true,
          assinatura: { select: { hashAssinatura: true, timestampAssinatura: true } },
        },
      }),
    );
  }

  /**
   * Comprovante verificavel: reconstroi o manifesto, confere a assinatura Ed25519
   * do servidor E a integridade do arquivo (re-hash do storage). E o que um
   * auditor/juiz usa para validar autoria + integridade.
   */
  /**
   * @param funcionarioId quando informado (acesso do funcionario), restringe ao
   *   DONO do documento -- evita IDOR intra-tenant. Admin (ADM 3) passa undefined.
   */
  async comprovante(id: string, funcionarioId?: string) {
    const empresaId = TenantContext.requireEmpresaId();
    const doc = await this.prisma.forTenant((tx) =>
      tx.documentoAssinatura.findFirst({
        where: { id, ...(funcionarioId ? { funcionarioId } : {}) },
        include: { assinatura: true, funcionario: { select: { cpf: true, nome: true } } },
      }),
    );
    if (!doc || !doc.assinatura) throw new BadRequestException('Documento sem assinatura.');
    const a = doc.assinatura;

    const manifesto = montarManifestoAssinatura({
      empresaId,
      documentoId: doc.id,
      funcionarioId: doc.funcionarioId,
      cpf: doc.funcionario.cpf,
      tipo: doc.tipo,
      titulo: doc.titulo,
      competencia: doc.competencia,
      hashDocumento: a.hashDocumento,
      metodo: a.metodo,
      timestamp: a.timestampAssinatura.toISOString(),
      ip: a.ip,
      userAgent: a.userAgent,
    });
    const assinaturaValida = this.signature.verificar(manifesto, a.assinaturaServidor);

    // Integridade: rehash do arquivo cifrado guardado.
    let integridadeDocumentoOk = false;
    try {
      const bytes = await this.storage.lerImagem(doc.arquivoRef);
      integridadeDocumentoOk = this.signature.hashDocumento(bytes) === a.hashDocumento;
    } catch {
      integridadeDocumentoOk = false;
    }

    return {
      documento: { id: doc.id, titulo: doc.titulo, tipo: doc.tipo, competencia: doc.competencia },
      signatario: { nome: doc.funcionario.nome, cpf: doc.funcionario.cpf },
      assinatura: {
        hashDocumento: a.hashDocumento,
        hashAssinatura: a.hashAssinatura,
        assinaturaServidor: a.assinaturaServidor,
        chaveServidorId: a.chaveServidorId,
        metodo: a.metodo,
        timestamp: a.timestampAssinatura.toISOString(),
        ip: a.ip,
      },
      chavePublicaPem: this.signature.publicKeyPem,
      assinaturaValida,
      integridadeDocumentoOk,
    };
  }

  chavePublica() {
    return { chaveId: this.signature.chaveId, publicKeyPem: this.signature.publicKeyPem };
  }

  // ---- helpers ----

  private decodificar(base64OuDataUrl: string): Buffer {
    const b64 = base64OuDataUrl.includes(',')
      ? base64OuDataUrl.slice(base64OuDataUrl.indexOf(',') + 1)
      : base64OuDataUrl;
    return Buffer.from(b64, 'base64');
  }

  private async audit(
    tx: Parameters<Parameters<PrismaService['forTenant']>[0]>[0],
    empresaId: string,
    usuarioId: string,
    acao: string,
    entidadeId: string,
    valorNovo: unknown,
  ) {
    await tx.logAuditoria.create({
      data: {
        empresaId,
        usuarioId,
        usuarioTipo: acao === 'assinatura.assinar' || acao === 'assinatura.recusar' ? 'funcionario' : 'admin',
        acao,
        entidadeAfetada: 'documentos_assinatura',
        entidadeId,
        valorNovo: valorNovo as object,
      },
    });
  }
}
