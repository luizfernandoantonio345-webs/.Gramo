/**
 * Geracao de CSV — puro, sem deps, testavel. Separador padrao ';' (Excel pt-BR
 * usa ';' e reserva ',' para decimal). Escapa aspas, separador e quebras de linha.
 * Para abrir com acentuacao correta no Excel, prefixe o arquivo com BOM UTF-8
 * (no ponto de download / na borda da API), nao aqui.
 */
export type CampoCsv = string | number | boolean | null | undefined;

function escaparCampo(v: CampoCsv, sep: string): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (s.includes('"') || s.includes(sep) || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Monta o texto CSV a partir de um cabecalho e das linhas (CRLF entre linhas). */
export function montarCsv(cabecalho: string[], linhas: CampoCsv[][], sep = ';'): string {
  const formatarLinha = (campos: CampoCsv[]) => campos.map((c) => escaparCampo(c, sep)).join(sep);
  return [formatarLinha(cabecalho), ...linhas.map(formatarLinha)].join('\r\n');
}

/** BOM UTF-8: garante acentuacao correta ao abrir no Excel. */
export const BOM_UTF8 = '﻿';
