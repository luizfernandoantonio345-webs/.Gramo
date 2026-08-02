import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Geracao e hashing de tokens opacos (refresh token, convite, recuperacao).
 * NUNCA guardamos o valor em claro no banco -- so o SHA-256. Tokens opacos
 * (aleatorios) podem usar hash simples; nao sao segredos derivaveis como senha.
 */

/** Token aleatorio urlsafe (256 bits). Use para refresh/recuperacao de senha. */
export function gerarTokenOpaco(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Codigo de convite legivel para o funcionario (8 chars, sem caracteres
 * ambiguos como 0/O/1/I). Curto de proposito -- expira e e de uso unico.
 */
export function gerarCodigoConvite(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 8; i++) {
    codigo += alfabeto[randomInt(alfabeto.length)];
  }
  return codigo;
}

/** SHA-256 hex do token/codigo, para armazenar e comparar. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Comparacao em tempo constante entre um token cru e um hash guardado. */
export function tokenConfere(tokenCru: string, hashGuardado: string): boolean {
  const a = Buffer.from(hashToken(tokenCru), 'hex');
  const b = Buffer.from(hashGuardado, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
