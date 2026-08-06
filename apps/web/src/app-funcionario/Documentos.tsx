import { useCallback, useEffect, useState } from 'react';
import { Badge, Cartao, EstadoVazio, Feedback } from '../design-system/components';
import { apiGet, apiPost, lerArquivoBase64 } from '../lib/api';

type TomFeedback = 'sucesso' | 'erro' | 'aviso' | 'info';

interface DocExigido {
  tipo: string;
  rotulo: string;
  documentoId: string | null;
  status: string;
  motivoRejeicao: string | null;
  dataValidade: string | null;
}

const CORES: Record<string, string> = {
  PENDENTE: 'var(--color-amber-warning)',
  EM_ANALISE: 'var(--color-accent)',
  APROVADO: 'var(--color-teal-success)',
  REJEITADO: 'var(--color-red-alert)',
  VENCIDO: 'var(--color-red-alert)',
};
const ROTULO: Record<string, string> = {
  PENDENTE: 'pendente',
  EM_ANALISE: 'em análise',
  APROVADO: 'aprovado',
  REJEITADO: 'rejeitado',
  VENCIDO: 'vencido',
};

/** Tela 4 -- Documentacao Necessaria. Envio e status por documento. */
export function Documentos() {
  const [docs, setDocs] = useState<DocExigido[]>([]);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tom: TomFeedback; texto: string } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setDocs(await apiGet<DocExigido[]>('/documentos'));
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

  async function enviar(tipo: string, file: File) {
    setFeedback(null);
    setEnviando(tipo);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Arquivo excede 10MB.');
      const arquivoBase64 = await lerArquivoBase64(file);
      await apiPost(
        '/documentos',
        { tipo, arquivoBase64, nomeArquivo: file.name, mime: file.type },
        true,
      );
      setFeedback({ tom: 'sucesso', texto: 'Documento enviado para análise.' });
      await carregar();
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao enviar.' });
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ font: '700 24px var(--font-display)', marginTop: 0 }}>Documentação</h1>

      {feedback && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Feedback tom={feedback.tom}>{feedback.texto}</Feedback>
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
          <EstadoVazio>Nenhum documento exigido no momento.</EstadoVazio>
        </Cartao>
      ) : (
        docs.map((d) => (
          <div key={d.tipo} style={{ marginBottom: 'var(--space-3)' }}>
            <Cartao>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <strong style={{ font: '600 15px var(--font-body)' }}>{d.rotulo}</strong>
                <Badge cor={CORES[d.status] ?? 'var(--color-border)'}>
                  {ROTULO[d.status] ?? d.status.toLowerCase()}
                </Badge>
              </div>
              {d.motivoRejeicao && (
                <p style={{ color: 'var(--color-red-alert)', font: '400 13px var(--font-body)' }}>
                  Rejeitado: {d.motivoRejeicao}
                </p>
              )}
              {d.dataValidade && (
                <p style={{ font: '12px var(--font-mono)', color: 'var(--color-text-muted)' }}>
                  Validade: {new Date(d.dataValidade).toLocaleDateString('pt-BR')}
                </p>
              )}
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 44,
                  marginTop: 'var(--space-2)',
                  padding: '0 var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-accent)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-accent)',
                  cursor: enviando === d.tipo ? 'wait' : 'pointer',
                  font: '600 13px var(--font-body)',
                }}
              >
                {enviando === d.tipo
                  ? 'Enviando…'
                  : d.documentoId
                    ? 'Reenviar arquivo'
                    : 'Enviar arquivo'}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  style={{ display: 'none' }}
                  disabled={enviando === d.tipo}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void enviar(d.tipo, f);
                  }}
                />
              </label>
            </Cartao>
          </div>
        ))
      )}
    </div>
  );
}
