import {
  createHash,
  createPrivateKey,
  createPublicKey,
  hkdfSync,
  KeyObject,
  sign as edSign,
  verify as edVerify,
} from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Assinatura Ed25519 do servidor sobre o manifesto de cada assinatura virtual.
 *
 * Por que Ed25519 do servidor (e nao so um hash): da NAO-REPUDIO pela plataforma
 * e permite verificacao publica do comprovante (chave publica publicavel), sem
 * expor a chave privada. E a base evidencial que a Fase 5 embarca em PDF PAdES.
 *
 * Chave: derivada por HKDF-SHA256 de DATA_ENCRYPTION_KEY com um `info` proprio
 * (separacao de chave -- a chave de assinatura NAO e a de cifragem), ou de
 * ASSINATURA_SEED (base64, 32 bytes) quando definida. Deterministica -> a chave
 * publica e estavel entre reinicios e pode ser publicada/registrada.
 */
@Injectable()
export class SignatureService {
  private readonly logger = new Logger(SignatureService.name);
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  readonly chaveId: string;
  readonly publicKeyPem: string;

  constructor() {
    const seed = this.derivarSeed();
    // PKCS8 DER de uma chave Ed25519 = prefixo fixo + 32 bytes de seed.
    const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
    this.privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
    this.publicKey = createPublicKey(this.privateKey);
    this.publicKeyPem = this.publicKey.export({ format: 'pem', type: 'spki' }).toString();
    const spki = this.publicKey.export({ format: 'der', type: 'spki' });
    this.chaveId = createHash('sha256').update(spki).digest('hex').slice(0, 32);
    this.logger.log(`Chave de assinatura Ed25519 carregada (id=${this.chaveId}).`);
  }

  /** Assina o manifesto canonico. Retorna a assinatura em base64. */
  assinar(manifesto: string): string {
    return edSign(null, Buffer.from(manifesto, 'utf8'), this.privateKey).toString('base64');
  }

  /** Verifica a assinatura de um manifesto (para o endpoint de comprovante). */
  verificar(manifesto: string, assinaturaBase64: string): boolean {
    try {
      return edVerify(
        null,
        Buffer.from(manifesto, 'utf8'),
        this.publicKey,
        Buffer.from(assinaturaBase64, 'base64'),
      );
    } catch {
      return false;
    }
  }

  /** SHA-256 (hex) dos bytes de um documento -- integridade do arquivo assinado. */
  hashDocumento(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex');
  }

  private derivarSeed(): Buffer {
    const explicita = process.env.ASSINATURA_SEED;
    if (explicita) {
      const b = Buffer.from(explicita, 'base64');
      if (b.length !== 32) throw new Error('ASSINATURA_SEED deve ter 32 bytes (base64).');
      return b;
    }
    const master = Buffer.from(process.env.DATA_ENCRYPTION_KEY ?? '', 'base64');
    if (master.length !== 32) {
      throw new Error(
        'DATA_ENCRYPTION_KEY (32 bytes) necessaria para derivar a chave de assinatura.',
      );
    }
    // HKDF com info dedicado -> separacao de chave (assinatura != cifragem).
    return Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), 'repp-ed25519-assinatura', 32));
  }
}
