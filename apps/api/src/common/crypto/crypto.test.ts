import { randomBytes } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { cifrar, decifrar } from './aes';
import { hashSenha, verificarSenha } from './password';
import { gerarCodigoConvite, gerarTokenOpaco, hashToken, tokenConfere } from './tokens';
import { gerarSegredoTotp, gerarTokenAtual, verificarTotp } from './totp';

beforeAll(() => {
  // Chave AES-256 deterministica para o teste.
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('base64');
});

describe('tokens', () => {
  it('hashToken e deterministico e tokenConfere valida', () => {
    const token = gerarTokenOpaco();
    const h = hashToken(token);
    expect(hashToken(token)).toBe(h);
    expect(tokenConfere(token, h)).toBe(true);
    expect(tokenConfere('outro', h)).toBe(false);
  });

  it('codigo de convite tem 8 chars sem ambiguos', () => {
    const c = gerarCodigoConvite();
    expect(c).toHaveLength(8);
    expect(c).not.toMatch(/[0O1I]/);
  });
});

describe('aes (dados sensiveis em repouso)', () => {
  it('cifra e decifra (roundtrip)', () => {
    const segredo = 'segredo-totp-super-sensivel';
    const pacote = cifrar(segredo);
    expect(pacote).not.toContain(segredo);
    expect(decifrar(pacote)).toBe(segredo);
  });

  it('detecta adulteracao (GCM)', () => {
    const pacote = cifrar('x');
    const adulterado = pacote.slice(0, -2) + (pacote.endsWith('AA') ? 'BB' : 'AA');
    expect(() => decifrar(adulterado)).toThrow();
  });
});

describe('totp', () => {
  it('verifica o token atual do segredo', () => {
    const segredo = gerarSegredoTotp();
    const token = gerarTokenAtual(segredo);
    expect(verificarTotp(token, segredo)).toBe(true);
    expect(verificarTotp('000000', segredo)).toBe(false);
  });
});

describe('password (argon2id)', () => {
  it('hash + verify (roundtrip)', async () => {
    const h = await hashSenha('SenhaForte123');
    expect(h).toMatch(/^\$argon2id\$/);
    expect(await verificarSenha(h, 'SenhaForte123')).toBe(true);
    expect(await verificarSenha(h, 'errada')).toBe(false);
  });
});
