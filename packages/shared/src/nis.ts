/**
 * NIS (Numero de Identificacao Social) -- cobre PIS (setor privado) e PASEP
 * (setor publico). 11 digitos, com digito verificador por modulo 11.
 * Portaria 671/2021: o identificador do empregado no AFD tipo 7 eh o NIS.
 */

export function soDigitosNis(v: string): string {
  return (v ?? '').replace(/\D/g, '').slice(0, 11);
}

export function formatarNis(v: string): string {
  const d = soDigitosNis(v);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 8) return `${d.slice(0, 3)}.${d.slice(3, 5)}.${d.slice(5)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}.${d.slice(3, 5)}.${d.slice(5, 8)}.${d.slice(8)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 5)}.${d.slice(5, 8)}.${d.slice(8, 10)}-${d.slice(10)}`;
}

/** Valida NIS/PIS/PASEP (11 digitos, digito verificador modulo 11). */
export function isNisValido(v: string): boolean {
  const d = soDigitosNis(v);
  if (d.length !== 11) return false;
  // NIS com todos os digitos iguais e invalido.
  if (/^(\d)\1{10}$/.test(d)) return false;

  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = pesos.reduce((acc, p, i) => acc + Number(d[i]) * p, 0);
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv === Number(d[10]);
}
