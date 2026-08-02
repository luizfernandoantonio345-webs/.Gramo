import { describe, expect, it } from 'vitest';
import { calcularHorasDia, formatarMinutos, saldoDia } from './banco-horas';
import { TipoMarcacao } from './enums';

const m = (tipo: TipoMarcacao, h: number, min = 0) => ({ tipo, minutosDoDia: h * 60 + min });

describe('calcularHorasDia', () => {
  it('dia completo com intervalo de 1h = 8h liquidas', () => {
    const r = calcularHorasDia([
      m(TipoMarcacao.ENTRADA, 8),
      m(TipoMarcacao.INICIO_INTERVALO, 12),
      m(TipoMarcacao.FIM_INTERVALO, 13),
      m(TipoMarcacao.SAIDA, 17),
    ]);
    expect(r.trabalhadoMin).toBe(8 * 60); // 9h bruto - 1h intervalo
    expect(r.intervaloMin).toBe(60);
  });

  it('ignora par incompleto (esquecido)', () => {
    const r = calcularHorasDia([m(TipoMarcacao.ENTRADA, 8)]);
    expect(r.trabalhadoMin).toBe(0);
  });

  it('nao depende da ordem de entrada', () => {
    const r = calcularHorasDia([m(TipoMarcacao.SAIDA, 17), m(TipoMarcacao.ENTRADA, 9)]);
    expect(r.trabalhadoMin).toBe(8 * 60);
  });
});

describe('saldoDia', () => {
  it('positivo/negativo/null', () => {
    expect(saldoDia(9 * 60, 8 * 60)).toBe(60);
    expect(saldoDia(7 * 60, 8 * 60)).toBe(-60);
    expect(saldoDia(8 * 60, null)).toBeNull();
  });
});

describe('formatarMinutos', () => {
  it('formata com sinal', () => {
    expect(formatarMinutos(90)).toBe('01:30');
    expect(formatarMinutos(-75)).toBe('-01:15');
  });
});
