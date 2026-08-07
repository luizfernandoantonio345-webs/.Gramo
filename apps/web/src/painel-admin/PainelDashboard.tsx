import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { formatarMinutos } from '@repp/shared';
import {
  Badge,
  Botao,
  Campo,
  Cartao,
  CabecalhoPagina,
  EstadoVazio,
  Feedback,
  Kpi,
  Tabela,
} from '../design-system/components';
import { apiGet } from '../lib/api';

interface Dashboard {
  kpis: {
    funcionariosAtivos: number;
    marcacoesHoje: number;
    foraRegapHoje: number;
    excecoesPendentes: number;
    documentosVencendo: number;
    contestacoesAbertas: number;
    feriasPendentes: number;
  };
  alertasPrioritarios: Array<{ id: string; tipo: string; funcionario: string; desde: string }>;
  presenca7dias: Array<{ dia: string; marcacoes: number }>;
}
interface BancoHoras {
  cargaDiariaMinutos: number | null;
  saldoTotalMin: number | null;
  dias: Array<{ data: string; trabalhadoMin: number; saldoMin: number | null }>;
}

/** Titulo de secao dentro de um cartao. */
function TituloCartao({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-5)',
      }}
    >
      <h2
        style={{
          font: '600 var(--text-lg) var(--font-display)',
          letterSpacing: '-0.01em',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        {children}
      </h2>
      {meta}
    </div>
  );
}

const metaStyle = {
  font: '400 var(--text-xs) var(--font-mono)',
  color: 'var(--color-text-muted)',
} as const;

/** ADM 5 -- Dashboard Geral (executivo) + consulta de banco de horas. */
export function PainelDashboard() {
  const [d, setD] = useState<Dashboard | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setD(await apiGet<Dashboard>('/admin/dashboard'));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o dashboard.');
    }
  }, []);
  useEffect(() => {
    void carregar();
    // Re-carrega periodicamente: um erro transitorio (ex.: API reiniciando)
    // se resolve sozinho sem o usuario precisar recarregar a pagina.
    const id = setInterval(() => void carregar(), 60000);
    return () => clearInterval(id);
  }, [carregar]);

  const carregando = !d && !erro;
  const maxPres = Math.max(1, ...(d?.presenca7dias.map((p) => p.marcacoes) ?? [1]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <CabecalhoPagina titulo="Dashboard" subtitulo="Visão executiva da operação de ponto" />

      {erro && (
        <Feedback tom="erro">
          {erro}{' '}
          <button
            className="g-link"
            onClick={() => void carregar()}
            style={{ background: 'none', border: 'none', padding: 0, marginLeft: 'var(--space-2)' }}
          >
            Tentar novamente
          </button>
        </Feedback>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        <Kpi rotulo="Funcionários ativos" valor={d?.kpis.funcionariosAtivos ?? '—'} />
        <Kpi rotulo="Marcações hoje" valor={d?.kpis.marcacoesHoje ?? '—'} />
        <Kpi
          rotulo="Fora da REGAP hoje"
          valor={d?.kpis.foraRegapHoje ?? '—'}
          tom={d && d.kpis.foraRegapHoje > 0 ? 'aviso' : 'neutro'}
        />
        <Kpi
          rotulo="Exceções pendentes"
          valor={d?.kpis.excecoesPendentes ?? '—'}
          tom={d && d.kpis.excecoesPendentes > 0 ? 'alerta' : 'ok'}
        />
        <Kpi
          rotulo="Docs vencendo (30d)"
          valor={d?.kpis.documentosVencendo ?? '—'}
          tom={d && d.kpis.documentosVencendo > 0 ? 'aviso' : 'neutro'}
        />
        <Kpi rotulo="Contestações abertas" valor={d?.kpis.contestacoesAbertas ?? '—'} />
        <Kpi rotulo="Férias pendentes" valor={d?.kpis.feriasPendentes ?? '—'} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 'var(--space-6)',
        }}
      >
        <PresencaAgora />
        <AlertaExtras />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 'var(--space-6)',
        }}
      >
        <Cartao>
          <TituloCartao>Presença (7 dias)</TituloCartao>
          {carregando ? (
            <EstadoVazio>Carregando…</EstadoVazio>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                alignItems: 'flex-end',
                height: 140,
                borderBottom: '1px solid var(--color-divider)',
              }}
            >
              {d?.presenca7dias.map((p) => (
                <div
                  key={p.dia}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    height: '100%',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      font: '600 var(--text-xs) var(--font-mono)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {p.marcacoes}
                  </div>
                  <div
                    role="img"
                    aria-label={`${p.dia}: ${p.marcacoes} marcações`}
                    style={{
                      height: `${Math.max(4, (p.marcacoes / maxPres) * 96)}px`,
                      background: 'var(--color-accent)',
                      borderRadius: '6px 6px 0 0',
                      marginTop: 'var(--space-2)',
                    }}
                  />
                  <div
                    style={{
                      font: '400 10px var(--font-mono)',
                      color: 'var(--color-text-faint)',
                      marginTop: 'var(--space-2)',
                    }}
                  >
                    {p.dia.slice(5)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Cartao>

        <Cartao>
          <TituloCartao>Alertas prioritários · exceções &gt; 48h</TituloCartao>
          {carregando ? (
            <EstadoVazio>Carregando…</EstadoVazio>
          ) : (d?.alertasPrioritarios.length ?? 0) === 0 ? (
            <EstadoVazio>Sem alertas — exceções em dia.</EstadoVazio>
          ) : (
            <Lista>
              {d?.alertasPrioritarios.map((a) => (
                <LinhaLista key={a.id}>
                  <Badge cor="var(--color-danger)">{a.tipo}</Badge>
                  <span style={{ flex: 1, font: '500 var(--text-base) var(--font-body)' }}>
                    {a.funcionario}
                  </span>
                  <span style={metaStyle}>
                    desde {new Date(a.desde).toLocaleDateString('pt-BR')}
                  </span>
                </LinhaLista>
              ))}
            </Lista>
          )}
        </Cartao>
      </div>

      <ComparativoObras />
      <BancoHorasTool />
    </div>
  );
}

/* Lista vertical com divisorias (padrao dos cartoes). */
function Lista({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>;
}
function LinhaLista({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-4) 0',
        borderBottom: '1px solid var(--color-divider)',
      }}
    >
      {children}
    </div>
  );
}

interface Presenca {
  atualizadoEm: string;
  total: number;
  porFilial: Array<{ filial: string; total: number }>;
  presentes: Array<{ funcionario: string; filial: string; desde: string }>;
}

/**
 * Presenca em tempo real (near real-time): "quem esta trabalhando agora".
 * Poll a cada 15s -- robusto, atravessa qualquer proxy, sem estado no servidor.
 */
function PresencaAgora() {
  const [p, setP] = useState<Presenca | null>(null);
  const [erro, setErro] = useState(false);
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    let vivo = true;
    const carregar = async () => {
      try {
        const r = await apiGet<Presenca>('/admin/dashboard/presenca');
        if (vivo) {
          setP(r);
          setErro(false);
        }
      } catch {
        if (vivo) setErro(true);
      }
    };
    void carregar();
    const id = setInterval(carregar, 15000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  return (
    <Cartao>
      <TituloCartao
        meta={
          <span style={metaStyle} role="status" aria-live="polite">
            {p
              ? `atualizado ${new Date(p.atualizadoEm).toLocaleTimeString('pt-BR')}`
              : erro
                ? 'sem conexão'
                : '—'}
          </span>
        }
      >
        <span
          aria-hidden
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: 'var(--color-success)',
            boxShadow: '0 0 0 4px var(--color-success-tint)',
          }}
        />
        Presença agora
      </TituloCartao>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
        <span
          style={{
            font: '700 40px var(--font-display)',
            letterSpacing: '-0.02em',
            color: 'var(--color-success)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {p?.total ?? '—'}
        </span>
        <span
          style={{
            font: '400 var(--text-base) var(--font-body)',
            color: 'var(--color-text-muted)',
          }}
        >
          trabalhando neste momento
        </span>
      </div>

      {p && p.porFilial.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
            marginTop: 'var(--space-4)',
          }}
        >
          {p.porFilial.map((x) => (
            <Badge key={x.filial} cor="var(--color-accent)">
              {x.filial}: {x.total}
            </Badge>
          ))}
        </div>
      )}

      {p && p.total > 0 && (
        <>
          <button
            onClick={() => setExpandido((v) => !v)}
            aria-expanded={expandido}
            className="g-link"
            style={{
              display: 'block',
              marginTop: 'var(--space-4)',
              background: 'none',
              border: 'none',
              padding: 0,
              font: '500 var(--text-sm) var(--font-body)',
            }}
          >
            {expandido ? 'ocultar nomes' : 'ver quem está'}
          </button>
          {expandido && (
            <Lista>
              {p.presentes.map((x, i) => (
                <LinhaLista key={i}>
                  <span style={{ flex: 1, font: '400 var(--text-base) var(--font-body)' }}>
                    {x.funcionario}
                  </span>
                  <span style={metaStyle}>
                    {x.filial} · desde{' '}
                    {new Date(x.desde).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </LinhaLista>
              ))}
            </Lista>
          )}
        </>
      )}
    </Cartao>
  );
}

interface AlertaExtra {
  funcionarioId: string;
  funcionario: string;
  filial: string;
  data: string;
  trabalhadoMin: number;
  extraMin: number;
  limiteMin: number;
  restanteMin: number;
  status: 'EXCEDIDO' | 'PROXIMO';
  mensagem: string;
}
interface AlertasExtras {
  atualizadoEm: string;
  total: number;
  alertas: AlertaExtra[];
}

/**
 * Alerta PROATIVO de hora extra do dia: o RH ve, ainda durante o turno, quem
 * esta prestes a estourar (ou ja estourou) o limite legal de 2h/dia.
 */
function AlertaExtras() {
  const [a, setA] = useState<AlertasExtras | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    const carregar = async () => {
      try {
        const r = await apiGet<AlertasExtras>('/admin/dashboard/alertas-extras');
        if (vivo) {
          setA(r);
          setErro(false);
        }
      } catch {
        if (vivo) setErro(true);
      }
    };
    void carregar();
    const id = setInterval(carregar, 60000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  const excedidos = a?.alertas.filter((x) => x.status === 'EXCEDIDO').length ?? 0;

  return (
    <Cartao>
      <TituloCartao
        meta={
          <span style={metaStyle} role="status" aria-live="polite">
            {a
              ? `atualizado ${new Date(a.atualizadoEm).toLocaleTimeString('pt-BR')}`
              : erro
                ? 'sem conexão'
                : '—'}
          </span>
        }
      >
        Hora extra · hoje
        {excedidos > 0 && <Badge cor="var(--color-danger)">{excedidos} no limite</Badge>}
      </TituloCartao>

      {!a ? (
        <EstadoVazio>{erro ? 'Sem conexão.' : 'Carregando…'}</EstadoVazio>
      ) : a.total === 0 ? (
        <EstadoVazio>Ninguém próximo do limite de extra hoje.</EstadoVazio>
      ) : (
        <Lista>
          {a.alertas.map((x) => (
            <LinhaLista key={x.funcionarioId}>
              <Badge cor={x.status === 'EXCEDIDO' ? 'var(--color-danger)' : 'var(--color-warning)'}>
                {x.status === 'EXCEDIDO' ? 'excedido' : 'atenção'}
              </Badge>
              <span style={{ flex: 1, font: '500 var(--text-base) var(--font-body)' }}>
                {x.funcionario}
              </span>
              <span style={metaStyle}>
                {x.filial} · {formatarMinutos(x.extraMin)} / {formatarMinutos(x.limiteMin)}
              </span>
            </LinhaLista>
          ))}
        </Lista>
      )}
    </Cartao>
  );
}

interface ComparativoObra {
  filialId: string;
  obra: string;
  funcionariosAtivos: number;
  marcacoes: number;
  foraRegap: number;
  percentualForaRegap: number;
}
interface Comparativo {
  periodo: { inicio: string; fim: string };
  obras: ComparativoObra[];
}

/**
 * Comparativo executivo entre obras. Indicador-chave: % de marcacoes FORA da
 * REGAP (risco de conformidade). Ordenado do maior risco para o menor.
 */
function ComparativoObras() {
  const [c, setC] = useState<Comparativo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    apiGet<Comparativo>('/admin/dashboard/comparativo-obras')
      .then((r) => vivo && setC(r))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : 'Falha ao carregar.'));
    return () => {
      vivo = false;
    };
  }, []);

  const corRisco = (pct: number) =>
    pct >= 10 ? 'var(--color-danger)' : pct >= 3 ? 'var(--color-warning)' : 'var(--color-success)';

  return (
    <Cartao>
      <TituloCartao meta={<span style={metaStyle}>mês corrente</span>}>
        Comparativo entre obras
      </TituloCartao>
      {erro ? (
        <Feedback tom="erro">{erro}</Feedback>
      ) : !c ? (
        <EstadoVazio>Carregando…</EstadoVazio>
      ) : c.obras.length === 0 ? (
        <EstadoVazio>Nenhuma obra cadastrada.</EstadoVazio>
      ) : (
        <Tabela minWidth={480}>
          <thead>
            <tr>
              <th>Obra</th>
              <th className="g-num">Ativos</th>
              <th className="g-num">Marcações</th>
              <th className="g-num">Fora REGAP</th>
              <th className="g-num">% fora</th>
            </tr>
          </thead>
          <tbody>
            {c.obras.map((o) => (
              <tr key={o.filialId}>
                <td style={{ fontWeight: 500 }}>{o.obra}</td>
                <td className="g-num">{o.funcionariosAtivos}</td>
                <td className="g-num">{o.marcacoes}</td>
                <td className="g-num">{o.foraRegap}</td>
                <td className="g-num">
                  <Badge cor={corRisco(o.percentualForaRegap)}>
                    {o.percentualForaRegap.toFixed(1)}%
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
    </Cartao>
  );
}

function BancoHorasTool() {
  const [funcionarioId, setFuncId] = useState('');
  const [inicio, setIni] = useState('2026-07-01');
  const [fim, setFim] = useState('2026-07-31');
  const [r, setR] = useState<BancoHoras | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);

  async function consultar() {
    setErro(null);
    setConsultando(true);
    try {
      const q = `?funcionarioId=${funcionarioId}&inicio=${new Date(inicio).toISOString()}&fim=${new Date(`${fim}T23:59:59`).toISOString()}`;
      setR(await apiGet<BancoHoras>(`/admin/pontos/banco-horas${q}`));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao consultar.');
    } finally {
      setConsultando(false);
    }
  }

  return (
    <Cartao>
      <TituloCartao>Banco de horas</TituloCartao>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) 1fr 1fr auto',
          gap: 'var(--space-4)',
          alignItems: 'end',
        }}
      >
        <Campo
          label="Funcionário (ID)"
          value={funcionarioId}
          onChange={(e) => setFuncId(e.target.value)}
        />
        <Campo label="Início" type="date" value={inicio} onChange={(e) => setIni(e.target.value)} />
        <Campo label="Fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <Botao onClick={consultar} disabled={!funcionarioId || consultando} bloco={false}>
            {consultando ? 'Consultando…' : 'Consultar'}
          </Botao>
        </div>
      </div>
      {erro && <Feedback tom="erro">{erro}</Feedback>}
      {r && (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <div
            style={{ font: 'var(--text-base) var(--font-body)', marginBottom: 'var(--space-4)' }}
          >
            Saldo total:{' '}
            <strong style={{ font: '600 var(--text-base) var(--font-mono)' }}>
              {r.saldoTotalMin === null ? 'sem jornada definida' : formatarMinutos(r.saldoTotalMin)}
            </strong>
          </div>
          {r.dias.length === 0 ? (
            <EstadoVazio>Sem marcações no período.</EstadoVazio>
          ) : (
            <Tabela minWidth={360}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th className="g-num">Trabalhado</th>
                  <th className="g-num">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {r.dias.map((dia) => (
                  <tr key={dia.data}>
                    <td>{dia.data}</td>
                    <td className="g-num">{formatarMinutos(dia.trabalhadoMin)}</td>
                    <td
                      className="g-num"
                      style={{
                        color:
                          dia.saldoMin !== null && dia.saldoMin < 0
                            ? 'var(--color-danger)'
                            : undefined,
                      }}
                    >
                      {dia.saldoMin === null ? '—' : formatarMinutos(dia.saldoMin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </div>
      )}
    </Cartao>
  );
}
