/**
 * Dinheiro em centavos (inteiro) para evitar erros de ponto flutuante.
 * Toda persistencia de valor monetario usa centavos.
 */
export function formatarBRL(centavos: number): string {
  const valor = (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  return valor;
}

/** Converte "1234.56" ou "1234,56" (reais) para centavos inteiros. */
export function reaisParaCentavos(reais: string | number): number {
  const n = typeof reais === 'number' ? reais : Number(String(reais).replace(',', '.'));
  return Math.round(n * 100);
}
