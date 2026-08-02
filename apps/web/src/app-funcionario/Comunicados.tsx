import { useCallback, useEffect, useState } from 'react';
import { Badge, Cartao } from '../design-system/components';
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

  const carregar = useCallback(async () => {
    try {
      setLista(await apiGet<Comunicado[]>('/comunicados'));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
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
        /* ignora */
      }
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ font: '700 22px var(--font-display)' }}>Comunicados</h1>
      {erro && <Badge cor="var(--color-red-alert)">{erro}</Badge>}
      {lista.length === 0 && <p style={{ color: '#5b6472' }}>Nenhum comunicado.</p>}
      {lista.map((c) => (
        <div key={c.id} style={{ marginBottom: 'var(--space-2)' }}>
          <Cartao>
            <div onClick={() => abrir(c)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <strong>{c.titulo}</strong>
                <div style={{ font: '11px var(--font-mono)', color: '#5b6472' }}>
                  {new Date(c.criadoEm).toLocaleString('pt-BR')}
                </div>
              </div>
              {!c.lido && <Badge cor="var(--color-accent)">novo</Badge>}
            </div>
            {aberto === c.id && (
              <p style={{ font: '400 14px var(--font-body)', marginTop: 'var(--space-2)', whiteSpace: 'pre-wrap' }}>
                {c.mensagem}
              </p>
            )}
          </Cartao>
        </div>
      ))}
    </div>
  );
}
