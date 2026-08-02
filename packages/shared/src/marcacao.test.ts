import { describe, expect, it } from 'vitest';
import { TipoMarcacao } from './enums';
import { proximoTipoMarcacao } from './marcacao';

describe('proximoTipoMarcacao', () => {
  it('primeira marcacao do dia e ENTRADA', () => {
    expect(proximoTipoMarcacao([])).toBe(TipoMarcacao.ENTRADA);
  });

  it('segue o ciclo entrada -> intervalo -> saida', () => {
    expect(proximoTipoMarcacao([TipoMarcacao.ENTRADA])).toBe(TipoMarcacao.INICIO_INTERVALO);
    expect(proximoTipoMarcacao([TipoMarcacao.ENTRADA, TipoMarcacao.INICIO_INTERVALO])).toBe(
      TipoMarcacao.FIM_INTERVALO,
    );
    expect(
      proximoTipoMarcacao([
        TipoMarcacao.ENTRADA,
        TipoMarcacao.INICIO_INTERVALO,
        TipoMarcacao.FIM_INTERVALO,
      ]),
    ).toBe(TipoMarcacao.SAIDA);
  });

  it('reinicia o ciclo apos SAIDA', () => {
    expect(
      proximoTipoMarcacao([
        TipoMarcacao.ENTRADA,
        TipoMarcacao.INICIO_INTERVALO,
        TipoMarcacao.FIM_INTERVALO,
        TipoMarcacao.SAIDA,
      ]),
    ).toBe(TipoMarcacao.ENTRADA);
  });
});
