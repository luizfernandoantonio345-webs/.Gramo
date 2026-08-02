import { describe, expect, it } from 'vitest';
import { TipoMarcacao } from './enums';
import { dentroDoHorario, parseHoraMinutos, type JornadaHorario } from './horario';

const jornada: JornadaHorario = {
  horaEntrada: '08:00',
  horaSaida: '17:00',
  toleranciaMinutos: 10,
  diasSemana: [1, 2, 3, 4, 5], // seg-sex
};

const ctx = (over: Partial<Parameters<typeof dentroDoHorario>[0]>) =>
  dentroDoHorario({
    tipo: TipoMarcacao.ENTRADA,
    minutosDoDia: 8 * 60,
    diaSemana: 1,
    ehFeriado: false,
    jornada,
    ...over,
  });

describe('parseHoraMinutos', () => {
  it('converte HH:MM em minutos', () => {
    expect(parseHoraMinutos('08:00')).toBe(480);
    expect(parseHoraMinutos('17:30')).toBe(1050);
  });
});

describe('dentroDoHorario', () => {
  it('entrada dentro da tolerancia = ok; atraso alem = pendente', () => {
    expect(ctx({ minutosDoDia: 8 * 60 + 10 })).toBe(true); // 08:10, no limite
    expect(ctx({ minutosDoDia: 8 * 60 + 11 })).toBe(false); // 08:11, atraso
    expect(ctx({ minutosDoDia: 7 * 60 + 55 })).toBe(true); // cedo, permitido
  });

  it('saida antecipada alem da tolerancia = pendente', () => {
    const s = (min: number) => ctx({ tipo: TipoMarcacao.SAIDA, minutosDoDia: min });
    expect(s(17 * 60)).toBe(true); // 17:00
    expect(s(16 * 60 + 50)).toBe(true); // 16:50, no limite
    expect(s(16 * 60 + 49)).toBe(false); // 16:49, antecipada
    expect(s(18 * 60)).toBe(true); // tarde, permitido (hora extra)
  });

  it('dia fora da escala = pendente', () => {
    expect(ctx({ diaSemana: 0 })).toBe(false); // domingo
  });

  it('feriado, intervalo ou sem jornada = nao avalia (dentro)', () => {
    expect(ctx({ ehFeriado: true, minutosDoDia: 23 * 60 })).toBe(true);
    expect(ctx({ tipo: TipoMarcacao.INICIO_INTERVALO, minutosDoDia: 23 * 60 })).toBe(true);
    expect(ctx({ jornada: null, minutosDoDia: 23 * 60 })).toBe(true);
  });
});
