import { TipoMarcacao } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calcularPresenca } from './dashboard.service';

const p = (
  funcionarioId: string,
  tipo: TipoMarcacao,
  hora: string,
  nome: string,
  filial: string | null,
) => ({
  funcionarioId,
  tipo,
  registradoEm: new Date(`2026-08-05T${hora}:00-03:00`),
  funcionario: { nome, filial: filial ? { nome: filial } : null },
});

describe('calcularPresenca — presenca em tempo real', () => {
  it('conta presente quando o ULTIMO ponto e ENTRADA ou FIM_INTERVALO', () => {
    // Ana: entrou e voltou do intervalo -> presente. Bruno: saiu -> ausente.
    const pontos = [
      p('ana', TipoMarcacao.ENTRADA, '08:00', 'Ana', 'Matriz'),
      p('ana', TipoMarcacao.INICIO_INTERVALO, '12:00', 'Ana', 'Matriz'),
      p('ana', TipoMarcacao.FIM_INTERVALO, '13:00', 'Ana', 'Matriz'),
      p('bruno', TipoMarcacao.ENTRADA, '08:10', 'Bruno', 'Matriz'),
      p('bruno', TipoMarcacao.SAIDA, '17:00', 'Bruno', 'Matriz'),
    ];
    const r = calcularPresenca(pontos);
    expect(r.total).toBe(1);
    expect(r.presentes.map((x) => x.funcionario)).toEqual(['Ana']);
  });

  it('quem esta em INICIO_INTERVALO (almoco) nao conta como presente', () => {
    const pontos = [
      p('ana', TipoMarcacao.ENTRADA, '08:00', 'Ana', 'Matriz'),
      p('ana', TipoMarcacao.INICIO_INTERVALO, '12:00', 'Ana', 'Matriz'),
    ];
    expect(calcularPresenca(pontos).total).toBe(0);
  });

  it('agrupa por filial e ordena por total desc; funcionario sem filial vira "Sem filial"', () => {
    const pontos = [
      p('a', TipoMarcacao.ENTRADA, '08:00', 'Ana', 'Matriz'),
      p('b', TipoMarcacao.ENTRADA, '08:00', 'Bia', 'Matriz'),
      p('c', TipoMarcacao.ENTRADA, '08:00', 'Caio', 'Filial Sul'),
      p('d', TipoMarcacao.ENTRADA, '08:00', 'Dora', null),
    ];
    const r = calcularPresenca(pontos);
    expect(r.total).toBe(4);
    expect(r.porFilial[0]).toEqual({ filial: 'Matriz', total: 2 });
    expect(r.porFilial.map((x) => x.filial)).toContain('Sem filial');
    // presentes ordenados por nome (pt-BR)
    expect(r.presentes.map((x) => x.funcionario)).toEqual(['Ana', 'Bia', 'Caio', 'Dora']);
  });

  it('lista vazia -> ninguem presente', () => {
    expect(calcularPresenca([])).toEqual({ total: 0, porFilial: [], presentes: [] });
  });
});
