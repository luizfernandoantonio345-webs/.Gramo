import { apiPost } from '../lib/api';
import { listarPendentes, removerSincronizados, type ItemFilaPonto } from './fila-ponto';

interface ResultadoSync {
  uuidIdempotencia: string;
  resultado: string;
}

/** Converte null -> undefined para respeitar os campos opcionais do DTO. */
function paraPayload(item: ItemFilaPonto) {
  return {
    uuidIdempotencia: item.uuidIdempotencia,
    tipo: item.tipo,
    capturadoEm: item.capturadoEm,
    latitude: item.latitude ?? undefined,
    longitude: item.longitude ?? undefined,
    precisaoMetros: item.precisaoMetros ?? undefined,
    fotoBase64: item.fotoBase64 ?? undefined,
    justificativa: item.justificativa ?? undefined,
  };
}

/**
 * Envia a fila local ao servidor. Remove da fila os itens ACEITOS (inclui
 * ACEITO_DUPLICADO -- reenvio idempotente e seguro). Itens rejeitados
 * permanecem para nova tentativa.
 */
export async function sincronizarFila(): Promise<{ enviados: number; pendentes: number }> {
  const pendentes = await listarPendentes();
  if (pendentes.length === 0) return { enviados: 0, pendentes: 0 };

  const resp = await apiPost<{ resultados: ResultadoSync[] }>(
    '/pontos/sync',
    { registros: pendentes.map(paraPayload) },
    true,
  );
  const aceitos = resp.resultados
    .filter((r) => r.resultado === 'ACEITO' || r.resultado === 'ACEITO_DUPLICADO')
    .map((r) => r.uuidIdempotencia);
  await removerSincronizados(aceitos);
  return { enviados: aceitos.length, pendentes: pendentes.length - aceitos.length };
}
