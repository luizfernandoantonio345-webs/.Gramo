/**
 * Contrato de sincronizacao offline-first do registro de ponto.
 *
 * Requisito duro (prompt-mestre, secao 5): parte do time trabalha em campo sem
 * sinal. O client gera um UUID por marcacao (idempotencia) e enfileira em
 * IndexedDB; o servidor reconcilia no sync.
 *
 * Decisoes-chave refletidas aqui:
 *  - NSR NAO e gerado no client. E atribuido pelo SERVIDOR no sync (contador
 *    sequencial por estabelecimento, sem furos). Dois devices offline nao
 *    conseguem coordenar sequencia -- por isso o NSR e server-side.
 *  - Idempotencia: reenviar o mesmo `uuidIdempotencia` NUNCA cria duplicata;
 *    o servidor devolve o registro ja existente (ACEITO_DUPLICADO).
 *  - Hora: se capturado offline, `origemHora=DISPOSITIVO` e `capturadoEm` e a
 *    hora do aparelho (marcada como tal). Online, o servidor carimba a hora
 *    oficial.
 */

import type { OrigemHora, StatusValidacaoPonto, TipoMarcacao } from './enums';

/** Item da fila local (IndexedDB/Dexie), enviado no sync. */
export interface RegistroPontoOffline {
  /** UUID v4 gerado no client. Chave de idempotencia ponta-a-ponta. */
  uuidIdempotencia: string;
  funcionarioId: string;
  tipo: TipoMarcacao;
  /** ISO 8601 com offset. Hora do aparelho quando capturado offline. */
  capturadoEm: string;
  origemHora: OrigemHora;
  latitude: number | null;
  longitude: number | null;
  /** Precisao do GPS em metros, quando disponivel. */
  precisaoMetros: number | null;
  /** Referencia local da foto capturada (resolvida para upload no sync). */
  fotoRefLocal: string | null;
  /** Justificativa digitada pelo funcionario (aparece se fora da REGAP/horario). */
  justificativa: string | null;
}

/** Payload do POST /api/v1/pontos/sync (lote idempotente). */
export interface SyncPontosRequest {
  registros: RegistroPontoOffline[];
}

export enum ResultadoSyncItem {
  /** Criado agora no servidor. */
  ACEITO = 'ACEITO',
  /** Ja existia (mesmo uuidIdempotencia) -- reenvio seguro, sem duplicar. */
  ACEITO_DUPLICADO = 'ACEITO_DUPLICADO',
  /** Rejeitado por dados invalidos (raro; nunca por REGAP/horario/face). */
  REJEITADO = 'REJEITADO',
}

/** Resultado por item apos o servidor reconciliar e atribuir NSR. */
export interface SyncPontoResultado {
  uuidIdempotencia: string;
  resultado: ResultadoSyncItem;
  /** Preenchido quando ACEITO/ACEITO_DUPLICADO: NSR definitivo do servidor. */
  nsr: number | null;
  /** Id do registro persistido. */
  pontoId: string | null;
  statusValidacao: StatusValidacaoPonto | null;
  /** Hora oficial carimbada pelo servidor (ISO 8601). */
  registradoEm: string | null;
  /** Motivo, quando REJEITADO. */
  erro: string | null;
}

export interface SyncPontosResponse {
  resultados: SyncPontoResultado[];
}
