import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Badge, Botao, Campo, Cartao } from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';

interface Dashboard {
  marcacoesHoje: number;
  foraRegapHoje: number;
  excecoesPendentes: number;
  funcionariosPresentes: number;
}

interface ItemExcecao {
  id: string;
  tipo: string;
  motivo: string | null;
  funcionario: { nome: string; cpf: string };
  ponto: { nsr: number; tipo: string; registradoEm: string; dentroRegap: boolean };
}

interface Regap {
  id: string;
  nome: string;
  raioMetros: number;
  ativo: boolean;
}

/** ADM 4 -- Gestao de Ponto: dashboard, fila de excecoes e REGAP. */
export function GestaoPonto() {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [excecoes, setExcecoes] = useState<ItemExcecao[]>([]);
  const [regaps, setRegaps] = useState<Regap[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [d, e, r] = await Promise.all([
        apiGet<Dashboard>('/admin/pontos/dashboard'),
        apiGet<ItemExcecao[]>('/admin/pontos/excecoes'),
        apiGet<Regap[]>('/admin/regaps'),
      ]);
      setDash(d);
      setExcecoes(e);
      setRegaps(r);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function decidir(id: string, aprovar: boolean) {
    const motivoResposta = window.prompt(
      aprovar ? 'Justificativa da aprovacao:' : 'Justificativa da recusa:',
    );
    if (!motivoResposta) return;
    try {
      await apiPost(`/admin/pontos/excecoes/${id}/decidir`, { aprovar, motivoResposta }, true);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao decidir.');
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ font: '700 24px var(--font-display)' }}>Gestao de Ponto</h1>
      {erro && <Badge cor="var(--color-red-alert)">{erro}</Badge>}

      {/* Indicadores do dia */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', margin: 'var(--space-3) 0' }}>
        <Kpi titulo="Presentes" valor={dash?.funcionariosPresentes} />
        <Kpi titulo="Marcacoes hoje" valor={dash?.marcacoesHoje} />
        <Kpi titulo="Fora da REGAP" valor={dash?.foraRegapHoje} cor="var(--color-amber-warning)" />
        <Kpi titulo="Pendencias" valor={dash?.excecoesPendentes} cor="var(--color-red-alert)" />
      </div>

      {/* Fila de excecoes */}
      <Cartao>
        <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Fila de excecoes</h2>
        {excecoes.length === 0 && <p style={{ color: '#5b6472' }}>Nenhuma pendencia.</p>}
        {excecoes.map((e) => (
          <div
            key={e.id}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}
          >
            <div>
              <strong>{e.funcionario.nome}</strong>{' '}
              <Badge cor="var(--color-amber-warning)">{e.tipo}</Badge>
              <div style={{ font: '12px var(--font-mono)', color: '#5b6472' }}>
                NSR {e.ponto.nsr} · {new Date(e.ponto.registradoEm).toLocaleString('pt-BR')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={() => decidir(e.id, true)} style={botaoAcao('var(--color-teal-success)')}>
                Aprovar
              </button>
              <button onClick={() => decidir(e.id, false)} style={botaoAcao('var(--color-red-alert)')}>
                Recusar
              </button>
            </div>
          </div>
        ))}
      </Cartao>

      <div style={{ height: 'var(--space-3)' }} />

      {/* REGAP */}
      <NovaRegap onCriada={carregar} />
      <Cartao>
        <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Areas (REGAP)</h2>
        {regaps.map((r) => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0' }}>
            <span>{r.nome}</span>
            <span style={{ font: '13px var(--font-mono)' }}>raio {r.raioMetros} m</span>
            <Badge cor={r.ativo ? 'var(--color-teal-success)' : 'var(--color-border)'}>
              {r.ativo ? 'ativa' : 'inativa'}
            </Badge>
          </div>
        ))}
      </Cartao>
    </div>
  );
}

function Kpi({ titulo, valor, cor }: { titulo: string; valor?: number; cor?: string }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
      <div style={{ font: '700 28px var(--font-display)', color: cor ?? 'var(--color-navy-900)' }}>
        {valor ?? '--'}
      </div>
      <div style={{ font: '400 13px var(--font-body)', color: '#5b6472' }}>{titulo}</div>
    </div>
  );
}

function NovaRegap({ onCriada }: { onCriada: () => void }) {
  const [nome, setNome] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [raio, setRaio] = useState('150');
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    setErro(null);
    try {
      await apiPost(
        '/admin/regaps',
        {
          nome,
          latitudeCentro: Number(lat),
          longitudeCentro: Number(lng),
          raioMetros: Number(raio),
        },
        true,
      );
      setNome('');
      setLat('');
      setLng('');
      onCriada();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao criar REGAP.');
    }
  }

  return (
    <Cartao>
      <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Nova area (REGAP)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 'var(--space-2)' }}>
        <Campo label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Campo label="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} />
        <Campo label="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} />
        <Campo label="Raio (m)" value={raio} onChange={(e) => setRaio(e.target.value)} />
      </div>
      {erro && <Badge cor="var(--color-red-alert)">{erro}</Badge>}
      <Botao onClick={criar} disabled={!nome || !lat || !lng}>
        Criar area
      </Botao>
    </Cartao>
  );
}

function botaoAcao(cor: string): CSSProperties {
  return {
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: cor,
    color: '#fff',
    cursor: 'pointer',
    font: '500 13px var(--font-body)',
  };
}
