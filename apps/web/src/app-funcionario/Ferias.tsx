import { useCallback, useEffect, useState } from 'react';
import { Badge, Botao, Campo, Cartao } from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';

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

/** Funcionario -- solicitar ferias/afastamento e acompanhar status. */
export function Ferias() {
  const [lista, setLista] = useState<Ausencia[]>([]);
  const [tipo, setTipo] = useState('FERIAS');
  const [ini, setIni] = useState('');
  const [fim, setFim] = useState('');
  const [motivo, setMotivo] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLista(await apiGet<Ausencia[]>('/ferias'));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function solicitar() {
    setMsg(null);
    try {
      await apiPost('/ferias', { tipo, dataInicio: ini, dataFim: fim, motivo: motivo || undefined }, true);
      setMsg('Solicitacao enviada.');
      setIni('');
      setFim('');
      setMotivo('');
      await carregar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao solicitar.');
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ font: '700 22px var(--font-display)' }}>Ferias e afastamentos</h1>
      {msg && <div style={{ marginBottom: 'var(--space-3)' }}><Badge cor="var(--color-accent)">{msg}</Badge></div>}

      <Cartao>
        <label style={{ display: 'block', font: '500 13px var(--font-body)' }}>Tipo</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-3)' }}>
          {['FERIAS', 'AFASTAMENTO', 'LICENCA', 'ATESTADO', 'OUTRO'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
          <Campo label="Inicio" type="date" value={ini} onChange={(e) => setIni(e.target.value)} />
          <Campo label="Fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
        <Campo label="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <Botao onClick={solicitar} disabled={!ini || !fim}>Solicitar</Botao>
      </Cartao>

      <div style={{ height: 'var(--space-3)' }} />
      <Cartao>
        <h2 style={{ font: '600 15px var(--font-display)', marginTop: 0 }}>Minhas solicitacoes</h2>
        {lista.length === 0 && <p style={{ color: '#5b6472' }}>Nenhuma solicitacao.</p>}
        {lista.map((a) => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
            <div>
              <strong>{a.tipo}</strong>
              <div style={{ font: '12px var(--font-mono)', color: '#5b6472' }}>
                {a.dataInicio.slice(0, 10)} a {a.dataFim.slice(0, 10)}
              </div>
            </div>
            <Badge cor={COR[a.status] ?? 'var(--color-border)'}>{a.status}</Badge>
          </div>
        ))}
      </Cartao>
    </div>
  );
}
