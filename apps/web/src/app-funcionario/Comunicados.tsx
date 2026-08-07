import { useCallback, useEffect, useState } from 'react';
import { Badge, Cartao, EstadoVazio, Feedback } from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';

interface Comunicado {
  id: string;
  titulo: string;
  mensagem: string;
  criadoEm: string;
  lido: boolean;
}

/** Funcionario -- comunicados da empresa (marca leitura ao abrir). */
export function Comunicados() {
  const [lista, setLista] = useState<Comunicado[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      setLista(await apiGet<Comunicado[]>('/comunicados'));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar comunicados.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function abrir(c: Comunicado) {
    setAberto(aberto === c.id ? null : c.id);
    if (!c.lido) {
      try {
        await apiPost(`/comunicados/${c.id}/lido`, {}, true);
        setLista((l) => l.map((x) => (x.id === c.id ? { ...x, lido: true } : x)));
      } catch {
        /* ignora: marcar leitura nao e critico */
      }
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ font: '700 24px var(--font-display)', marginTop: 0 }}>Comunicados</h1>

      {erro && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}

      {carregando ? (
        <Cartao>
          <EstadoVazio>Carregando comunicados…</EstadoVazio>
        </Cartao>
      ) : lista.length === 0 ? (
        <Cartao>
          <EstadoVazio>Nenhum comunicado por enquanto.</EstadoVazio>
        </Cartao>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {lista.map((c) => {
            const expandido = aberto === c.id;
            return (
              <li key={c.id} style={{ marginBottom: 'var(--space-2)' }}>
                <Cartao>
                  <button
                    onClick={() => abrir(c)}
                    aria-expanded={expandido}
                    style={{
                      display: 'flex',
                      width: '100%',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      minHeight: 44,
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>
                      <strong style={{ font: `${c.lido ? 500 : 700} 15px var(--font-body)` }}>
                        {c.titulo}
                      </strong>
                      <span
                        style={{
                          display: 'block',
                          font: '11px var(--font-mono)',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        {new Date(c.criadoEm).toLocaleString('pt-BR')}
                      </span>
                    </span>
                    {!c.lido && <Badge cor="var(--color-accent)">novo</Badge>}
                  </button>
                  {expandido && (
                    <p
                      style={{
                        font: '400 14px var(--font-body)',
                        lineHeight: 1.5,
                        marginTop: 'var(--space-2)',
                        marginBottom: 0,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {c.mensagem}
                    </p>
                  )}
                </Cartao>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
