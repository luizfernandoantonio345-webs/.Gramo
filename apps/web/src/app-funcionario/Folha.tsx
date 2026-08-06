import { useCallback, useEffect, useState } from 'react';
import { Badge, Botao, Cartao, EstadoVazio, Feedback } from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';

type TomFeedback = 'sucesso' | 'erro' | 'aviso' | 'info';

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
  ENVIADO: 'var(--color-amber-warning)',
  VISUALIZADO: 'var(--color-accent)',
  ASSINADO: 'var(--color-teal-success)',
  RECUSADO: 'var(--color-red-alert)',
};
const ROTULO_STATUS: Record<string, string> = {
  ENVIADO: 'aguardando',
  VISUALIZADO: 'visualizado',
  ASSINADO: 'assinado',
  RECUSADO: 'recusado',
};

/** Tela 2 -- Folha de Pagamento e Assinatura Virtual (funcionario). */
export function Folha() {
  const [docs, setDocs] = useState<DocAssinatura[]>([]);
  const [vis, setVis] = useState<Visualizacao | null>(null);
  const [feedback, setFeedback] = useState<{ tom: TomFeedback; texto: string } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setDocs(await apiGet<DocAssinatura[]>('/assinaturas'));
      setErroCarga(null);
    } catch (e) {
      setErroCarga(e instanceof Error ? e.message : 'Falha ao carregar documentos.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function visualizar(id: string) {
    setFeedback(null);
    try {
      setVis(await apiGet<Visualizacao>(`/assinaturas/${id}/visualizar`));
      await carregar();
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao abrir.' });
    }
  }

  async function assinar(id: string) {
    const senha = window.prompt('Confirme sua senha para assinar (irreversível):');
    if (!senha) return;
    try {
      const r = await apiPost<{ hashAssinatura: string }>(
        `/assinaturas/${id}/assinar`,
        { senha },
        true,
      );
      setFeedback({
        tom: 'sucesso',
        texto: `Documento assinado. Comprovante: ${r.hashAssinatura.slice(0, 16)}…`,
      });
      setVis(null);
      await carregar();
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao assinar.' });
    }
  }

  async function recusar(id: string) {
    const motivo = window.prompt('Motivo da recusa:');
    if (!motivo) return;
    try {
      await apiPost(`/assinaturas/${id}/recusar`, { motivo }, true);
      setFeedback({ tom: 'aviso', texto: 'Documento recusado. O RH foi notificado.' });
      setVis(null);
      await carregar();
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao recusar.' });
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ font: '700 24px var(--font-display)', marginTop: 0 }}>Folha e assinaturas</h1>

      {feedback && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Feedback tom={feedback.tom}>{feedback.texto}</Feedback>
        </div>
      )}

      {vis && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Cartao>
            <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>{vis.titulo}</h2>
            <iframe
              title={vis.titulo}
              src={`data:${vis.mime ?? 'application/pdf'};base64,${vis.conteudoBase64}`}
              style={{
                width: '100%',
                height: 420,
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                background: '#fff',
              }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
              <Botao onClick={() => assinar(vis.id)}>Assinar</Botao>
              <Botao variante="secundario" onClick={() => recusar(vis.id)}>
                Recusar
              </Botao>
            </div>
            <p
              style={{
                font: '400 12px var(--font-body)',
                color: 'var(--color-text-muted)',
                margin: 'var(--space-2) 0 0',
              }}
            >
              A assinatura é irreversível e vale como aceite formal do documento.
            </p>
          </Cartao>
        </div>
      )}

      {carregando ? (
        <Cartao>
          <EstadoVazio>Carregando documentos…</EstadoVazio>
        </Cartao>
      ) : erroCarga ? (
        <Feedback tom="erro">{erroCarga}</Feedback>
      ) : docs.length === 0 ? (
        <Cartao>
          <EstadoVazio>Nenhum documento para assinar no momento.</EstadoVazio>
        </Cartao>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {docs.map((d) => (
            <li key={d.id} style={{ marginBottom: 'var(--space-2)' }}>
              <Cartao>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ font: '600 15px var(--font-body)' }}>{d.titulo}</strong>
                    <div
                      style={{ font: '12px var(--font-mono)', color: 'var(--color-text-muted)' }}
                    >
                      {d.tipo}
                      {d.competencia ? ` · ${d.competencia}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <Badge cor={COR[d.status] ?? 'var(--color-border)'}>
                      {ROTULO_STATUS[d.status] ?? d.status.toLowerCase()}
                    </Badge>
                    {d.status !== 'RECUSADO' && (
                      <button
                        onClick={() => visualizar(d.id)}
                        style={{
                          minHeight: 44,
                          padding: '0 var(--space-3)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-accent)',
                          background: 'var(--color-surface)',
                          color: 'var(--color-accent)',
                          font: '600 13px var(--font-body)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {d.status === 'ASSINADO' ? 'Ver comprovante' : 'Abrir e assinar'}
                      </button>
                    )}
                  </div>
                </div>
              </Cartao>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
