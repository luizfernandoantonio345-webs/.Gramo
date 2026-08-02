/**
 * Regras puras de ausencia (ADM 10). Comparacao de datas por string ISO
 * (YYYY-MM-DD), que e ordenavel lexicograficamente -- evita armadilhas de fuso.
 */

/** Extrai YYYY-MM-DD de um ISO (ou de um Date via toISOString). */
export function soData(iso: string): string {
  return iso.slice(0, 10);
}

/** True se `data` esta no intervalo [inicio, fim], inclusive (datas YYYY-MM-DD). */
export function dataNoIntervalo(data: string, inicio: string, fim: string): boolean {
  const d = soData(data);
  return d >= soData(inicio) && d <= soData(fim);
}

/** Valida que o periodo e coerente (inicio <= fim). */
export function periodoValido(inicio: string, fim: string): boolean {
  return soData(inicio) <= soData(fim);
}
