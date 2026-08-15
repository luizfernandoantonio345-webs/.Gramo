import { describe, expect, it } from 'vitest';
import { agregarExtras, reduzirExtrasFunc, type FuncExtras } from './banco-horas.service';

const LIMITE = 120; // CLT art. 59: 2h = 120min.

describe('reduzirExtrasFunc (extras/faltas de um funcionario no periodo)', () => {
  it('soma extras (saldo>0) e faltas (saldo<0); ignora dias sem jornada (null)', () => {
    const r = reduzirExtrasFunc([{ saldoMin: 30 }, { saldoMin: -45 }, { saldoMin: null }], LIMITE);
    expect(r.extrasMin).toBe(30);
    expect(r.faltasMin).toBe(45);
    expect(r.diasAcimaLimite).toBe(0);
  });

  it('conta dias em que o extra excede o limite legal', () => {
    const r = reduzirExtrasFunc([{ saldoMin: 150 }, { saldoMin: 120 }, { saldoMin: 200 }], LIMITE);
    // 150 e 200 excedem 120; 120 nao excede (limite exato)
    expect(r.diasAcimaLimite).toBe(2);
    expect(r.extrasMin).toBe(470);
  });

  it('lista vazia -> zeros', () => {
    expect(reduzirExtrasFunc([], LIMITE)).toEqual({
      extrasMin: 0,
      faltasMin: 0,
      diasAcimaLimite: 0,
    });
  });
});

describe('agregarExtras (consolidacao da forca de trabalho)', () => {
  const f = (
    funcionario: string,
    extrasMin: number,
    faltasMin: number,
    diasAcimaLimite = 0,
  ): FuncExtras => ({
    funcionario,
    filial: 'Obra 1',
    extrasMin,
    faltasMin,
    diasAcimaLimite,
  });

  it('soma totais, conta quem fez extra e ordena o top desc', () => {
    const r = agregarExtras([f('Ana', 300, 0, 2), f('Bruno', 0, 60), f('Caio', 120, 30, 1)]);
    expect(r.totalExtrasMin).toBe(420);
    expect(r.totalFaltasMin).toBe(90);
    expect(r.funcionariosComExtra).toBe(2); // Ana e Caio
    expect(r.diasAcimaLimite).toBe(3);
    expect(r.topExtras.map((x) => x.funcionario)).toEqual(['Ana', 'Caio']);
  });

  it('sem ninguem -> zeros e top vazio', () => {
    expect(agregarExtras([])).toEqual({
      totalExtrasMin: 0,
      totalFaltasMin: 0,
      funcionariosComExtra: 0,
      diasAcimaLimite: 0,
      topExtras: [],
    });
  });
});
