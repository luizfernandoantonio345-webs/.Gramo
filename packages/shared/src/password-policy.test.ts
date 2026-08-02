import { describe, expect, it } from 'vitest';
import { validarSenha } from './password-policy';

describe('validarSenha', () => {
  it('aceita senha com >=8 chars, letra e numero', () => {
    expect(validarSenha('senha123').valido).toBe(true);
    expect(validarSenha('Abc12345').valido).toBe(true);
  });

  it('rejeita senha curta', () => {
    const r = validarSenha('ab12');
    expect(r.valido).toBe(false);
    expect(r.erros.some((e) => e.includes('8'))).toBe(true);
  });

  it('rejeita senha sem numero', () => {
    const r = validarSenha('somenteletras');
    expect(r.valido).toBe(false);
    expect(r.erros.some((e) => e.includes('numero'))).toBe(true);
  });

  it('rejeita senha sem letra', () => {
    const r = validarSenha('12345678');
    expect(r.valido).toBe(false);
    expect(r.erros.some((e) => e.includes('letra'))).toBe(true);
  });
});
