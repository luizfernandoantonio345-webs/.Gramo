import { plainAddPlaceholder } from '@signpdf/placeholder-plain';
import { P12Signer } from '@signpdf/signer-p12';
import { SignPdf } from '@signpdf/signpdf';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { CertificadoService } from './certificado.service';

/**
 * Prova que o pipeline PAdES-B roda de ponta a ponta nesta maquina: certificado
 * (autoassinado dev) -> PDF (pdf-lib) -> placeholder -> assinatura CMS embarcada.
 */
describe('PAdES', () => {
  it('gera um certificado PKCS#12 autoassinado (dev)', () => {
    const cert = new CertificadoService();
    expect(cert.autoassinado).toBe(true);
    expect(cert.p12.length).toBeGreaterThan(100);
  });

  it('assina um PDF no padrao PAdES-B (assinatura embarcada)', async () => {
    const cert = new CertificadoService();
    const doc = await PDFDocument.create();
    doc.addPage([300, 200]).drawText('Comprovante de teste');
    const pdf = Buffer.from(await doc.save({ useObjectStreams: false }));

    const comPlaceholder = plainAddPlaceholder({
      pdfBuffer: pdf,
      reason: 'teste',
      contactInfo: 'rep-p',
      name: 'REP-P',
      location: 'BR',
    });
    const signer = new P12Signer(cert.p12, { passphrase: cert.passphrase });
    const assinado = await new SignPdf().sign(comPlaceholder, signer);

    expect(assinado.length).toBeGreaterThan(pdf.length);
    // A assinatura CMS/PAdES fica no dicionario /Sig do PDF.
    expect(assinado.toString('latin1')).toContain('adbe.pkcs7.detached');
  }, 20000);
});
