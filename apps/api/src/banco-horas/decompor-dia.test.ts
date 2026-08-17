import { describe, expect, it } from 'vitest';
import { decomporDia } from './banco-horas.service';

describe('decomporDia — normais / extras / noturnas do dia', () => {
  it('dentro da carga: tudo normal, sem extra', () => {
    expect(decomporDia(480, 0, 480)).toEqual({ normaisMin: 480, extrasMin: 0, noturnasMin: 0 });
  });

  it('acima da carga: o excedente vira extra', () => {
    // 10h trabalhadas, carga 8h -> 8h normais + 2h extras
    expect(decomporDia(600, 0, 480)).toEqual({ normaisMin: 480, extrasMin: 120, noturnasMin: 0 });
  });

  it('sem carga definida: tudo e normal (nao inventa extra)', () => {
    expect(decomporDia(300, 0, null)).toEqual({ normaisMin: 300, extrasMin: 0, noturnasMin: 0 });
  });

  it('repassa os minutos noturnos para o adicional', () => {
    expect(decomporDia(540, 90, 480)).toEqual({ normaisMin: 480, extrasMin: 60, noturnasMin: 90 });
  });
});
