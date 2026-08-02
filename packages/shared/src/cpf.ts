/**
 * Validacao de CPF (digito verificador) e normalizacao.
 *
 * Regra de negocio (Detalhamento de Telas, secao 4.1): CPF deve ter digito
 * verificador validado ANTES de qualquer gravacao, tanto no cadastro
 * individual quanto na importacao em lote. A unicidade e por empresa (tenant),
 * nao global -- essa regra vive no banco (indice unico composto), nao aqui.
 *
 * Esta funcao e compartilhada entre backend (NestJS) e frontend (PWA) para
 * garantir a MESMA regra dos dois lados, sem duplicacao.
 */

/** Remove tudo que nao for digito. */
export function normalizarCpf(entrada: string): string {
  return (entrada ?? '').replace(/\D/g, '');
}

/**
 * Aplica a mascara 000.000.000-00 progressivamente, formatando apenas os
 * digitos ja presentes (sem preencher com zeros durante a digitacao).
 */
export function formatarCpf(entrada: string): string {
  const d = normalizarCpf(entrada).slice(0, 11);
  let out = d.slice(0, 3);
  if (d.length > 3) out += `.${d.slice(3, 6)}`;
  if (d.length > 6) out += `.${d.slice(6, 9)}`;
  if (d.length > 9) out += `-${d.slice(9, 11)}`;
  return out;
}

function calcularDigito(base: string, pesoInicial: number): number {
  let soma = 0;
  let peso = pesoInicial;
  for (const ch of base) {
    soma += Number(ch) * peso;
    peso -= 1;
  }
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/**
 * Valida o CPF pelo digito verificador. Aceita string com ou sem mascara.
 * Rejeita: tamanho != 11, sequencias repetidas (000..., 111...) e DV incorreto.
 */
export function isCpfValido(entrada: string): boolean {
  const cpf = normalizarCpf(entrada);

  if (cpf.length !== 11) return false;
  // Sequencias como 00000000000 passariam no calculo de DV mas sao invalidas.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const dv1 = calcularDigito(cpf.slice(0, 9), 10);
  if (dv1 !== Number(cpf[9])) return false;

  const dv2 = calcularDigito(cpf.slice(0, 10), 11);
  if (dv2 !== Number(cpf[10])) return false;

  return true;
}
