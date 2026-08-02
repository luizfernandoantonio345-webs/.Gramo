import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Cifragem simetrica AES-256-GCM para dados sensiveis em repouso (LGPD).
 * Usado agora para o segredo TOTP; na Fase 2, para a biometria facial.
 *
 * Formato de saida (base64): [iv(12) | authTag(16) | ciphertext]. GCM garante
 * confidencialidade E integridade (deteccao de adulteracao).
 */
const IV_BYTES = 12;
const TAG_BYTES = 16;

function chave(): Buffer {
  const b64 = process.env.DATA_ENCRYPTION_KEY ?? '';
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY deve ser 32 bytes (base64) para AES-256.');
  }
  return key;
}

/** Cifra um buffer binario (ex.: imagem). Saida: [iv | tag | ciphertext]. */
export function cifrarBuffer(claro: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', chave(), iv);
  const ct = Buffer.concat([cipher.update(claro), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]);
}

export function decifrarBuffer(pacote: Buffer): Buffer {
  const iv = pacote.subarray(0, IV_BYTES);
  const tag = pacote.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ct = pacote.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', chave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export function cifrar(textoClaro: string): string {
  return cifrarBuffer(Buffer.from(textoClaro, 'utf8')).toString('base64');
}

export function decifrar(pacoteBase64: string): string {
  return decifrarBuffer(Buffer.from(pacoteBase64, 'base64')).toString('utf8');
}
