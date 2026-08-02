import { authenticator } from 'otplib';

/**
 * TOTP (2FA por app autenticador) para administradores (ADM 1).
 * O segredo e cifrado em repouso (AES) antes de ir ao banco -- ver aes.ts.
 * Tolerancia de 1 janela (30s) para compensar relogio dessincronizado.
 */
authenticator.options = { window: 1 };

export function gerarSegredoTotp(): string {
  return authenticator.generateSecret();
}

/** URL otpauth:// para gerar o QR Code no cliente. */
export function otpauthUrl(email: string, empresaLabel: string, segredo: string): string {
  return authenticator.keyuri(email, `REP-P (${empresaLabel})`, segredo);
}

export function verificarTotp(token: string, segredo: string): boolean {
  try {
    return authenticator.verify({ token, secret: segredo });
  } catch {
    return false;
  }
}

/** Apenas para testes: gera o codigo atual de um segredo. */
export function gerarTokenAtual(segredo: string): string {
  return authenticator.generate(segredo);
}
