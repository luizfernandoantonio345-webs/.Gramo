import { describe, expect, it } from 'vitest';
import { dataNoIntervalo, periodoValido, soData } from './ausencia';

describe('ausencia', () => {
  it('soData extrai YYYY-MM-DD', () => {
    expect(soData('2026-07-31T12:00:00.000Z')).toBe('2026-07-31');
    expect(soData('2026-07-31')).toBe('2026-07-31');
  });

  it('dataNoIntervalo e inclusivo nas bordas', () => {
    expect(dataNoIntervalo('2026-07-10', '2026-07-10', '2026-07-20')).toBe(true);
    expect(dataNoIntervalo('2026-07-20', '2026-07-10', '2026-07-20')).toBe(true);
    expect(dataNoIntervalo('2026-07-15', '2026-07-10', '2026-07-20')).toBe(true);
    expect(dataNoIntervalo('2026-07-09', '2026-07-10', '2026-07-20')).toBe(false);
    expect(dataNoIntervalo('2026-07-21', '2026-07-10', '2026-07-20')).toBe(false);
  });

  it('periodoValido exige inicio <= fim', () => {
    expect(periodoValido('2026-07-10', '2026-07-20')).toBe(true);
    expect(periodoValido('2026-07-20', '2026-07-10')).toBe(false);
  });
});
