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

function sobreposicao(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

/**
 * Minutos noturnos de um intervalo expresso em MINUTOS-DO-DIA (0..1440), no fuso
 * da filial — casa com o modelo do banco de horas. A janela 22h-5h e tratada como
 * [22:00,24:00) + [00:00,05:00) DENTRO do dia. (Turnos que cruzam a meia-noite sao
 * pares em dias distintos no modelo atual — limitacao pre-existente do banco.)
 */
export function minutosNoturnosMinDia(entradaMin: number, saidaMin: number): number {
  if (saidaMin <= entradaMin) return 0;
  return (
    sobreposicao(entradaMin, saidaMin, NOTURNO_INICIO_MIN, 24 * 60) +
    sobreposicao(entradaMin, saidaMin, 0, NOTURNO_FIM_MIN)
  );
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
