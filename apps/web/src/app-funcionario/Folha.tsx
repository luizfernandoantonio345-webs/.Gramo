import { useCallback, useEffect, useState } from 'react';
import { Badge, Botao, Cartao } from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';

interface DocAssinatura {
  id: string;
  tipo: string;
  titulo: string;
  competencia: string | null;
  status: string;
}

interface Visualizacao {
  id: string;
  titulo: string;
  mime: string | null;
  podeBaixar: boolean;
  conteudoBase64: string;
}

const COR: Record<string, string> = {
  ENVIADO: 'var(--color-border)',
  VISUALIZADO: 'var(--color-amber-warning)',
  ASSINADO: 'var(--color-teal-success)',
  RECUSADO: 'var(--color-red-alert)',
};

/** Tela 2 -- Folha de Pagamento e Assinatura Virtual (funcionario). */
export function Folha() {
  const [docs, setDocs] = useState<DocAssinatura[]>([]);
  const [vis, setVis] = useState<Visualizacao | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setDocs(await apiGet<DocAssinatura[]>('/assinaturas'));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function visualizar(id: string) {
    setMsg(null);
    try {
      setVis(await apiGet<Visualizacao>(`/assinaturas/${id}/visualizar`));
      await carregar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao abrir.');
    }
  }

  async function assinar(id: string) {
    const senha = window.prompt('Confirme sua senha para assinar (irreversivel):');
    if (!senha) return;
    try {
      const r = await apiPost<{ hashAssinatura: string }>(`/assinaturas/${id}/assinar`, { senha }, true);
      setMsg(`Assinado. Hash: ${r.hashAssinatura.slice(0, 16)}...`);
      setVis(null);
      await carregar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao assinar.');
    }
  }

  async function recusar(id: string) {
    const motivo = window.prompt('Motivo da recusa:');
    if (!motivo) return;
    try {
      await apiPost(`/assinaturas/${id}/recusar`, { motivo }, true);
      setVis(null);
      await carregar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao recusar.');
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ font: '700 22px var(--font-display)' }}>Folha e assinaturas</h1>
      {msg && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Badge cor="var(--color-accent)">{msg}</Badge>
        </div>
      )}

      {vis && (
        <Cartao>
          <h2 style={{ font: '600 15px var(--font-display)', marginTop: 0 }}>{vis.titulo}</h2>
          <iframe
            title={vis.titulo}
            src={`data:${vis.mime ?? 'application/pdf'};base64,${vis.conteudoBase64}`}
            style={{ width: '100%', height: 380, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
          />
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
            <Botao onClick={() => assinar(vis.id)}>Assinar</Botao>
            <Botao variante="secundario" onClick={() => recusar(vis.id)}>
              Recusar
            </Botao>
          </div>
        </Cartao>
      )}

      <div style={{ height: 'var(--space-3)' }} />
      {docs.map((d) => (
        <div key={d.id} style={{ marginBottom: 'var(--space-2)' }}>
          <Cartao>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{d.titulo}</strong>
                <div style={{ font: '12px var(--font-mono)', color: '#5b6472' }}>
                  {d.tipo}
                  {d.competencia ? ` · ${d.competencia}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <Badge cor={COR[d.status] ?? 'var(--color-border)'}>{d.status}</Badge>
                {d.status !== 'RECUSADO' && (
                  <button
                    onClick={() => visualizar(d.id)}
                    style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer' }}
                  >
                    {d.status === 'ASSINADO' ? 'Ver' : 'Abrir'}
                  </button>
                )}
              </div>
            </div>
          </Cartao>
        </div>
      ))}
    </div>
  );
}
