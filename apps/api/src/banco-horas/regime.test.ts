import { RegimeHoras } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { aplicarRegimeSaldo } from './banco-horas.service';

// Cenario base: 3h de extras, 1h de faltas, +30min de ajuste manual, com carga.
const base = { extrasMin: 180, faltasMin: 60, ajustesMin: 30, cargaDefinida: true };

describe('aplicarRegimeSaldo (3 regimes de banco de horas)', () => {
  it('HORA_EXTRA nunca acumula saldo (extras=pagamento, faltas=desconto)', () => {
    const r = aplicarRegimeSaldo(RegimeHoras.HORA_EXTRA, base);
    expect(r.saldoBancoMin).toBe(0);
    expect(r.alerta).toBeUndefined();
    expect(r.observacao).toMatch(/HORA_EXTRA/);
  });

  it('COMPENSACAO_MENSAL: saldo = (extras - faltas) + ajustes', () => {
    const r = aplicarRegimeSaldo(RegimeHoras.COMPENSACAO_MENSAL, base);
    expect(r.saldoBancoMin).toBe(180 - 60 + 30); // 150
    expect(r.alerta).toMatch(/pendente de compensacao/);
  });

  it('COMPENSACAO_MENSAL: sem alerta quando o saldo zera', () => {
    const r = aplicarRegimeSaldo(RegimeHoras.COMPENSACAO_MENSAL, {
      extrasMin: 100,
      faltasMin: 100,
      ajustesMin: 0,
      cargaDefinida: true,
    });
    expect(r.saldoBancoMin).toBe(0);
    expect(r.alerta).toBeUndefined();
  });

  it('BANCO_ANUAL: mesma conta de saldo, sem alerta abaixo de 40h', () => {
    const r = aplicarRegimeSaldo(RegimeHoras.BANCO_ANUAL, base);
    expect(r.saldoBancoMin).toBe(150);
    expect(r.alerta).toBeUndefined();
    expect(r.observacao).toMatch(/BANCO_ANUAL/);
  });

  it('BANCO_ANUAL: alerta quando o saldo passa de ~40h', () => {
    const r = aplicarRegimeSaldo(RegimeHoras.BANCO_ANUAL, {
      extrasMin: 41 * 60,
      faltasMin: 0,
      ajustesMin: 0,
      cargaDefinida: true,
    });
    expect(r.saldoBancoMin).toBe(2460);
    expect(r.alerta).toMatch(/elevado/);
  });

  it('sem carga definida (sem jornada): saldo automatico e ignorado, so ajustes contam', () => {
    const r = aplicarRegimeSaldo(RegimeHoras.COMPENSACAO_MENSAL, {
      extrasMin: 180,
      faltasMin: 60,
      ajustesMin: 45,
      cargaDefinida: false,
    });
    // (cargaDefinida=false) => base = 0 + ajustes = 45
    expect(r.saldoBancoMin).toBe(45);
  });

  it('HORA_EXTRA zera o saldo mesmo com ajustes lancados', () => {
    const r = aplicarRegimeSaldo(RegimeHoras.HORA_EXTRA, {
      extrasMin: 0,
      faltasMin: 0,
      ajustesMin: 120,
      cargaDefinida: true,
    });
    expect(r.saldoBancoMin).toBe(0);
  });
});
