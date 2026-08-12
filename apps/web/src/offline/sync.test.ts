import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ItemFilaPonto } from './fila-ponto';

// Mocks dos modulos de I/O: a logica de sincronizacao e pura e testavel sem
// rede nem IndexedDB.
const listarPendentes = vi.fn<() => Promise<ItemFilaPonto[]>>();
const removerSincronizados = vi.fn<(uuids: string[]) => Promise<void>>();
const apiPost = vi.fn();

vi.mock('./fila-ponto', () => ({
  listarPendentes: () => listarPendentes(),
  removerSincronizados: (uuids: string[]) => removerSincronizados(uuids),
}));
vi.mock('../lib/api', () => ({
  apiPost: (path: string, body: unknown, comAuth?: boolean) => apiPost(path, body, comAuth),
}));

const { sincronizarFila } = await import('./sync');

function item(uuid: string, over: Partial<ItemFilaPonto> = {}): ItemFilaPonto {
  return {
    uuidIdempotencia: uuid,
    tipo: 'ENTRADA',
    capturadoEm: '2026-08-11T10:00:00.000Z',
    latitude: null,
    longitude: null,
    precisaoMetros: null,
    fotoBase64: null,
    justificativa: null,
    ...over,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('sincronizarFila', () => {
  it('nao chama a API quando a fila esta vazia', async () => {
    listarPendentes.mockResolvedValue([]);

    const r = await sincronizarFila();

    expect(r).toEqual({ enviados: 0, pendentes: 0 });
    expect(apiPost).not.toHaveBeenCalled();
    expect(removerSincronizados).not.toHaveBeenCalled();
  });

  it('remove os ACEITOS e mantem os rejeitados', async () => {
    listarPendentes.mockResolvedValue([item('a'), item('b'), item('c')]);
    apiPost.mockResolvedValue({
      resultados: [
        { uuidIdempotencia: 'a', resultado: 'ACEITO' },
        { uuidIdempotencia: 'b', resultado: 'REJEITADO' },
        { uuidIdempotencia: 'c', resultado: 'ACEITO' },
      ],
    });

    const r = await sincronizarFila();

    expect(removerSincronizados).toHaveBeenCalledWith(['a', 'c']);
    expect(r).toEqual({ enviados: 2, pendentes: 1 });
  });

  it('trata ACEITO_DUPLICADO como aceito (reenvio idempotente)', async () => {
    listarPendentes.mockResolvedValue([item('a')]);
    apiPost.mockResolvedValue({
      resultados: [{ uuidIdempotencia: 'a', resultado: 'ACEITO_DUPLICADO' }],
    });

    const r = await sincronizarFila();

    expect(removerSincronizados).toHaveBeenCalledWith(['a']);
    expect(r).toEqual({ enviados: 1, pendentes: 0 });
  });

  it('converte null -> undefined no payload enviado (respeita o DTO opcional)', async () => {
    listarPendentes.mockResolvedValue([
      item('a', { latitude: -19.97, longitude: -44.09, precisaoMetros: 12 }),
    ]);
    apiPost.mockResolvedValue({ resultados: [{ uuidIdempotencia: 'a', resultado: 'ACEITO' }] });

    await sincronizarFila();

    const call = apiPost.mock.calls[0];
    expect(call).toBeDefined();
    const [path, body, comAuth] = call!;
    expect(path).toBe('/pontos/sync');
    expect(comAuth).toBe(true);
    const registro = (body as { registros: Record<string, unknown>[] }).registros[0]!;
    expect(registro.latitude).toBe(-19.97);
    expect(registro.fotoBase64).toBeUndefined();
    expect(registro.justificativa).toBeUndefined();
    expect('fotoBase64' in registro).toBe(true); // presente, porem undefined
  });
});
