import { describe, expect, it } from 'vitest';
import { minutosNoturnos, minutosNoturnosReduzidos, resumoNoturno } from './noturno';

// Datas construidas com hora LOCAL (o calculo usa getHours local) -> deterministico.
const d = (dia: number, h: number, m = 0) => new Date(2026, 0, dia, h, m);

describe('minutosNoturnos', () => {
  it('jornada 22:00->05:00 = 420 min-relogio noturnos (atravessa a meia-noite)', () => {
    expect(minutosNoturnos(d(1, 22), d(2, 5))).toBe(420);
  });

  it('jornada diurna 08:00->17:00 = 0 noturno', () => {
    expect(minutosNoturnos(d(1, 8), d(1, 17))).toBe(0);
  });

  it('conta so a parte noturna: 20:00->23:30 = 90 min (22:00-23:30)', () => {
    expect(minutosNoturnos(d(1, 20), d(1, 23, 30))).toBe(90);
  });

  it('parte apos meia-noite: 04:00->06:00 = 60 min (04:00-05:00)', () => {
    expect(minutosNoturnos(d(1, 4), d(1, 6))).toBe(60);
  });

  it('saida <= entrada = 0', () => {
    expect(minutosNoturnos(d(1, 22), d(1, 22))).toBe(0);
  });
});

describe('hora noturna reduzida (art. 73 §1)', () => {
  it('420 min-relogio noturnos viram ~480 min legais (7h reais = 8h noturnas)', () => {
    expect(minutosNoturnosReduzidos(420)).toBe(480);
  });
});

describe('resumoNoturno', () => {
  it('consolida relogio, legais e adicional (20% padrao)', () => {
    const r = resumoNoturno(d(1, 22), d(2, 5));
    expect(r.minutosRelogio).toBe(420);
    expect(r.minutosLegais).toBe(480);
    expect(r.percentualAdicional).toBe(0.2);
    expect(r.minutosAdicional).toBe(96); // 480 * 20%
  });
});
