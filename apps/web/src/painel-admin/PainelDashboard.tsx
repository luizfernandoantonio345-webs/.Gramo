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
  LinhaLista,
  Tabela,
  TituloSecao,
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
          <TituloSecao>Presença (7 dias)</TituloSecao>
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
          <TituloSecao>Alertas prioritários · exceções &gt; 48h</TituloSecao>
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

      <IndicadoresRh />
      <ComparativoObras />
      <BancoHorasTool />
    </div>
  );
}

/* Lista vertical (empilha LinhaLista, que ja traz a divisoria). */
function Lista({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>;
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
      <TituloSecao
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
      </TituloSecao>

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
      <TituloSecao
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
      </TituloSecao>

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
      <TituloSecao meta={<span style={metaStyle}>mês corrente</span>}>
        Comparativo entre obras
      </TituloSecao>
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

interface IndicadoresRhData {
  periodo: { inicio: string; fim: string };
  marcacoes: {
    total: number;
    validas: number;
    pendenteHorario: number;
    pendenteIdentidade: number;
    pendenteRegap: number;
    foraRegap: number;
    percentualConformidade: number;
  };
  atrasos: { entradasForaHorario: number };
  ausencias: {
    total: number;
    porTipo: Array<{ tipo: string; total: number }>;
    funcionariosAfetados: number;
  };
  rotatividade: {
    admissoes: number;
    desligamentos: number;
    headcount: number;
    taxaTurnover: number;
  };
  ranking: Array<{ funcionario: string; filial: string; naoConformes: number }>;
}

const ROTULO_AUSENCIA: Record<string, string> = {
  FERIAS: 'Férias',
  AFASTAMENTO: 'Afastamento',
  LICENCA: 'Licença',
  ATESTADO: 'Atestado',
  OUTRO: 'Outro',
};

// Primeiro dia do mes corrente e hoje, em YYYY-MM-DD (default do filtro).
function mesCorrente(): { inicio: string; fim: string } {
  const h = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  return {
    inicio: `${h.getFullYear()}-${p2(h.getMonth() + 1)}-01`,
    fim: `${h.getFullYear()}-${p2(h.getMonth() + 1)}-${p2(h.getDate())}`,
  };
}

/**
 * Indicadores de RH do periodo: conformidade das marcacoes, atrasos, ausencias
 * aprovadas por tipo e o ranking de quem tem mais marcacoes NAO conformes (foco
 * de atencao do RH). Filtro de periodo (default: mes corrente).
 */
function IndicadoresRh() {
  const inicial = mesCorrente();
  const [inicio, setInicio] = useState(inicial.inicio);
  const [fim, setFim] = useState(inicial.fim);
  const [d, setD] = useState<IndicadoresRhData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async (ini: string, f: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const q = `?inicio=${new Date(ini).toISOString()}&fim=${new Date(`${f}T23:59:59`).toISOString()}`;
      setD(await apiGet<IndicadoresRhData>(`/admin/dashboard/indicadores-rh${q}`));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar indicadores.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar(inicial.inicio, inicial.fim);
  }, [carregar, inicial.inicio, inicial.fim]);

  const m = d?.marcacoes;

  return (
    <Cartao>
      <TituloSecao meta={<span style={metaStyle}>indicadores de RH</span>}>
        Indicadores de RH
      </TituloSecao>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr auto',
          gap: 'var(--space-4)',
          alignItems: 'end',
          marginBottom: 'var(--space-5)',
        }}
      >
        <Campo
          label="Início"
          type="date"
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
        />
        <Campo label="Fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <Botao onClick={() => void carregar(inicio, fim)} disabled={carregando} bloco={false}>
            {carregando ? 'Carregando…' : 'Aplicar'}
          </Botao>
        </div>
      </div>

      {erro && <Feedback tom="erro">{erro}</Feedback>}

      {!d && !erro ? (
        <EstadoVazio>Carregando…</EstadoVazio>
      ) : (
        d && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 'var(--space-5)',
              }}
            >
              <Kpi
                rotulo="Conformidade"
                valor={`${m?.percentualConformidade.toFixed(1)}%`}
                tom={m && m.percentualConformidade >= 90 ? 'ok' : 'aviso'}
              />
              <Kpi rotulo="Marcações" valor={m?.total ?? '—'} />
              <Kpi
                rotulo="Atrasos (entrada)"
                valor={d.atrasos.entradasForaHorario}
                tom={d.atrasos.entradasForaHorario > 0 ? 'aviso' : 'neutro'}
              />
              <Kpi
                rotulo="Fora da REGAP"
                valor={m?.foraRegap ?? '—'}
                tom={m && m.foraRegap > 0 ? 'aviso' : 'neutro'}
              />
              <Kpi rotulo="Ausências (pessoas)" valor={d.ausencias.funcionariosAfetados} />
            </div>

            <div style={{ marginTop: 'var(--space-6)' }}>
              <TituloSecao meta={<span style={metaStyle}>movimentação de pessoal</span>}>
                Rotatividade
              </TituloSecao>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 'var(--space-5)',
                }}
              >
                <Kpi
                  rotulo="Turnover"
                  valor={`${d.rotatividade.taxaTurnover.toFixed(1)}%`}
                  tom={d.rotatividade.taxaTurnover >= 5 ? 'aviso' : 'ok'}
                />
                <Kpi rotulo="Admissões" valor={d.rotatividade.admissoes} />
                <Kpi
                  rotulo="Desligamentos"
                  valor={d.rotatividade.desligamentos}
                  tom={d.rotatividade.desligamentos > 0 ? 'aviso' : 'neutro'}
                />
                <Kpi rotulo="Headcount ativo" valor={d.rotatividade.headcount} />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 'var(--space-6)',
                marginTop: 'var(--space-6)',
              }}
            >
              <div>
                <TituloSecao meta={<span style={metaStyle}>aprovadas no período</span>}>
                  Ausências por tipo
                </TituloSecao>
                {d.ausencias.porTipo.length === 0 ? (
                  <EstadoVazio>Nenhuma ausência aprovada no período.</EstadoVazio>
                ) : (
                  <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    {d.ausencias.porTipo.map((t) => (
                      <Badge key={t.tipo} cor="var(--color-accent)">
                        {ROTULO_AUSENCIA[t.tipo] ?? t.tipo}: {t.total}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <TituloSecao meta={<span style={metaStyle}>foco de atenção</span>}>
                  Ranking de não-conformidade
                </TituloSecao>
                {d.ranking.length === 0 ? (
                  <EstadoVazio>Sem marcações não conformes. 👏</EstadoVazio>
                ) : (
                  <Tabela minWidth={320}>
                    <thead>
                      <tr>
                        <th>Funcionário</th>
                        <th>Obra</th>
                        <th className="g-num">Não conformes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.ranking.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{r.funcionario}</td>
                          <td>{r.filial}</td>
                          <td className="g-num">
                            <Badge cor="var(--color-danger)">{r.naoConformes}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Tabela>
                )}
              </div>
            </div>
          </>
        )
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
      <TituloSecao>Banco de horas</TituloSecao>
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
