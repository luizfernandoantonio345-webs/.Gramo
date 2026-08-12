// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiPost, definirSessao, limparSessao, sessaoAtual } from './api';

function resp(init: { ok: boolean; status: number; json?: unknown; text?: string }): Response {
  return {
    ok: init.ok,
    status: init.status,
    json: async () => init.json,
    text: async () => init.text ?? '',
  } as unknown as Response;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('sessao', () => {
  it('define, le e limpa a sessao', () => {
    expect(sessaoAtual()).toBeNull();

    definirSessao({ accessToken: 'acc', refreshToken: 'ref', expiresIn: 900 }, 'admin');
    expect(sessaoAtual()).toBe('admin');

    limparSessao();
    expect(sessaoAtual()).toBeNull();
  });

  it('sem access token nao ha sessao (mesmo com contexto)', () => {
    localStorage.setItem('repp_contexto', 'funcionario');
    expect(sessaoAtual()).toBeNull();
  });
});

describe('apiPost', () => {
  it('retorna o JSON no sucesso', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(resp({ ok: true, status: 200, json: { id: 7 } })),
    );

    const r = await apiPost<{ id: number }>('/x', { a: 1 });
    expect(r).toEqual({ id: 7 });
  });

  it('retorna undefined no 204 (sem corpo)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resp({ ok: true, status: 204 })));

    const r = await apiPost('/x', {});
    expect(r).toBeUndefined();
  });

  it('lanca ApiError juntando mensagens de array (class-validator)', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          resp({ ok: false, status: 400, text: JSON.stringify({ message: ['erro a', 'erro b'] }) }),
        ),
    );

    await expect(apiPost('/x', {})).rejects.toMatchObject({
      constructor: ApiError,
      status: 400,
      message: 'erro a erro b',
    });
  });

  it('lanca ApiError com corpo nao-JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(resp({ ok: false, status: 500, text: 'Internal Error' })),
    );

    await expect(apiPost('/x', {})).rejects.toMatchObject({
      status: 500,
      message: 'Internal Error',
    });
  });
});
