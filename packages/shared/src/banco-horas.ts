import { TipoMarcacao } from './enums';

/**
 * Banco de horas (ADM 4/ADM 7). Puro e testavel. Emparelha as marcacoes do dia
 * para calcular horas trabalhadas (liquidas) e intervalo. Marcacoes "esquecidas"
 * (par incompleto) sao ignoradas no calculo -- ficam como pendencia do RH.
 */
export interface MarcacaoDia {
  tipo: TipoMarcacao;
  /** Minutos desde a meia-noite (no fuso da filial). */
  minutosDoDia: number;
}

export interface HorasDia {
  /** Minutos trabalhados liquidos (bruto menos intervalos). */
  trabalhadoMin: number;
  intervaloMin: number;
}

export function calcularHorasDia(marcacoes: MarcacaoDia[]): HorasDia {
  const ord = [...marcacoes].sort((a, b) => a.minutosDoDia - b.minutosDoDia);
  let bruto = 0;
  let intervalo = 0;
  let entrada: number | null = null;
  let inicioInt: number | null = null;

  for (const m of ord) {
    switch (m.tipo) {
      case TipoMarcacao.ENTRADA:
        entrada = m.minutosDoDia;
        break;
      case TipoMarcacao.SAIDA:
        if (entrada !== null) {
          bruto += m.minutosDoDia - entrada;
          entrada = null;
        }
        break;
      case TipoMarcacao.INICIO_INTERVALO:
        inicioInt = m.minutosDoDia;
        break;
      case TipoMarcacao.FIM_INTERVALO:
        if (inicioInt !== null) {
          intervalo += m.minutosDoDia - inicioInt;
          inicioInt = null;
        }
        break;
    }
  }
  return { trabalhadoMin: Math.max(0, bruto - intervalo), intervaloMin: intervalo };
}

/** Saldo do dia (minutos) = trabalhado - carga esperada. Null se sem carga. */
export function saldoDia(trabalhadoMin: number, cargaDiariaMin: number | null): number | null {
  if (cargaDiariaMin === null) return null;
  return trabalhadoMin - cargaDiariaMin;
}

/** Formata minutos (com sinal) em "HH:MM" / "-HH:MM". */
export function formatarMinutos(min: number): string {
  const sinal = min < 0 ? '-' : '';
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sinal}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
