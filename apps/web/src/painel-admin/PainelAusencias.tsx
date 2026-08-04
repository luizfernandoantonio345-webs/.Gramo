import { useCallback, useEffect, useState } from 'react';
import { Badge, CabecalhoPagina, Cartao, EstadoVazio, Feedback } from '../design-system/components';
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
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        apiGet<Solicitacao[]>('/admin/ferias?status=PENDENTE'),
        apiGet<Contestacao[]>('/admin/contestacoes?status=ABERTA'),
      ]);
      setSolic(s);
      setContest(c);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function decidir(id: string, aprovar: boolean) {
    const motivoResposta =
      window.prompt(aprovar ? 'Observação (opcional):' : 'Motivo da recusa:') ?? undefined;
    if (!aprovar && !motivoResposta) return;
    await apiPost(`/admin/ferias/${id}/decidir`, { aprovar, motivoResposta }, true);
    await carregar();
  }
  async function responder(id: string) {
    const resposta = window.prompt('Resposta ao funcionário:');
    if (!resposta) return;
    await apiPost(`/admin/contestacoes/${id}/responder`, { resposta }, true);
    await carregar();
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--space-4)' }}>
      <CabecalhoPagina
        titulo="Ausências e contestações"
        subtitulo="Fila de decisão do RH — férias/afastamentos e contestações de ponto"
      />
      {erro && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}

      <Cartao>
        <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>
          Solicitações de ausência (pendentes)
        </h2>
        {carregando ? (
          <EstadoVazio>Carregando…</EstadoVazio>
        ) : solic.length === 0 ? (
          <EstadoVazio>Nenhuma pendência.</EstadoVazio>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {solic.map((s) => (
              <li
                key={s.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <strong style={{ font: '600 15px var(--font-body)' }}>
                      {s.funcionario.nome}
                    </strong>
                    <Badge cor="var(--color-amber-warning)">{s.tipo.toLowerCase()}</Badge>
                  </div>
                  <div style={{ font: '12px var(--font-mono)', color: '#5b6472' }}>
                    {s.dataInicio.slice(0, 10)} a {s.dataFim.slice(0, 10)}
                  </div>
                  {s.motivo && (
                    <div style={{ font: '400 13px var(--font-body)', color: '#5b6472' }}>
                      “{s.motivo}”
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flex: '0 0 auto' }}>
                  <button
                    onClick={() => decidir(s.id, true)}
                    style={btn('var(--color-teal-success)')}
                  >
                    Aprovar
                  </button>
                  <button
                    onClick={() => decidir(s.id, false)}
                    style={btn('var(--color-red-alert)')}
                  >
                    Recusar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <div style={{ height: 'var(--space-4)' }} />
      <Cartao>
        <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>
          Contestações de ponto (abertas)
        </h2>
        {carregando ? (
          <EstadoVazio>Carregando…</EstadoVazio>
        ) : contest.length === 0 ? (
          <EstadoVazio>Nenhuma contestação aberta.</EstadoVazio>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {contest.map((c) => (
              <li
                key={c.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ font: '600 15px var(--font-body)' }}>
                    {c.funcionario.nome}
                  </strong>
                  <div style={{ font: '12px var(--font-mono)', color: '#5b6472' }}>
                    NSR {c.ponto.nsr} · {new Date(c.ponto.registradoEm).toLocaleString('pt-BR')}
                  </div>
                  <div style={{ font: '400 13px var(--font-body)' }}>“{c.motivo}”</div>
                </div>
                <button
                  onClick={() => responder(c.id)}
                  style={{ ...btn('var(--color-accent)'), flex: '0 0 auto' }}
                >
                  Responder
                </button>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

function btn(cor: string) {
  return {
    minHeight: 44,
    padding: '0 var(--space-3)',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: cor,
    color: '#fff',
    cursor: 'pointer',
    font: '600 13px var(--font-body)',
  } as const;
}
