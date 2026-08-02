import { hash, verify } from '@node-rs/argon2';

/**
 * Hashing de senha com Argon2id.
 *
 * Usamos @node-rs/argon2 (binarios pre-compilados) em vez do pacote `argon2`
 * para evitar compilacao nativa (node-gyp) em ambientes sem toolchain.
 * Parametros seguem o recomendado pelo OWASP para Argon2id.
 */
const OPCOES = {
  memoryCost: 19456, // ~19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashSenha(senha: string): Promise<string> {
  return hash(senha, OPCOES);
}

export async function verificarSenha(hashArmazenado: string, senha: string): Promise<boolean> {
  try {
    return await verify(hashArmazenado, senha, OPCOES);
  } catch {
    // Hash malformado nunca deve derrubar o fluxo de login.
    return false;
  }
}
