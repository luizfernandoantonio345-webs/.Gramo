import { TipoMarcacao } from './enums';

/**
 * Avaliacao de horario/jornada de uma marcacao (ADM 7). Pura e testavel.
 *
 * REGRA INEGOCIAVEL: isto NUNCA bloqueia o registro -- apenas classifica se a
 * marcacao esta dentro do horario esperado. Fora do horario -> pendente de
 * validacao do RH (atraso / saida antecipada / dia fora de escala).
 */
export interface JornadaHorario {
  /** "HH:MM" (24h) do inicio esperado. */
  horaEntrada: string;
  /** "HH:MM" do fim esperado. */
  horaSaida: string;
  /** Minutos de tolerancia (atraso na entrada / saida antecipada). */
  toleranciaMinutos: number;
  /** Dias de escala (0=domingo ... 6=sabado, convencao Date.getDay). */
  diasSemana: number[];
}

/** Converte "HH:MM" em minutos desde a meia-noite. */
export function parseHoraMinutos(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

export interface ContextoHorario {
  tipo: TipoMarcacao;
  /** Minutos desde a meia-noite, no fuso da filial. */
  minutosDoDia: number;
  /** Dia da semana (0-6) no fuso da filial. */
  diaSemana: number;
  ehFeriado: boolean;
  jornada: JornadaHorario | null;
}

/**
 * Retorna true se a marcacao esta DENTRO do horario esperado (nao gera
 * pendencia de horario). Sem jornada, feriado ou marcacao de intervalo -> nao
 * avalia (considera dentro).
 */
export function dentroDoHorario(ctx: ContextoHorario): boolean {
  if (!ctx.jornada) return true;
  if (ctx.ehFeriado) return true;
  if (ctx.tipo === TipoMarcacao.INICIO_INTERVALO || ctx.tipo === TipoMarcacao.FIM_INTERVALO) {
    return true;
  }
  // Trabalho em dia fora da escala -> pendente.
  if (!ctx.jornada.diasSemana.includes(ctx.diaSemana)) return false;

  const tol = ctx.jornada.toleranciaMinutos;
  const entrada = parseHoraMinutos(ctx.jornada.horaEntrada);
  const saida = parseHoraMinutos(ctx.jornada.horaSaida);

  if (ctx.tipo === TipoMarcacao.ENTRADA) {
    // Atraso alem da tolerancia -> pendente (chegar cedo e permitido).
    return ctx.minutosDoDia <= entrada + tol;
  }
  if (ctx.tipo === TipoMarcacao.SAIDA) {
    // Saida antecipada alem da tolerancia -> pendente (sair tarde e permitido).
    return ctx.minutosDoDia >= saida - tol;
  }
  return true;
}
