import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  Badge,
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  EstadoVazio,
  Feedback,
  Kpi,
} from '../design-system/components';
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
  const [carregando, setCarregando] = useState(true);

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
      setErro(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function decidir(id: string, aprovar: boolean) {
    const motivoResposta = window.prompt(
      aprovar ? 'Justificativa da aprovação:' : 'Justificativa da recusa:',
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
      <CabecalhoPagina
        titulo="Gestão de ponto"
        subtitulo="Fila de exceções, presença do dia e áreas REGAP"
      />

      {erro && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}

      {/* Indicadores do dia */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 'var(--space-3)',
          margin: '0 0 var(--space-4)',
        }}
      >
        <Kpi rotulo="Presentes" valor={dash?.funcionariosPresentes ?? '—'} />
        <Kpi rotulo="Marcações hoje" valor={dash?.marcacoesHoje ?? '—'} />
        <Kpi
          rotulo="Fora da REGAP"
          valor={dash?.foraRegapHoje ?? '—'}
          tom={dash && dash.foraRegapHoje > 0 ? 'aviso' : 'neutro'}
        />
        <Kpi
          rotulo="Pendências"
          valor={dash?.excecoesPendentes ?? '—'}
          tom={dash && dash.excecoesPendentes > 0 ? 'alerta' : 'ok'}
        />
      </div>

      {/* Fila de excecoes -- superficie de decisao principal do RH */}
      <Cartao>
        <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Fila de exceções</h2>
        {carregando ? (
          <EstadoVazio>Carregando…</EstadoVazio>
        ) : excecoes.length === 0 ? (
          <EstadoVazio>Nenhuma pendência — exceções em dia.</EstadoVazio>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {excecoes.map((e) => (
              <li
                key={e.id}
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
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong style={{ font: '600 15px var(--font-body)' }}>
                      {e.funcionario.nome}
                    </strong>
                    <Badge cor="var(--color-amber-warning)">{e.tipo}</Badge>
                  </div>
                  <div style={{ font: '12px var(--font-mono)', color: 'var(--color-text-muted)' }}>
                    NSR {e.ponto.nsr} · {new Date(e.ponto.registradoEm).toLocaleString('pt-BR')}
                    {e.ponto.dentroRegap ? '' : ' · fora da área'}
                  </div>
                  {e.motivo && (
                    <div
                      style={{
                        font: '400 13px var(--font-body)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      “{e.motivo}”
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flex: '0 0 auto' }}>
                  <button
                    onClick={() => decidir(e.id, true)}
                    style={botaoAcao('var(--color-teal-success)')}
                  >
                    Aprovar
                  </button>
                  <button
                    onClick={() => decidir(e.id, false)}
                    style={botaoAcao('var(--color-red-alert)')}
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

      {/* REGAP */}
      <NovaRegap onCriada={carregar} />
      <div style={{ height: 'var(--space-3)' }} />
      <Cartao>
        <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Áreas (REGAP)</h2>
        {regaps.length === 0 ? (
          <EstadoVazio>Nenhuma área cadastrada.</EstadoVazio>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {regaps.map((r) => (
              <li
                key={r.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <span style={{ flex: 1, font: '500 14px var(--font-body)' }}>{r.nome}</span>
                <span style={{ font: '13px var(--font-mono)', color: 'var(--color-text-muted)' }}>
                  raio {r.raioMetros} m
                </span>
                <Badge cor={r.ativo ? 'var(--color-teal-success)' : 'var(--color-border)'}>
                  {r.ativo ? 'ativa' : 'inativa'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

function NovaRegap({ onCriada }: { onCriada: () => void }) {
  const [nome, setNome] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [raio, setRaio] = useState('150');
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  async function criar() {
    setErro(null);
    setCriando(true);
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
    } finally {
      setCriando(false);
    }
  }

  return (
    <Cartao>
      <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Nova área (REGAP)</h2>
      <div
        style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 'var(--space-2)' }}
      >
        <Campo label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Campo label="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} />
        <Campo label="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} />
        <Campo label="Raio (m)" value={raio} onChange={(e) => setRaio(e.target.value)} />
      </div>
      {erro && (
        <div style={{ marginBottom: 'var(--space-2)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}
      <Botao onClick={criar} disabled={!nome || !lat || !lng || criando}>
        {criando ? 'Criando…' : 'Criar área'}
      </Botao>
    </Cartao>
  );
}

function botaoAcao(cor: string): CSSProperties {
  return {
    minHeight: 44,
    padding: '0 var(--space-3)',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: cor,
    color: 'var(--color-navy-deep)',
    cursor: 'pointer',
    font: '600 13px var(--font-body)',
  };
}
