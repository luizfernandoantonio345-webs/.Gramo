import { useCallback, useEffect, useState } from 'react';
import { Badge, Cartao } from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';

interface Solicitacao {
  id: string;
  tipo: string;
  dataInicio: string;
  dataFim: string;
  motivo: string | null;
  funcionario: { nome: string };
}
interface Contestacao {
  id: string;
  motivo: string;
  funcionario: { nome: string };
  ponto: { nsr: number; tipo: string; registradoEm: string };
}

/** ADM 10 (Ferias/Afastamentos) + ADM 11 (Contestacao de ponto). */
export function PainelAusencias() {
  const [solic, setSolic] = useState<Solicitacao[]>([]);
  const [contest, setContest] = useState<Contestacao[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        apiGet<Solicitacao[]>('/admin/ferias?status=PENDENTE'),
        apiGet<Contestacao[]>('/admin/contestacoes?status=ABERTA'),
      ]);
      setSolic(s);
      setContest(c);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function decidir(id: string, aprovar: boolean) {
    const motivoResposta = window.prompt(aprovar ? 'Observacao (opcional):' : 'Motivo da recusa:') ?? undefined;
    if (!aprovar && !motivoResposta) return;
    await apiPost(`/admin/ferias/${id}/decidir`, { aprovar, motivoResposta }, true);
    await carregar();
  }
  async function responder(id: string) {
    const resposta = window.prompt('Resposta ao funcionario:');
    if (!resposta) return;
    await apiPost(`/admin/contestacoes/${id}/responder`, { resposta }, true);
    await carregar();
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ font: '700 24px var(--font-display)' }}>Ausencias e contestacoes</h1>
      {erro && <Badge cor="var(--color-red-alert)">{erro}</Badge>}

      <Cartao>
        <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Solicitacoes de ausencia (pendentes)</h2>
        {solic.length === 0 && <p style={{ color: '#5b6472' }}>Nenhuma pendencia.</p>}
        {solic.map((s) => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
            <div>
              <strong>{s.funcionario.nome}</strong> <Badge cor="var(--color-amber-warning)">{s.tipo}</Badge>
              <div style={{ font: '12px var(--font-mono)', color: '#5b6472' }}>
                {s.dataInicio.slice(0, 10)} a {s.dataFim.slice(0, 10)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={() => decidir(s.id, true)} style={btn('var(--color-teal-success)')}>Aprovar</button>
              <button onClick={() => decidir(s.id, false)} style={btn('var(--color-red-alert)')}>Recusar</button>
            </div>
          </div>
        ))}
      </Cartao>

      <div style={{ height: 'var(--space-3)' }} />
      <Cartao>
        <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Contestacoes de ponto (abertas)</h2>
        {contest.length === 0 && <p style={{ color: '#5b6472' }}>Nenhuma contestacao aberta.</p>}
        {contest.map((c) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
            <div>
              <strong>{c.funcionario.nome}</strong>
              <div style={{ font: '12px var(--font-mono)', color: '#5b6472' }}>
                NSR {c.ponto.nsr} · {new Date(c.ponto.registradoEm).toLocaleString('pt-BR')}
              </div>
              <div style={{ font: '13px var(--font-body)' }}>"{c.motivo}"</div>
            </div>
            <button onClick={() => responder(c.id)} style={btn('var(--color-accent)')}>Responder</button>
          </div>
        ))}
      </Cartao>
    </div>
  );
}

function btn(cor: string) {
  return {
    padding: '4px 10px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: cor,
    color: '#fff',
    cursor: 'pointer',
    font: '500 12px var(--font-body)',
  } as const;
}
