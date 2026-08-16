/**
 * Apuracao de valores da folha a partir das HORAS do periodo (competencia).
 * TRANSPARENTE e CONFIGURAVEL de proposito: percentuais entram por parametro
 * (nada fixo escondido), e o resultado discrimina cada parcela para o RH
 * conferir. NAO substitui a folha (imposto/INSS/FGTS sao do contador); entrega
 * as HORAS valoradas, prontas para a folha.
 *
 * Modelo (v1, simples e auditavel): cada adicional incide sobre o VALOR-HORA
 * base, mostrado em separado. Se a convencao (CCT) exigir que o adicional
 * componha a base da hora extra, e so ajustar aqui depois de confirmar com a
 * folha -- por isso os percentuais sao parametros.
 */
export interface ParametrosApuracao {
  /** Valor da hora normal do cargo, em R$ (ex.: 12.14). */
  valorHora: number;
  /** Adicional de hora extra sobre a base (ex.: 0.5 = 50%). */
  percentualExtra: number;
  /** Periculosidade/insalubridade sobre as horas trabalhadas (ex.: 0.3 = 30%). 0 se nao tem. */
  percentualPericulosidade: number;
  /** Adicional noturno sobre as horas noturnas (ex.: 0.2 = 20%). 0 se nao se aplica. */
  percentualNoturno: number;
}

export interface HorasApuradas {
  minutosNormais: number;
  minutosExtras: number;
  /** Minutos trabalhados na faixa noturna (para o adicional noturno). */
  minutosNoturnos: number;
}

export interface ParcelaValorada {
  horas: number; // horas decimais (para leitura)
  valor: number; // R$
}

export interface Apuracao {
  valorHora: number;
  normais: ParcelaValorada;
  extras: ParcelaValorada;
  /** Adicional de periculosidade sobre normais + extras (mostrado a parte). */
  adicionalPericulosidade: number;
  adicionalNoturno: ParcelaValorada;
  total: number;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;
const emHoras = (min: number): number => Math.round((min / 60) * 100) / 100;

/**
 * Valora as horas do periodo. Puro e testavel: nao toca em banco. Todas as
 * parcelas ficam discriminadas para conferencia do RH.
 */
export function apurarValores(h: HorasApuradas, p: ParametrosApuracao): Apuracao {
  const hn = h.minutosNormais / 60;
  const he = h.minutosExtras / 60;
  const hnot = h.minutosNoturnos / 60;

  const valorNormais = hn * p.valorHora;
  const valorExtras = he * p.valorHora * (1 + p.percentualExtra);
  const adicionalPericulosidade = (hn + he) * p.valorHora * p.percentualPericulosidade;
  const valorNoturno = hnot * p.valorHora * p.percentualNoturno;

  return {
    valorHora: p.valorHora,
    normais: { horas: emHoras(h.minutosNormais), valor: r2(valorNormais) },
    extras: { horas: emHoras(h.minutosExtras), valor: r2(valorExtras) },
    adicionalPericulosidade: r2(adicionalPericulosidade),
    adicionalNoturno: { horas: emHoras(h.minutosNoturnos), valor: r2(valorNoturno) },
    total: r2(valorNormais + valorExtras + adicionalPericulosidade + valorNoturno),
  };
}
