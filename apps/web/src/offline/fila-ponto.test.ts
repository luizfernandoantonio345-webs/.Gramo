import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  contarPendentes,
  enfileirar,
  listarPendentes,
  removerSincronizados,
  type ItemFilaPonto,
} from './fila-ponto';

function item(uuid: string, capturadoEm: string): ItemFilaPonto {
  return {
    uuidIdempotencia: uuid,
    tipo: 'ENTRADA',
    capturadoEm,
    latitude: null,
    longitude: null,
    precisaoMetros: null,
    fotoBase64: null,
    justificativa: null,
  };
}

afterEach(async () => {
  const uuids = (await listarPendentes()).map((i) => i.uuidIdempotencia);
  await removerSincronizados(uuids);
});

describe('fila-ponto (IndexedDB offline)', () => {
  it('enfileira e conta a marcacao', async () => {
    await enfileirar(item('a', '2026-08-11T10:00:00.000Z'));

    expect(await contarPendentes()).toBe(1);
    expect((await listarPendentes())[0]?.uuidIdempotencia).toBe('a');
  });

  it('put idempotente: mesmo uuid nao duplica', async () => {
    await enfileirar(item('a', '2026-08-11T10:00:00.000Z'));
    await enfileirar(item('a', '2026-08-11T10:00:00.000Z'));

    expect(await contarPendentes()).toBe(1);
  });

  it('lista pendentes ordenados por capturadoEm', async () => {
    await enfileirar(item('c', '2026-08-11T12:00:00.000Z'));
    await enfileirar(item('a', '2026-08-11T08:00:00.000Z'));
    await enfileirar(item('b', '2026-08-11T10:00:00.000Z'));

    const ordem = (await listarPendentes()).map((i) => i.uuidIdempotencia);
    expect(ordem).toEqual(['a', 'b', 'c']);
  });

  it('remove apenas os sincronizados e mantem o resto', async () => {
    await enfileirar(item('a', '2026-08-11T08:00:00.000Z'));
    await enfileirar(item('b', '2026-08-11T09:00:00.000Z'));
    await enfileirar(item('c', '2026-08-11T10:00:00.000Z'));

    await removerSincronizados(['a', 'c']);

    const restantes = (await listarPendentes()).map((i) => i.uuidIdempotencia);
    expect(restantes).toEqual(['b']);
    expect(await contarPendentes()).toBe(1);
  });
});
