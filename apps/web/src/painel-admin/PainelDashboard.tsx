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
                  <div style={{ font: '600 11px var(--font-mono)', color: '#5b6472' }}>
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
                  <div style={{ font: '9px var(--font-mono)', color: '#5b6472', marginTop: 2 }}>
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
                  <span style={{ font: '11px var(--font-mono)', color: '#5b6472' }}>
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
                  color: '#5b6472',
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
