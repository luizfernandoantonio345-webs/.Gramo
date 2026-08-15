import { StatusValidacaoPonto, TipoAusencia } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { resumirAusencias, resumirConformidade, type GrupoStatus } from './dashboard.service';

const g = (statusValidacao: StatusValidacaoPonto, n: number): GrupoStatus => ({
  statusValidacao,
  _count: { _all: n },
});

describe('resumirConformidade — conformidade das marcacoes', () => {
  it('soma por status e calcula o percentual de validas', () => {
    const r = resumirConformidade(
      [
        g(StatusValidacaoPonto.VALIDO, 80),
        g(StatusValidacaoPonto.PENDENTE_HORARIO, 15),
        g(StatusValidacaoPonto.PENDENTE_IDENTIDADE, 5),
      ],
      12, // foraRegap (ortogonal ao statusValidacao)
    );
    expect(r.total).toBe(100);
    expect(r.validas).toBe(80);
    expect(r.pendenteHorario).toBe(15);
    expect(r.pendenteIdentidade).toBe(5);
    expect(r.pendenteRegap).toBe(0);
    expect(r.foraRegap).toBe(12);
    expect(r.percentualConformidade).toBe(80);
  });

  it('arredonda o percentual para 1 casa decimal', () => {
    const r = resumirConformidade(
      [g(StatusValidacaoPonto.VALIDO, 1), g(StatusValidacaoPonto.PENDENTE_HORARIO, 2)],
      0,
    );
    expect(r.percentualConformidade).toBe(33.3);
  });

  it('sem marcacoes -> percentual 0 (nao divide por zero)', () => {
    const r = resumirConformidade([], 0);
    expect(r.total).toBe(0);
    expect(r.percentualConformidade).toBe(0);
  });
});

describe('resumirAusencias — ausencias aprovadas por tipo', () => {
  it('agrupa por tipo (desc) e conta funcionarios distintos', () => {
    const r = resumirAusencias([
      { funcionarioId: 'a', tipo: TipoAusencia.FERIAS },
      { funcionarioId: 'b', tipo: TipoAusencia.ATESTADO },
      { funcionarioId: 'c', tipo: TipoAusencia.ATESTADO },
      // mesma pessoa, duas ausencias -> conta 1 funcionario afetado
      { funcionarioId: 'a', tipo: TipoAusencia.LICENCA },
    ]);
    expect(r.total).toBe(4);
    expect(r.funcionariosAfetados).toBe(3);
    expect(r.porTipo[0]).toEqual({ tipo: TipoAusencia.ATESTADO, total: 2 });
  });

  it('lista vazia -> zeros', () => {
    expect(resumirAusencias([])).toEqual({ total: 0, porTipo: [], funcionariosAfetados: 0 });
  });
});
