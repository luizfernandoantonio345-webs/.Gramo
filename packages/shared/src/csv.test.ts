import { describe, expect, it } from 'vitest';
import { montarCsv } from './csv';

describe('montarCsv', () => {
  it('monta cabecalho + linhas com separador ; e CRLF', () => {
    const csv = montarCsv(
      ['Nome', 'Total'],
      [
        ['Ana', 3],
        ['Bruno', 5],
      ],
    );
    expect(csv).toBe('Nome;Total\r\nAna;3\r\nBruno;5');
  });

  it('escapa campos com separador, aspas e quebra de linha', () => {
    const csv = montarCsv(['Campo'], [['a;b'], ['diz "oi"'], ['linha1\nlinha2']]);
    expect(csv).toBe('Campo\r\n"a;b"\r\n"diz ""oi"""\r\n"linha1\nlinha2"');
  });

  it('trata null/undefined como vazio', () => {
    expect(montarCsv(['A', 'B'], [[null, undefined]])).toBe('A;B\r\n;');
  });
});
