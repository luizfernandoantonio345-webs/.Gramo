import { describe, expect, it } from 'vitest';
import { formatarBRL, reaisParaCentavos } from './dinheiro';

describe('dinheiro', () => {
  it('reaisParaCentavos converte reais (ponto ou virgula) em centavos', () => {
    expect(reaisParaCentavos('1234.56')).toBe(123456);
    expect(reaisParaCentavos('1234,56')).toBe(123456);
    expect(reaisParaCentavos(99.9)).toBe(9990);
  });

  it('formatarBRL formata centavos em moeda', () => {
    // \s casa tambem o espaco nao-quebravel do locale pt-BR (U+00A0/U+202F).
    expect(formatarBRL(123456)).toMatch(/^R\$\s*1\.234,56$/);
    expect(formatarBRL(0)).toMatch(/^R\$\s*0,00$/);
  });
});
