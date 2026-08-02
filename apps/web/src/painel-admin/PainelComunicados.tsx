import { useCallback, useEffect, useState } from 'react';
import { Badge, Botao, Campo, Cartao } from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';

interface Comunicado {
  id: string;
  titulo: string;
  publicoTipo: string;
  publicoValor: string | null;
  criadoEm: string;
  _count: { leituras: number };
}

/** ADM 8 -- Comunicados e Notificacoes. */
export function PainelComunicados() {
  const [hist, setHist] = useState<Comunicado[]>([]);
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [publicoTipo, setPublicoTipo] = useState('TODOS');
  const [publicoValor, setPublicoValor] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setHist(await apiGet<Comunicado[]>('/admin/comunicados'));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function enviar() {
    setMsg(null);
    try {
      await apiPost(
        '/admin/comunicados',
        { titulo, mensagem, publicoTipo, publicoValor: publicoTipo === 'TODOS' ? undefined : publicoValor },
        true,
      );
      setTitulo('');
      setMensagem('');
      setPublicoValor('');
      await carregar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao enviar.');
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ font: '700 24px var(--font-display)' }}>Comunicados</h1>
      {msg && <Badge cor="var(--color-accent)">{msg}</Badge>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <Cartao>
          <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Novo comunicado</h2>
          <Campo label="Titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <label style={{ display: 'block', font: '500 13px var(--font-body)', marginBottom: 'var(--space-1)' }}>Mensagem</label>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={4}
            style={{ width: '100%', boxSizing: 'border-box', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', font: '400 14px var(--font-body)', marginBottom: 'var(--space-3)' }}
          />
          <label style={{ display: 'block', font: '500 13px var(--font-body)' }}>Publico</label>
          <select value={publicoTipo} onChange={(e) => setPublicoTipo(e.target.value)} style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-3)' }}>
            {['TODOS', 'FILIAL', 'CARGO', 'FUNCIONARIO'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {publicoTipo !== 'TODOS' && (
            <Campo label={`Valor (${publicoTipo.toLowerCase()})`} value={publicoValor} onChange={(e) => setPublicoValor(e.target.value)} />
          )}
          <Botao onClick={enviar} disabled={!titulo || !mensagem || (publicoTipo !== 'TODOS' && !publicoValor)}>
            Enviar comunicado
          </Botao>
        </Cartao>

        <Cartao>
          <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Historico</h2>
          {hist.map((c) => (
            <div key={c.id} style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{c.titulo}</strong>
                <Badge cor="var(--color-teal-success)">{c._count.leituras} leituras</Badge>
              </div>
              <div style={{ font: '11px var(--font-mono)', color: '#5b6472' }}>
                {c.publicoTipo}{c.publicoValor ? ` · ${c.publicoValor}` : ''} · {new Date(c.criadoEm).toLocaleDateString('pt-BR')}
              </div>
            </div>
          ))}
        </Cartao>
      </div>
    </div>
  );
}
