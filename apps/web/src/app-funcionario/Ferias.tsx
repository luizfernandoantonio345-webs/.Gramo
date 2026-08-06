import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Botao,
  Campo,
  Cartao,
  EstadoVazio,
  Feedback,
  Selecao,
} from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';

type TomFeedback = 'sucesso' | 'erro' | 'aviso' | 'info';

interface Ausencia {
  id: string;
  tipo: string;
  dataInicio: string;
  dataFim: string;
  status: string;
  motivoResposta: string | null;
}

const COR: Record<string, string> = {
  PENDENTE: 'var(--color-amber-warning)',
  APROVADA: 'var(--color-teal-success)',
  RECUSADA: 'var(--color-red-alert)',
};
const TIPOS: Array<[string, string]> = [
  ['FERIAS', 'Férias'],
  ['AFASTAMENTO', 'Afastamento'],
  ['LICENCA', 'Licença'],
  ['ATESTADO', 'Atestado'],
  ['OUTRO', 'Outro'],
];
const rotuloTipo = (t: string) => TIPOS.find(([v]) => v === t)?.[1] ?? t;

/** Funcionario -- solicitar ferias/afastamento e acompanhar status. */
export function Ferias() {
  const [lista, setLista] = useState<Ausencia[]>([]);
  const [tipo, setTipo] = useState('FERIAS');
  const [ini, setIni] = useState('');
  const [fim, setFim] = useState('');
  const [motivo, setMotivo] = useState('');
  const [feedback, setFeedback] = useState<{ tom: TomFeedback; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      setLista(await apiGet<Ausencia[]>('/ferias'));
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao carregar.' });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function solicitar() {
    setFeedback(null);
    setEnviando(true);
    try {
      await apiPost(
        '/ferias',
        { tipo, dataInicio: ini, dataFim: fim, motivo: motivo || undefined },
        true,
      );
      setFeedback({ tom: 'sucesso', texto: 'Solicitação enviada. Aguarde a análise do RH.' });
      setIni('');
      setFim('');
      setMotivo('');
      await carregar();
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao solicitar.' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ font: '700 24px var(--font-display)', marginTop: 0 }}>Férias e afastamentos</h1>

      {feedback && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Feedback tom={feedback.tom}>{feedback.texto}</Feedback>
        </div>
      )}

      <Cartao>
        <Selecao label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS.map(([v, rot]) => (
            <option key={v} value={v}>
              {rot}
            </option>
          ))}
        </Selecao>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
          <Campo label="Início" type="date" value={ini} onChange={(e) => setIni(e.target.value)} />
          <Campo label="Fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
        <Campo
          label="Motivo (opcional)"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <Botao onClick={solicitar} disabled={!ini || !fim || enviando}>
          {enviando ? 'Enviando…' : 'Solicitar'}
        </Botao>
      </Cartao>

      <div style={{ height: 'var(--space-3)' }} />
      <Cartao>
        <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Minhas solicitações</h2>
        {carregando ? (
          <EstadoVazio>Carregando…</EstadoVazio>
        ) : lista.length === 0 ? (
          <EstadoVazio>Nenhuma solicitação ainda.</EstadoVazio>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {lista.map((a) => (
              <li
                key={a.id}
                style={{
                  padding: 'var(--space-3) 0',
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
                  <div>
                    <strong style={{ font: '600 15px var(--font-body)' }}>
                      {rotuloTipo(a.tipo)}
                    </strong>
                    <div
                      style={{ font: '12px var(--font-mono)', color: 'var(--color-text-muted)' }}
                    >
                      {a.dataInicio.slice(0, 10)} a {a.dataFim.slice(0, 10)}
                    </div>
                  </div>
                  <Badge cor={COR[a.status] ?? 'var(--color-border)'}>
                    {a.status.toLowerCase()}
                  </Badge>
                </div>
                {a.motivoResposta && (
                  <p
                    style={{
                      font: '400 13px var(--font-body)',
                      color: 'var(--color-text-muted)',
                      margin: 'var(--space-1) 0 0',
                    }}
                  >
                    RH: {a.motivoResposta}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
