import { createHash } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';
import { P12Signer } from '@signpdf/signer-p12';
import { SignPdf } from '@signpdf/signpdf';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PrismaService } from '../prisma/prisma.service';
import { CertificadoService } from './certificado.service';

/**
 * Comprovante de registro de ponto em PDF assinado no padrao PAdES-B
 * (Portaria 671). Gera o PDF (pdf-lib), adiciona o placeholder de assinatura e
 * assina com o certificado PKCS#12 (CertificadoService). Retorna PDF + SHA-256.
 */
@Injectable()
export class ComprovanteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly certificado: CertificadoService,
  ) {}

  async gerarComprovantePonto(pontoId: string): Promise<{ pdfBase64: string; sha256: string }> {
    const dados = await this.prisma.forTenant(async (tx) => {
      const ponto = await tx.ponto.findFirst({
        where: { id: pontoId },
        include: { funcionario: { select: { nome: true, cpf: true } } },
      });
      if (!ponto) throw new NotFoundException('Ponto nao encontrado.');
      const empresa = await tx.empresa.findFirstOrThrow({
        select: { razaoSocial: true, cnpj: true },
      });
      return { ponto, empresa };
    });

    const pdfBytes = await this.montarPdf(dados);
    const assinado = await this.assinarPades(Buffer.from(pdfBytes));
    return {
      pdfBase64: assinado.toString('base64'),
      sha256: createHash('sha256').update(assinado).digest('hex'),
    };
  }

  private async montarPdf(d: {
    ponto: {
      nsr: bigint;
      tipo: string;
      registradoEm: Date;
      dentroRegap: boolean;
      statusValidacao: string;
      hashIntegridade: string;
      funcionario: { nome: string; cpf: string };
    };
    empresa: { razaoSocial: string; cnpj: string };
  }): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 420]); // A5 paisagem aprox.
    const fonte = await pdf.embedFont(StandardFonts.Helvetica);
    const fonteBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.078, 0.129, 0.239);

    let y = 380;
    const linha = (txt: string, opts: { bold?: boolean; size?: number } = {}) => {
      page.drawText(txt, {
        x: 40,
        y,
        size: opts.size ?? 11,
        font: opts.bold ? fonteBold : fonte,
        color: navy,
      });
      y -= (opts.size ?? 11) + 8;
    };

    linha('COMPROVANTE DE REGISTRO DE PONTO', { bold: true, size: 15 });
    linha('Portaria MTP 671/2021 - REP-P', { size: 9 });
    y -= 8;
    linha(`Empregador: ${d.empresa.razaoSocial}`, { bold: true });
    linha(`CNPJ: ${d.empresa.cnpj}`);
    y -= 4;
    linha(`Funcionario: ${d.ponto.funcionario.nome}`);
    linha(`CPF: ${d.ponto.funcionario.cpf}`);
    y -= 4;
    linha(`NSR: ${d.ponto.nsr.toString()}`, { bold: true });
    linha(`Tipo: ${d.ponto.tipo}`);
    linha(`Data/Hora: ${d.ponto.registradoEm.toISOString()}`);
    linha(`Dentro da REGAP: ${d.ponto.dentroRegap ? 'Sim' : 'Nao'}`);
    linha(`Status: ${d.ponto.statusValidacao}`);
    y -= 4;
    page.drawText('Hash de integridade (SHA-256):', {
      x: 40,
      y,
      size: 9,
      font: fonteBold,
      color: navy,
    });
    y -= 14;
    page.drawText(d.ponto.hashIntegridade, { x: 40, y, size: 7, font: fonte, color: navy });

    // xref classico (nao stream): exigido pelo @signpdf/placeholder-plain.
    return pdf.save({ useObjectStreams: false });
  }

  private async assinarPades(pdf: Buffer): Promise<Buffer> {
    const comPlaceholder = plainAddPlaceholder({
      pdfBuffer: pdf,
      reason: 'Comprovante de ponto REP-P',
      contactInfo: 'rep-p',
      name: 'REP-P',
      location: 'BR',
    });
    const signer = new P12Signer(this.certificado.p12, { passphrase: this.certificado.passphrase });
    return new SignPdf().sign(comPlaceholder, signer);
  }
}
