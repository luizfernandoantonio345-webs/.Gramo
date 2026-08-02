import { describe, expect, it } from 'vitest';
import {
  estaBloqueado,
  minutosRestantes,
  registrarFalha,
  registrarSucesso,
  type EstadoLockout,
} from './lockout';

const t0 = new Date('2026-07-30T12:00:00.000Z');
const zerado: EstadoLockout = { tentativasFalhas: 0, bloqueadoAte: null };

describe('lockout', () => {
  it('acumula falhas sem bloquear ate a 4a', () => {
    let estado = zerado;
    for (let i = 0; i < 4; i++) estado = registrarFalha(estado, t0);
    expect(estado.tentativasFalhas).toBe(4);
    expect(estaBloqueado(estado, t0)).toBe(false);
  });

  it('bloqueia por 15 min na 5a falha', () => {
    let estado = zerado;
    for (let i = 0; i < 5; i++) estado = registrarFalha(estado, t0);
    expect(estaBloqueado(estado, t0)).toBe(true);
    expect(minutosRestantes(estado, t0)).toBe(15);
  });

  it('libera apos a janela de 15 min', () => {
    let estado = zerado;
    for (let i = 0; i < 5; i++) estado = registrarFalha(estado, t0);
    const depois = new Date(t0.getTime() + 15 * 60 * 1000 + 1);
    expect(estaBloqueado(estado, depois)).toBe(false);
    expect(minutosRestantes(estado, depois)).toBe(0);
  });

  it('sucesso zera o estado', () => {
    const estado = registrarSucesso();
    expect(estado.tentativasFalhas).toBe(0);
    expect(estaBloqueado(estado, t0)).toBe(false);
  });
});
