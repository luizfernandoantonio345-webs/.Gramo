import Dexie, { type Table } from 'dexie';

/**
 * Fila local de marcacoes (offline-first). Quando nao ha rede, a marcacao e
 * gravada aqui (IndexedDB) e sincronizada depois. A chave e o uuidIdempotencia
 * gerado no client -> reenvio nunca duplica no servidor.
 */
export interface ItemFilaPonto {
  uuidIdempotencia: string;
  tipo: string;
  capturadoEm: string; // ISO 8601 (hora do dispositivo)
  latitude: number | null;
  longitude: number | null;
  precisaoMetros: number | null;
  fotoBase64: string | null;
  justificativa: string | null;
}

class ReppDb extends Dexie {
  marcacoes!: Table<ItemFilaPonto, string>;

  constructor() {
    super('repp-offline');
    this.version(1).stores({ marcacoes: '&uuidIdempotencia, capturadoEm' });
  }
}

const db = new ReppDb();

export async function enfileirar(item: ItemFilaPonto): Promise<void> {
  await db.marcacoes.put(item);
}

export async function listarPendentes(): Promise<ItemFilaPonto[]> {
  return db.marcacoes.orderBy('capturadoEm').toArray();
}

export async function removerSincronizados(uuids: string[]): Promise<void> {
  await db.marcacoes.bulkDelete(uuids);
}

export async function contarPendentes(): Promise<number> {
  return db.marcacoes.count();
}
