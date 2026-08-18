import { useCallback, useEffect, useRef, useState } from 'react';
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

const PUBLICO_LABELS: Record<string, string> = {
  TODOS: 'Todos os funcionários',
  FILIAL: 'Por filial',
  CARGO: 'Por cargo',
  FUNCIONARIO: 'Funcionário específico',
};

const DESTINO_LABEL: Record<string, string> = {
  FILIAL: 'Nome da filial',
  CARGO: 'Cargo',
  FUNCIONARIO: 'ID do funcionário',
};

const DESTINO_PLACEHOLDER: Record<string, string> = {
  FILIAL: 'Ex: Goiânia Centro',
  CARGO: 'Ex: Eletricista',
  FUNCIONARIO: 'Cole o ID do funcionário',
};

const MAX_IMAGEM_BYTES = 500 * 1024;

/** ADM 8 -- Comunicados e Notificacoes (RH → colaboradores). */
export function PainelComunicados() {
  const [hist, setHist] = useState<Comunicado[]>([]);
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [publicoTipo, setPublicoTipo] = useState('TODOS');
  const [publicoValor, setPublicoValor] = useState('');
  const [imagem, setImagem] = useState<string | null>(null);
  const [erroImagem, setErroImagem] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const inputImagemRef = useRef<HTMLInputElement>(null);

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

  function onImagem(e: React.ChangeEvent<HTMLInputElement>) {
    setErroImagem(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGEM_BYTES) {
      setErroImagem('Imagem muito grande. Máximo 500 KB.');
      if (inputImagemRef.current) inputImagemRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setImagem(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

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
          imagem: imagem ?? undefined,
        },
        true,
      );
      setFeedback({ tom: 'sucesso', texto: 'Comunicado publicado com sucesso.' });
      setTitulo('');
      setMensagem('');
      setPublicoValor('');
      setImagem(null);
      if (inputImagemRef.current) inputImagemRef.current.value = '';
      await carregar();
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao enviar.' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Comunicados"
        subtitulo="Avisos do RH para a equipe: DDS, eventos, informações gerais"
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
          <Campo
            label="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: DDS — Prevenção de quedas"
          />
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
            placeholder="Escreva o comunicado aqui…"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              font: '400 14px var(--font-body)',
              marginBottom: 'var(--space-3)',
              background: 'var(--color-surface)',
              color: 'var(--color-navy-900)',
              resize: 'vertical',
            }}
          />

          {/* Upload de imagem opcional */}
          <label
            style={{
              display: 'block',
              font: '500 13px var(--font-body)',
              marginBottom: 'var(--space-1)',
            }}
          >
            Imagem do comunicado{' '}
            <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>
              (opcional, máx 500 KB)
            </span>
          </label>
          <input
            ref={inputImagemRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onImagem}
            style={{
              display: 'block',
              width: '100%',
              marginBottom: 'var(--space-2)',
              font: '400 13px var(--font-body)',
            }}
          />
          {erroImagem && (
            <p
              style={{
                color: 'var(--color-danger)',
                font: '400 12px var(--font-body)',
                margin: '0 0 var(--space-2)',
              }}
            >
              {erroImagem}
            </p>
          )}
          {imagem && (
            <div
              style={{
                marginBottom: 'var(--space-3)',
                position: 'relative',
                display: 'inline-block',
              }}
            >
              <img
                src={imagem}
                alt="Pré-visualização"
                style={{
                  maxWidth: '100%',
                  maxHeight: 180,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  display: 'block',
                }}
              />
              <button
                onClick={() => {
                  setImagem(null);
                  if (inputImagemRef.current) inputImagemRef.current.value = '';
                }}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  background: 'rgba(0,0,0,0.55)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 24,
                  height: 24,
                  cursor: 'pointer',
                  color: '#fff',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Remover imagem"
              >
                ×
              </button>
            </div>
          )}

          <Selecao
            label="Destinatário"
            value={publicoTipo}
            onChange={(e) => {
              setPublicoTipo(e.target.value);
              setPublicoValor('');
            }}
          >
            {Object.entries(PUBLICO_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </Selecao>

          {publicoTipo !== 'TODOS' && (
            <Campo
              label={DESTINO_LABEL[publicoTipo] ?? 'Destinatário'}
              placeholder={DESTINO_PLACEHOLDER[publicoTipo]}
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
            {enviando ? 'Enviando…' : 'Publicar comunicado'}
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
                  <div style={{ font: '11px var(--font-mono)', color: 'var(--color-text-muted)' }}>
                    {PUBLICO_LABELS[c.publicoTipo] ?? c.publicoTipo}
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
