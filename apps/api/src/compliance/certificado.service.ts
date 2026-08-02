import { Injectable, Logger } from '@nestjs/common';
import forge from 'node-forge';

/**
 * Fornece o material de assinatura PAdES (certificado PKCS#12).
 *
 * Producao: define ASSINATURA_P12_BASE64 (o A1/A3 ICP-Brasil, base64) e
 * ASSINATURA_P12_SENHA. Dev: gera um certificado AUTOASSINADO na inicializacao
 * (NAO tem validade juridica ICP-Brasil -- serve so para desenvolvimento e para
 * validar o pipeline PAdES). A troca pelo certificado oficial e plug-and-play.
 */
@Injectable()
export class CertificadoService {
  private readonly logger = new Logger(CertificadoService.name);
  readonly p12: Buffer;
  readonly passphrase: string;
  readonly autoassinado: boolean;

  constructor() {
    const p12Env = process.env.ASSINATURA_P12_BASE64;
    if (p12Env) {
      this.p12 = Buffer.from(p12Env, 'base64');
      this.passphrase = process.env.ASSINATURA_P12_SENHA ?? '';
      this.autoassinado = false;
      this.logger.log('Certificado PKCS#12 carregado do ambiente (producao).');
    } else {
      this.passphrase = 'repp-dev';
      this.p12 = this.gerarAutoassinado(this.passphrase);
      this.autoassinado = true;
      this.logger.warn(
        'Certificado AUTOASSINADO (dev) gerado -- SEM validade ICP-Brasil. Defina ASSINATURA_P12_BASE64 em producao.',
      );
    }
  }

  private gerarAutoassinado(senha: string): Buffer {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    const attrs = [
      { name: 'commonName', value: 'REP-P Assinador (dev)' },
      { name: 'organizationName', value: 'REP-P' },
      { name: 'countryName', value: 'BR' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], senha, {
      algorithm: '3des',
    });
    const der = forge.asn1.toDer(asn1).getBytes();
    return Buffer.from(der, 'binary');
  }
}
