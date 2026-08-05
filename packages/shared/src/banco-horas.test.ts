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

  it('dia diurno nao tem minutos noturnos', () => {
    const r = calcularHorasDia([m(TipoMarcacao.ENTRADA, 8), m(TipoMarcacao.SAIDA, 17)]);
    expect(r.noturnoMin).toBe(0);
  });

  it('conta so a parte noturna da noite: 18:00->23:30 = 90 min (22:00-23:30)', () => {
    const r = calcularHorasDia([m(TipoMarcacao.ENTRADA, 18), m(TipoMarcacao.SAIDA, 23, 30)]);
    expect(r.noturnoMin).toBe(90);
  });

  it('conta a janela da madrugada: 03:00->08:00 = 120 min (03:00-05:00)', () => {
    const r = calcularHorasDia([m(TipoMarcacao.ENTRADA, 3), m(TipoMarcacao.SAIDA, 8)]);
    expect(r.noturnoMin).toBe(120);
  });

  it('desconta intervalo noturno: 22:00-23:00 com pausa 22:15-22:30 = 45 min noturnos', () => {
    const r = calcularHorasDia([
      m(TipoMarcacao.ENTRADA, 22),
      m(TipoMarcacao.INICIO_INTERVALO, 22, 15),
      m(TipoMarcacao.FIM_INTERVALO, 22, 30),
      m(TipoMarcacao.SAIDA, 23),
    ]);
    // bruto noturno 60 - intervalo noturno 15 = 45
    expect(r.noturnoMin).toBe(45);
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
