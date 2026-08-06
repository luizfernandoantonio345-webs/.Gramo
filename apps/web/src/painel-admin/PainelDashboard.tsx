import { useCallback, useEffect, useState } from 'react';
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
  }, [carregar]);

  const carregando = !d && !erro;
  const maxPres = Math.max(1, ...(d?.presenca7dias.map((p) => p.marcacoes) ?? [1]));

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: 'var(--space-4)' }}>
      <CabecalhoPagina titulo="Dashboard geral" subtitulo="Visão executiva da operação de ponto" />

      {erro && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <PresencaAgora />
      </div>

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <AlertaExtras />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 'var(--space-3)',
          margin: '0 0 var(--space-4)',
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <Cartao>
          <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Presença (7 dias)</h2>
          {carregando ? (
            <EstadoVazio>Carregando…</EstadoVazio>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-2)',
                alignItems: 'flex-end',
                height: 132,
              }}
            >
              {d?.presenca7dias.map((p) => (
                <div key={p.dia} style={{ flex: 1, textAlign: 'center' }}>
                  <div
                    style={{ font: '600 11px var(--font-mono)', color: 'var(--color-text-muted)' }}
                  >
                    {p.marcacoes}
                  </div>
                  <div
                    role="img"
                    aria-label={`${p.dia}: ${p.marcacoes} marcações`}
                    style={{
                      height: `${Math.max(4, (p.marcacoes / maxPres) * 90)}px`,
                      background: 'var(--color-accent)',
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                  <div
                    style={{
                      font: '9px var(--font-mono)',
                      color: 'var(--color-text-muted)',
                      marginTop: 2,
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
          <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>
            Alertas prioritários (&gt;48h)
          </h2>
          {carregando ? (
            <EstadoVazio>Carregando…</EstadoVazio>
          ) : (d?.alertasPrioritarios.length ?? 0) === 0 ? (
            <EstadoVazio>Sem alertas — exceções em dia.</EstadoVazio>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {d?.alertasPrioritarios.map((a) => (
                <li
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) 0',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <Badge cor="var(--color-red-alert)">{a.tipo}</Badge>
                  <span style={{ flex: 1, font: '500 14px var(--font-body)' }}>
                    {a.funcionario}
                  </span>
                  <span style={{ font: '11px var(--font-mono)', color: 'var(--color-text-muted)' }}>
                    desde {new Date(a.desde).toLocaleString('pt-BR')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      <div style={{ height: 'var(--space-4)' }} />
      <BancoHorasTool />
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
 * Ponto de "uau" para o RH: numero vivo + quebra por filial + nomes sob demanda.
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--color-teal-success)',
              boxShadow: '0 0 0 4px rgba(30, 138, 110, 0.18)',
            }}
          />
          <h2 style={{ font: '600 16px var(--font-display)', margin: 0 }}>Presença agora</h2>
        </div>
        <span
          style={{ font: '11px var(--font-mono)', color: 'var(--color-text-muted)' }}
          role="status"
          aria-live="polite"
        >
          {p
            ? `atualizado ${new Date(p.atualizadoEm).toLocaleTimeString('pt-BR')}`
            : erro
              ? 'sem conexão'
              : '—'}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'var(--space-2)',
          margin: 'var(--space-2) 0',
        }}
      >
        <span style={{ font: '700 40px var(--font-display)', color: 'var(--color-teal-success)' }}>
          {p?.total ?? '—'}
        </span>
        <span style={{ font: '400 14px var(--font-body)', color: 'var(--color-text-muted)' }}>
          trabalhando neste momento
        </span>
      </div>

      {p && p.porFilial.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {p.porFilial.map((x) => (
            <Badge key={x.filial} cor="var(--color-navy-900)">
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
            style={{
              minHeight: 44,
              marginTop: 'var(--space-2)',
              padding: 0,
              background: 'none',
              border: 'none',
              color: 'var(--color-accent)',
              cursor: 'pointer',
              font: '500 13px var(--font-body)',
            }}
          >
            {expandido ? 'ocultar nomes' : 'ver quem está'}
          </button>
          {expandido && (
            <ul style={{ listStyle: 'none', margin: 'var(--space-2) 0 0', padding: 0 }}>
              {p.presentes.map((x, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-1) 0',
                    borderBottom: '1px solid var(--color-border)',
                    font: '400 13px var(--font-body)',
                  }}
                >
                  <span>{x.funcionario}</span>
                  <span style={{ font: '12px var(--font-mono)', color: 'var(--color-text-muted)' }}>
                    {x.filial} · desde{' '}
                    {new Date(x.desde).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
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
 * Alerta PROATIVO de hora extra do dia. Diferencial de gestao: o RH ve, AINDA
 * durante o turno, quem esta prestes a estourar (ou ja estourou) o limite legal
 * de 2h/dia -- e pode agir antes do fechamento. Poll a cada 60s (dado do dia
 * muda devagar). Reusa a mesma matematica do banco de horas no servidor.
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span aria-hidden style={{ fontSize: 18 }}>
            ⏱️
          </span>
          <h2 style={{ font: '600 16px var(--font-display)', margin: 0 }}>Hora extra — hoje</h2>
          {excedidos > 0 && <Badge cor="var(--color-red-alert)">{excedidos} no limite</Badge>}
        </div>
        <span
          style={{ font: '11px var(--font-mono)', color: 'var(--color-text-muted)' }}
          role="status"
          aria-live="polite"
        >
          {a
            ? `atualizado ${new Date(a.atualizadoEm).toLocaleTimeString('pt-BR')}`
            : erro
              ? 'sem conexão'
              : '—'}
        </span>
      </div>

      {!a ? (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <EstadoVazio>{erro ? 'Sem conexão.' : 'Carregando…'}</EstadoVazio>
        </div>
      ) : a.total === 0 ? (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <EstadoVazio>Ninguém próximo do limite de extra hoje. 👍</EstadoVazio>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 'var(--space-2) 0 0', padding: 0 }}>
          {a.alertas.map((x) => (
            <li
              key={x.funcionarioId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) 0',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <Badge
                cor={
                  x.status === 'EXCEDIDO' ? 'var(--color-red-alert)' : 'var(--color-amber-warning)'
                }
              >
                {x.status === 'EXCEDIDO' ? 'excedido' : 'atenção'}
              </Badge>
              <span style={{ flex: 1, font: '500 14px var(--font-body)' }}>{x.funcionario}</span>
              <span style={{ font: '12px var(--font-mono)', color: 'var(--color-text-muted)' }}>
                {x.filial} · extra {formatarMinutos(x.extraMin)} / {formatarMinutos(x.limiteMin)}
              </span>
            </li>
          ))}
        </ul>
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
      <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Banco de horas</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--space-2)' }}>
        <Campo
          label="Funcionário (ID)"
          value={funcionarioId}
          onChange={(e) => setFuncId(e.target.value)}
        />
        <Campo label="Início" type="date" value={inicio} onChange={(e) => setIni(e.target.value)} />
        <Campo label="Fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
      </div>
      <Botao onClick={consultar} disabled={!funcionarioId || consultando}>
        {consultando ? 'Consultando…' : 'Consultar'}
      </Botao>
      {erro && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}
      {r && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <div style={{ font: '14px var(--font-body)', marginBottom: 'var(--space-2)' }}>
            Saldo total:{' '}
            <strong style={{ font: '600 14px var(--font-mono)' }}>
              {r.saldoTotalMin === null ? 'sem jornada definida' : formatarMinutos(r.saldoTotalMin)}
            </strong>
          </div>
          {r.dias.length === 0 ? (
            <EstadoVazio>Sem marcações no período.</EstadoVazio>
          ) : (
            r.dias.map((dia) => (
              <div
                key={dia.data}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  font: '12px var(--font-mono)',
                  color: 'var(--color-text-muted)',
                  padding: '3px 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <span>{dia.data}</span>
                <span>trab {formatarMinutos(dia.trabalhadoMin)}</span>
                <span>
                  {dia.saldoMin === null ? '—' : `saldo ${formatarMinutos(dia.saldoMin)}`}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </Cartao>
  );
}
