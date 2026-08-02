import { TipoMarcacao } from './enums';

/**
 * Deduz o proximo tipo de marcacao pela sequencia do dia (Tela 3 -- "seletor
 * automatico"). E apenas uma SUGESTAO; o registro nunca e bloqueado por isso.
 *
 * Ciclo: ENTRADA -> INICIO_INTERVALO -> FIM_INTERVALO -> SAIDA -> (novo) ENTRADA.
 */
export function proximoTipoMarcacao(tiposHoje: TipoMarcacao[]): TipoMarcacao {
  const ultimo = tiposHoje[tiposHoje.length - 1];
  switch (ultimo) {
    case undefined:
      return TipoMarcacao.ENTRADA;
    case TipoMarcacao.ENTRADA:
      return TipoMarcacao.INICIO_INTERVALO;
    case TipoMarcacao.INICIO_INTERVALO:
      return TipoMarcacao.FIM_INTERVALO;
    case TipoMarcacao.FIM_INTERVALO:
      return TipoMarcacao.SAIDA;
    case TipoMarcacao.SAIDA:
      return TipoMarcacao.ENTRADA;
    default:
      return TipoMarcacao.ENTRADA;
  }
}
