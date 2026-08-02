import { useCallback, useEffect, useState } from 'react';
import { Badge, Botao, Campo, Cartao } from '../design-system/components';
import { apiGet, apiPost, lerArquivoBase64 } from '../lib/api';

interface Funcionario {
  id: string;
  nome: string;
}
interface ItemFila {
  id: string;
  tipo: string;
  titulo: string;
  competencia: string | null;
  status: string;
  funcionario: { nome: string };
}
interface Detalhe {
  status: string;
  hashDocumento: string;
  assinatura: {
    hashAssinatura: string;
    timestampAssinatura: string;
    ip: string | null;
    chaveServidorId: string;
  } | null;
}

const COR: Record<string, string> = {
  ENVIADO: 'var(--color-border)',
  VISUALIZADO: 'var(--color-amber-warning)',
  ASSINADO: 'var(--color-teal-success)',
  RECUSADO: 'var(--color-red-alert)',
};

/** ADM 3 -- Painel de Assinaturas Virtuais. */
export function PainelAssinaturas() {
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setFila(await apiGet<ItemFila[]>('/admin/assinaturas'));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function abrir(id: string) {
    setDetalhe(await apiGet<Detalhe>(`/admin/assinaturas/${id}`));
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ font: '700 24px var(--font-display)' }}>Assinaturas Virtuais</h1>
      {erro && <Badge cor="var(--color-red-alert)">{erro}</Badge>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <Enviar onEnviado={carregar} />

        <Cartao>
          <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Fila de status</h2>
          {fila.length === 0 && <p style={{ color: '#5b6472' }}>Nenhum documento.</p>}
          {fila.map((d) => (
            <div key={d.id} onClick={() => abrir(d.id)} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}>
              <span>{d.funcionario.nome}</span>
              <span style={{ font: '13px var(--font-body)' }}>{d.titulo}</span>
              <Badge cor={COR[d.status] ?? 'var(--color-border)'}>{d.status}</Badge>
            </div>
          ))}
          {detalhe && (
            <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-neutral-bg)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ font: '600 13px var(--font-body)' }}>Detalhe da assinatura</div>
              <div style={{ font: '11px var(--font-mono)', wordBreak: 'break-all' }}>
                hash doc: {detalhe.hashDocumento.slice(0, 24)}...
                {detalhe.assinatura ? (
                  <>
                    <br />hash assinatura: {detalhe.assinatura.hashAssinatura.slice(0, 24)}...
                    <br />timestamp: {new Date(detalhe.assinatura.timestampAssinatura).toLocaleString('pt-BR')}
                    <br />IP: {detalhe.assinatura.ip ?? '-'} · chave: {detalhe.assinatura.chaveServidorId.slice(0, 12)}
                  </>
                ) : (
                  <><br />ainda nao assinado</>
                )}
              </div>
            </div>
          )}
        </Cartao>
      </div>
    </div>
  );
}

function Enviar({ onEnviado }: { onEnviado: () => void }) {
  const [funcs, setFuncs] = useState<Funcionario[]>([]);
  const [funcionarioId, setFuncionarioId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [competencia, setCompetencia] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void apiGet<Funcionario[]>('/admin/funcionarios').then(setFuncs).catch(() => {});
  }, []);

  async function enviar() {
    setMsg(null);
    try {
      if (!arquivo) throw new Error('Selecione um arquivo.');
      const arquivoBase64 = await lerArquivoBase64(arquivo);
      await apiPost(
        '/admin/assinaturas',
        {
          funcionarioId,
          tipo: 'HOLERITE',
          titulo,
          competencia: competencia || undefined,
          arquivoBase64,
          mime: arquivo.type,
        },
        true,
      );
      setMsg('Documento enviado.');
      setTitulo('');
      setArquivo(null);
      onEnviado();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao enviar.');
    }
  }

  return (
    <Cartao>
      <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Enviar holerite/documento</h2>
      <label style={{ display: 'block', font: '500 13px var(--font-body)', marginBottom: 'var(--space-1)' }}>Funcionario</label>
      <select value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)} style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-3)' }}>
        <option value="">Selecione...</option>
        {funcs.map((f) => (
          <option key={f.id} value={f.id}>{f.nome}</option>
        ))}
      </select>
      <Campo label="Titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <Campo label="Competencia (YYYY-MM)" value={competencia} onChange={(e) => setCompetencia(e.target.value)} placeholder="2026-07" />
      <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} style={{ marginBottom: 'var(--space-3)' }} />
      {msg && <Badge cor="var(--color-accent)">{msg}</Badge>}
      <Botao onClick={enviar} disabled={!funcionarioId || !titulo || !arquivo}>
        Enviar
      </Botao>
    </Cartao>
  );
}
