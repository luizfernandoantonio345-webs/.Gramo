import { useCallback, useEffect, useState } from 'react';
import { Badge, Cartao } from '../design-system/components';
import { apiGet, apiPost, lerArquivoBase64 } from '../lib/api';

interface DocExigido {
  tipo: string;
  rotulo: string;
  documentoId: string | null;
  status: string;
  motivoRejeicao: string | null;
  dataValidade: string | null;
}

const CORES: Record<string, string> = {
  PENDENTE: 'var(--color-border)',
  EM_ANALISE: 'var(--color-amber-warning)',
  APROVADO: 'var(--color-teal-success)',
  REJEITADO: 'var(--color-red-alert)',
  VENCIDO: 'var(--color-red-alert)',
};

/** Tela 4 -- Documentacao Necessaria. Envio e status por documento. */
export function Documentos() {
  const [docs, setDocs] = useState<DocExigido[]>([]);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setDocs(await apiGet<DocExigido[]>('/documentos'));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function enviar(tipo: string, file: File) {
    setMsg(null);
    setEnviando(tipo);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Arquivo excede 10MB.');
      const arquivoBase64 = await lerArquivoBase64(file);
      await apiPost('/documentos', { tipo, arquivoBase64, nomeArquivo: file.name, mime: file.type }, true);
      setMsg('Documento enviado para analise.');
      await carregar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao enviar.');
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ font: '700 22px var(--font-display)' }}>Documentacao</h1>
      {msg && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Badge cor="var(--color-accent)">{msg}</Badge>
        </div>
      )}

      {docs.map((d) => (
        <div key={d.tipo} style={{ marginBottom: 'var(--space-3)' }}>
          <Cartao>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ font: '600 14px var(--font-body)' }}>{d.rotulo}</strong>
              <Badge cor={CORES[d.status] ?? 'var(--color-border)'}>{d.status}</Badge>
            </div>
            {d.motivoRejeicao && (
              <p style={{ color: 'var(--color-red-alert)', font: '400 12px var(--font-body)' }}>
                Rejeitado: {d.motivoRejeicao}
              </p>
            )}
            {d.dataValidade && (
              <p style={{ font: '12px var(--font-mono)', color: '#5b6472' }}>
                Validade: {new Date(d.dataValidade).toLocaleDateString('pt-BR')}
              </p>
            )}
            <label
              style={{
                display: 'inline-block',
                marginTop: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                cursor: enviando === d.tipo ? 'wait' : 'pointer',
                font: '600 13px var(--font-body)',
              }}
            >
              {enviando === d.tipo ? 'Enviando...' : d.documentoId ? 'Reenviar arquivo' : 'Enviar arquivo'}
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
      ))}
    </div>
  );
}
