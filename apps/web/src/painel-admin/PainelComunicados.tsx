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
  const [feedback, setFeedback] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setHist(await apiGet<Comunicado[]>('/admin/comunicados'));
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao carregar.' });
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function enviar() {
    setFeedback(null);
    setEnviando(true);
    try {
      await apiPost(
        '/admin/comunicados',
        {
          titulo,
          mensagem,
          publicoTipo,
          publicoValor: publicoTipo === 'TODOS' ? undefined : publicoValor,
        },
        true,
      );
      setFeedback({ tom: 'sucesso', texto: 'Comunicado publicado.' });
      setTitulo('');
      setMensagem('');
      setPublicoValor('');
      await carregar();
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao enviar.' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-4)' }}>
      <CabecalhoPagina
        titulo="Comunicados"
        subtitulo="Publicação para a equipe e taxa de leitura"
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
          <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Novo comunicado</h2>
          <Campo label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <label
            style={{
              display: 'block',
              font: '500 13px var(--font-body)',
              marginBottom: 'var(--space-1)',
            }}
          >
            Mensagem
          </label>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              font: '400 14px var(--font-body)',
              marginBottom: 'var(--space-3)',
            }}
          />
          <Selecao
            label="Público"
            value={publicoTipo}
            onChange={(e) => setPublicoTipo(e.target.value)}
          >
            {['TODOS', 'FILIAL', 'CARGO', 'FUNCIONARIO'].map((t) => (
              <option key={t} value={t}>
                {t.toLowerCase()}
              </option>
            ))}
          </Selecao>
          {publicoTipo !== 'TODOS' && (
            <Campo
              label={`Valor (${publicoTipo.toLowerCase()})`}
              value={publicoValor}
              onChange={(e) => setPublicoValor(e.target.value)}
            />
          )}
          <Botao
            onClick={enviar}
            disabled={
              !titulo || !mensagem || (publicoTipo !== 'TODOS' && !publicoValor) || enviando
            }
          >
            {enviando ? 'Enviando…' : 'Enviar comunicado'}
          </Botao>
        </Cartao>

        <Cartao>
          <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Histórico</h2>
          {carregando ? (
            <EstadoVazio>Carregando…</EstadoVazio>
          ) : hist.length === 0 ? (
            <EstadoVazio>Nenhum comunicado publicado ainda.</EstadoVazio>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {hist.map((c) => (
                <li
                  key={c.id}
                  style={{
                    padding: 'var(--space-2) 0',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <strong style={{ font: '600 14px var(--font-body)' }}>{c.titulo}</strong>
                    <Badge cor="var(--color-teal-success)">{c._count.leituras} leituras</Badge>
                  </div>
                  <div style={{ font: '11px var(--font-mono)', color: '#5b6472' }}>
                    {c.publicoTipo.toLowerCase()}
                    {c.publicoValor ? ` · ${c.publicoValor}` : ''} ·{' '}
                    {new Date(c.criadoEm).toLocaleDateString('pt-BR')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </div>
  );
}
