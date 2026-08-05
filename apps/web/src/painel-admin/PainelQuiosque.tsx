import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  EstadoVazio,
  Feedback,
  Selecao,
} from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';

interface FilialRef {
  id: string;
  nome: string;
}
interface Dispositivo {
  id: string;
  nome: string;
  filialId: string;
  ativo: boolean;
  ultimoUsoEm: string | null;
  criadoEm: string;
}

/** ADM -- Modo Quiosque: cadastro de dispositivos (tablet na portaria). */
export function PainelQuiosque() {
  const [filiais, setFiliais] = useState<FilialRef[]>([]);
  const [lista, setLista] = useState<Dispositivo[]>([]);
  const [nome, setNome] = useState('');
  const [filialId, setFilialId] = useState('');
  const [tokenNovo, setTokenNovo] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const [d, f] = await Promise.all([
        apiGet<Dispositivo[]>('/admin/kiosk'),
        apiGet<FilialRef[]>('/admin/configuracoes/filiais'),
      ]);
      setLista(d);
      setFiliais(f);
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao carregar.' });
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  const nomeFilial = (id: string) => filiais.find((f) => f.id === id)?.nome ?? id;

  async function criar() {
    setFeedback(null);
    setTokenNovo(null);
    try {
      const r = await apiPost<{ id: string; token: string }>(
        '/admin/kiosk',
        { nome, filialId },
        true,
      );
      setTokenNovo(r.token);
      setNome('');
      await carregar();
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao cadastrar.' });
    }
  }

  async function revogar(id: string) {
    if (!window.confirm('Revogar este dispositivo? Ele para de registrar imediatamente.')) return;
    await apiPost(`/admin/kiosk/${id}/revogar`, {}, true);
    await carregar();
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-4)' }}>
      <CabecalhoPagina
        titulo="Quiosque"
        subtitulo="Tablets fixos na portaria que registram ponto por CPF (para quem não tem celular)"
      />
      {feedback && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Feedback tom={feedback.tom}>{feedback.texto}</Feedback>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <Cartao>
          <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Novo quiosque</h2>
          <Campo
            label="Nome (ex.: Portaria Matriz)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Selecao label="Filial" value={filialId} onChange={(e) => setFilialId(e.target.value)}>
            <option value="">Selecione…</option>
            {filiais.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Selecao>
          <Botao onClick={criar} disabled={!nome || !filialId}>
            Gerar dispositivo
          </Botao>
          {tokenNovo && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <Feedback tom="sucesso">
                Token do dispositivo (copie agora — não será exibido de novo). No tablet, abra{' '}
                <code style={{ font: '12px var(--font-mono)' }}>/?modo=quiosque</code> e cole:
                <br />
                <code style={{ font: '12px var(--font-mono)', wordBreak: 'break-all' }}>
                  {tokenNovo}
                </code>
              </Feedback>
            </div>
          )}
        </Cartao>

        <Cartao>
          <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Dispositivos</h2>
          {carregando ? (
            <EstadoVazio>Carregando…</EstadoVazio>
          ) : lista.length === 0 ? (
            <EstadoVazio>Nenhum quiosque cadastrado.</EstadoVazio>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {lista.map((d) => (
                <li
                  key={d.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) 0',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <div>
                    <strong style={{ font: '600 14px var(--font-body)' }}>{d.nome}</strong>
                    <div style={{ font: '11px var(--font-mono)', color: '#5b6472' }}>
                      {nomeFilial(d.filialId)} ·{' '}
                      {d.ultimoUsoEm
                        ? `último uso ${new Date(d.ultimoUsoEm).toLocaleString('pt-BR')}`
                        : 'nunca usado'}
                    </div>
                  </div>
                  {d.ativo ? (
                    <button
                      onClick={() => revogar(d.id)}
                      style={{
                        minHeight: 44,
                        padding: '0 var(--space-3)',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        background: 'var(--color-red-alert)',
                        color: '#fff',
                        cursor: 'pointer',
                        font: '600 12px var(--font-body)',
                      }}
                    >
                      Revogar
                    </button>
                  ) : (
                    <Badge cor="var(--color-border)">revogado</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </div>
  );
}
