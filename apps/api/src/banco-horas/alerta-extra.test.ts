import { describe, expect, it } from 'vitest';
import { avaliarExtraDia } from './banco-horas.service';

// Limite legal padrao de extra diaria (CLT art. 59): 2h = 120min.
const LIMITE = 120;

describe('avaliarExtraDia (alerta proativo de hora extra)', () => {
  it('ignora dia sem jornada/carga (saldo null)', () => {
    expect(avaliarExtraDia(null, LIMITE)).toBeNull();
  });

  it('ignora dia sem extra (saldo <= 0)', () => {
    expect(avaliarExtraDia(0, LIMITE)).toBeNull();
    expect(avaliarExtraDia(-60, LIMITE)).toBeNull();
  });

  it('ignora extra pequeno, abaixo do limiar de aviso (75% de 120 = 90)', () => {
    expect(avaliarExtraDia(89, LIMITE)).toBeNull();
  });

  it('sinaliza PROXIMO quando cruza o limiar mas ainda dentro do limite', () => {
    const r = avaliarExtraDia(90, LIMITE);
    expect(r).not.toBeNull();
    expect(r!.status).toBe('PROXIMO');
    expect(r!.extraMin).toBe(90);
    expect(r!.restanteMin).toBe(30); // faltam 30min para o limite
  });

  it('ainda e PROXIMO exatamente no limite (nao excedeu)', () => {
    const r = avaliarExtraDia(120, LIMITE);
    expect(r!.status).toBe('PROXIMO');
    expect(r!.restanteMin).toBe(0);
  });

  it('sinaliza EXCEDIDO quando passa do limite legal', () => {
    const r = avaliarExtraDia(150, LIMITE);
    expect(r!.status).toBe('EXCEDIDO');
    expect(r!.extraMin).toBe(150);
    expect(r!.restanteMin).toBe(0); // nunca negativo
  });

  it('respeita fracaoAviso customizada', () => {
    // Com fracao 0.5, avisa a partir de 60min.
    expect(avaliarExtraDia(59, LIMITE, 0.5)).toBeNull();
    expect(avaliarExtraDia(60, LIMITE, 0.5)!.status).toBe('PROXIMO');
  });
});
