import { useCallback, useEffect, useState } from 'react';
import { formatarMinutos } from '@repp/shared';
import { Badge, Botao, Campo, Cartao } from '../design-system/components';
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
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  const maxPres = Math.max(1, ...(d?.presenca7dias.map((p) => p.marcacoes) ?? [1]));

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ font: '700 24px var(--font-display)' }}>Dashboard geral</h1>
      {erro && <Badge cor="var(--color-red-alert)">{erro}</Badge>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', margin: 'var(--space-3) 0' }}>
        <Kpi t="Funcionarios ativos" v={d?.kpis.funcionariosAtivos} />
        <Kpi t="Marcacoes hoje" v={d?.kpis.marcacoesHoje} />
        <Kpi t="Fora da REGAP" v={d?.kpis.foraRegapHoje} cor="var(--color-amber-warning)" />
        <Kpi t="Excecoes pendentes" v={d?.kpis.excecoesPendentes} cor="var(--color-red-alert)" />
        <Kpi t="Docs vencendo (30d)" v={d?.kpis.documentosVencendo} cor="var(--color-amber-warning)" />
        <Kpi t="Contestacoes abertas" v={d?.kpis.contestacoesAbertas} />
        <Kpi t="Ferias pendentes" v={d?.kpis.feriasPendentes} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <Cartao>
          <h2 style={{ font: '600 15px var(--font-display)', marginTop: 0 }}>Presenca (7 dias)</h2>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', height: 120 }}>
            {d?.presenca7dias.map((p) => (
              <div key={p.dia} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: `${(p.marcacoes / maxPres) * 90}px`, background: 'var(--color-accent)', borderRadius: '4px 4px 0 0' }} />
                <div style={{ font: '9px var(--font-mono)', color: '#5b6472', marginTop: 2 }}>{p.dia.slice(5)}</div>
              </div>
            ))}
          </div>
        </Cartao>

        <Cartao>
          <h2 style={{ font: '600 15px var(--font-display)', marginTop: 0 }}>Alertas prioritarios (&gt;48h)</h2>
          {d?.alertasPrioritarios.length === 0 && <p style={{ color: '#5b6472' }}>Sem alertas.</p>}
          {d?.alertasPrioritarios.map((a) => (
            <div key={a.id} style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
              <Badge cor="var(--color-red-alert)">{a.tipo}</Badge> {a.funcionario}
              <div style={{ font: '11px var(--font-mono)', color: '#5b6472' }}>desde {new Date(a.desde).toLocaleString('pt-BR')}</div>
            </div>
          ))}
        </Cartao>
      </div>

      <div style={{ height: 'var(--space-3)' }} />
      <BancoHorasTool />
    </div>
  );
}

function Kpi({ t, v, cor }: { t: string; v?: number; cor?: string }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
      <div style={{ font: '700 26px var(--font-display)', color: cor ?? 'var(--color-navy-900)' }}>{v ?? '--'}</div>
      <div style={{ font: '400 12px var(--font-body)', color: '#5b6472' }}>{t}</div>
    </div>
  );
}

function BancoHorasTool() {
  const [funcionarioId, setFuncId] = useState('');
  const [inicio, setIni] = useState('2026-07-01');
  const [fim, setFim] = useState('2026-07-31');
  const [r, setR] = useState<BancoHoras | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function consultar() {
    setErro(null);
    try {
      const q = `?funcionarioId=${funcionarioId}&inicio=${new Date(inicio).toISOString()}&fim=${new Date(`${fim}T23:59:59`).toISOString()}`;
      setR(await apiGet<BancoHoras>(`/admin/pontos/banco-horas${q}`));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao consultar.');
    }
  }

  return (
    <Cartao>
      <h2 style={{ font: '600 15px var(--font-display)', marginTop: 0 }}>Banco de horas</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--space-2)' }}>
        <Campo label="Funcionario (ID)" value={funcionarioId} onChange={(e) => setFuncId(e.target.value)} />
        <Campo label="Inicio" type="date" value={inicio} onChange={(e) => setIni(e.target.value)} />
        <Campo label="Fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
      </div>
      <Botao onClick={consultar} disabled={!funcionarioId}>Consultar</Botao>
      {erro && <Badge cor="var(--color-red-alert)">{erro}</Badge>}
      {r && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <div style={{ font: '13px var(--font-body)', marginBottom: 'var(--space-2)' }}>
            Saldo total: <strong style={{ font: 'var(--font-mono)' }}>{r.saldoTotalMin === null ? 'sem jornada' : formatarMinutos(r.saldoTotalMin)}</strong>
          </div>
          {r.dias.map((dia) => (
            <div key={dia.data} style={{ display: 'flex', justifyContent: 'space-between', font: '12px var(--font-mono)', color: '#5b6472', padding: '2px 0' }}>
              <span>{dia.data}</span>
              <span>trab {formatarMinutos(dia.trabalhadoMin)}</span>
              <span>{dia.saldoMin === null ? '-' : `saldo ${formatarMinutos(dia.saldoMin)}`}</span>
            </div>
          ))}
        </div>
      )}
    </Cartao>
  );
}
