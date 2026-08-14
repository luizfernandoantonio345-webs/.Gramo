import { describe, expect, it } from 'vitest';
import { OrigemHora, TipoMarcacao } from './enums';
import { montarConteudoCanonicoPonto, type ConteudoPonto } from './ponto-hash';

const base: ConteudoPonto = {
  empresaId: 'emp-1',
  funcionarioId: 'func-1',
  nsr: 42,
  tipo: TipoMarcacao.ENTRADA,
  registradoEm: '2026-07-30T12:00:00.000Z',
  origemHora: OrigemHora.SERVIDOR,
  latitude: -23.55,
  longitude: -46.63,
  dentroRegap: true,
  uuidIdempotencia: 'uuid-1',
};

describe('montarConteudoCanonicoPonto', () => {
  it('e deterministico para o mesmo conteudo', () => {
    expect(montarConteudoCanonicoPonto(base)).toBe(montarConteudoCanonicoPonto({ ...base }));
  });

  it('muda se qualquer campo relevante mudar (deteccao de adulteracao)', () => {
    const original = montarConteudoCanonicoPonto(base);
    expect(montarConteudoCanonicoPonto({ ...base, nsr: 43 })).not.toBe(original);
    expect(montarConteudoCanonicoPonto({ ...base, dentroRegap: false })).not.toBe(original);
    expect(
      montarConteudoCanonicoPonto({ ...base, registradoEm: '2026-07-30T12:00:01.000Z' }),
    ).not.toBe(original);
  });

  it('trata NSR bigint-como-string e number igualmente', () => {
    expect(montarConteudoCanonicoPonto({ ...base, nsr: '42' })).toBe(
      montarConteudoCanonicoPonto({ ...base, nsr: 42 }),
    );
  });
});
