import { describe, expect, it } from 'vitest';
import { apurarValores } from './apuracao';

// Parametros do exemplo do usuario: R$12,14/h, extra 50%, periculosidade 30%
// (REGAP = area de risco), noturno 20%.
const P = {
  valorHora: 12.14,
  percentualExtra: 0.5,
  percentualPericulosidade: 0.3,
  percentualNoturno: 0.2,
};

describe('apurarValores — valores da folha a partir das horas', () => {
  it('diarista (sem noturno): 176h normais + 20h extras', () => {
    const r = apurarValores(
      { minutosNormais: 176 * 60, minutosExtras: 20 * 60, minutosNoturnos: 0 },
      P,
    );
    expect(r.normais).toEqual({ horas: 176, valor: 2136.64 }); // 176 * 12,14
    expect(r.extras).toEqual({ horas: 20, valor: 364.2 }); // 20 * 12,14 * 1,5
    expect(r.adicionalPericulosidade).toBe(713.83); // (176+20) * 12,14 * 0,3
    expect(r.adicionalNoturno).toEqual({ horas: 0, valor: 0 });
    expect(r.total).toBe(3214.67);
  });

  it('trabalhador noturno: inclui o adicional noturno separado', () => {
    const r = apurarValores(
      { minutosNormais: 160 * 60, minutosExtras: 10 * 60, minutosNoturnos: 40 * 60 },
      P,
    );
    expect(r.adicionalNoturno).toEqual({ horas: 40, valor: 97.12 }); // 40 * 12,14 * 0,2
    expect(r.total).toBe(2840.76);
  });

  it('sem periculosidade nem noturno (cargo administrativo)', () => {
    const r = apurarValores(
      { minutosNormais: 200 * 60, minutosExtras: 0, minutosNoturnos: 0 },
      { valorHora: 10, percentualExtra: 0.5, percentualPericulosidade: 0, percentualNoturno: 0 },
    );
    expect(r.adicionalPericulosidade).toBe(0);
    expect(r.total).toBe(2000);
  });

  it('extra a 100% (domingo/feriado) muda so o parametro', () => {
    const r = apurarValores(
      { minutosNormais: 0, minutosExtras: 10 * 60, minutosNoturnos: 0 },
      { valorHora: 12.14, percentualExtra: 1.0, percentualPericulosidade: 0, percentualNoturno: 0 },
    );
    expect(r.extras.valor).toBe(242.8); // 10 * 12,14 * 2
  });
});
