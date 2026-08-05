/**
 * Adicional noturno (CLT art. 73). Puro e testavel.
 *
 * - Janela noturna urbana: **22:00 as 05:00**.
 * - **Hora noturna reduzida** (art. 73 §1): a hora noturna vale 52min30s; logo os
 *   minutos-relogio trabalhados a noite sao convertidos para minutos "legais"
 *   pelo fator 60/52,5.
 * - Adicional minimo de **20%** sobre as horas noturnas (a CCT pode ser maior).
 *
 * O calculo por minuto (jornada tipica < 24h) e proposital: legivel e obviamente
 * correto, rodado uma vez por dia na folha -- nao e caminho quente.
 */
const NOTURNO_INICIO_MIN = 22 * 60; // 22:00
const NOTURNO_FIM_MIN = 5 * 60; // 05:00
const FATOR_HORA_REDUZIDA = 60 / 52.5; // ~1,142857
export const ADICIONAL_NOTURNO_PADRAO = 0.2; // 20%

/** Minutos-relogio trabalhados dentro da janela noturna (22h-5h) num intervalo. */
export function minutosNoturnos(entrada: Date, saida: Date): number {
  if (saida <= entrada) return 0;
  let noturnos = 0;
  const cursor = new Date(entrada);
  while (cursor < saida) {
    const min = cursor.getHours() * 60 + cursor.getMinutes();
    if (min >= NOTURNO_INICIO_MIN || min < NOTURNO_FIM_MIN) noturnos++;
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return noturnos;
}

/** Converte minutos-relogio noturnos em minutos legais (hora reduzida 52min30s). */
export function minutosNoturnosReduzidos(minutosRelogio: number): number {
  return Math.round(minutosRelogio * FATOR_HORA_REDUZIDA);
}

/** Resumo do adicional noturno de um intervalo trabalhado. */
export function resumoNoturno(entrada: Date, saida: Date, percentual = ADICIONAL_NOTURNO_PADRAO) {
  const minutosRelogio = minutosNoturnos(entrada, saida);
  const minutosLegais = minutosNoturnosReduzidos(minutosRelogio);
  return {
    minutosRelogio,
    minutosLegais,
    percentualAdicional: percentual,
    // Minutos "extras" gerados pelo adicional (base de calculo do acrescimo).
    minutosAdicional: Math.round(minutosLegais * percentual),
  };
}
