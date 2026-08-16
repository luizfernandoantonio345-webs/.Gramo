import { StatusValidacaoPonto } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { motivoAlertaPonto } from './dashboard.service';

describe('motivoAlertaPonto — motivo do alerta ao vivo', () => {
  it('fora da REGAP (dentroRegap=false) tem prioridade', () => {
    expect(
      motivoAlertaPonto({ dentroRegap: false, statusValidacao: StatusValidacaoPonto.VALIDO }),
    ).toBe('Fora da área autorizada (REGAP)');
    // mesmo com pendencia de horario, "fora da area" prevalece
    expect(
      motivoAlertaPonto({
        dentroRegap: false,
        statusValidacao: StatusValidacaoPonto.PENDENTE_HORARIO,
      }),
    ).toBe('Fora da área autorizada (REGAP)');
  });

  it('PENDENTE_REGAP tambem e tratado como fora da area', () => {
    expect(
      motivoAlertaPonto({
        dentroRegap: true,
        statusValidacao: StatusValidacaoPonto.PENDENTE_REGAP,
      }),
    ).toBe('Fora da área autorizada (REGAP)');
  });

  it('dentro da area, mas fora do horario', () => {
    expect(
      motivoAlertaPonto({
        dentroRegap: true,
        statusValidacao: StatusValidacaoPonto.PENDENTE_HORARIO,
      }),
    ).toBe('Fora do horário / jornada');
  });

  it('outros casos caem no generico', () => {
    expect(
      motivoAlertaPonto({
        dentroRegap: true,
        statusValidacao: StatusValidacaoPonto.PENDENTE_IDENTIDADE,
      }),
    ).toBe('Pendente de validação');
  });
});
