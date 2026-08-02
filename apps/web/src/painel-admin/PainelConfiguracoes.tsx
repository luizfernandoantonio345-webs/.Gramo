import { useCallback, useEffect, useState } from 'react';
import { Badge, Botao, Campo, Cartao, Selecao } from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';

interface Jornada {
  id: string;
  nome: string;
  horaEntrada: string;
  horaSaida: string;
  toleranciaMinutos: number;
  diasSemana: number[];
}
interface Feriado {
  id: string;
  data: string;
  nome: string;
  tipo: string;
}
interface Filial {
  id: string;
  nome: string;
  cnpj: string | null;
  timezone: string;
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

/** ADM 7 -- Configuracoes da Empresa: filiais, jornadas e feriados. */
export function PainelConfiguracoes() {
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [fi, j, f] = await Promise.all([
        apiGet<Filial[]>('/admin/configuracoes/filiais'),
        apiGet<Jornada[]>('/admin/configuracoes/jornadas'),
        apiGet<Feriado[]>('/admin/configuracoes/feriados'),
      ]);
      setFiliais(fi);
      setJornadas(j);
      setFeriados(f);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ font: '700 24px var(--font-display)' }}>Configuracoes</h1>
      {erro && <Badge cor="var(--color-red-alert)">{erro}</Badge>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <NovaFilial onCriada={carregar} />
        <Cartao>
          <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Filiais (estabelecimentos)</h2>
          {filiais.length === 0 && <p style={{ color: '#5b6472' }}>Nenhuma filial. Cadastre a primeira ao lado.</p>}
          {filiais.map((f) => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
              <strong>{f.nome}</strong>
              <span style={{ font: '12px var(--font-mono)', color: '#5b6472' }}>{f.cnpj ?? 'sem CNPJ'} · {f.timezone}</span>
            </div>
          ))}
        </Cartao>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <div>
          <NovaJornada onCriada={carregar} />
          <div style={{ height: 'var(--space-3)' }} />
          <Cartao>
            <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Jornadas padrao</h2>
            {jornadas.map((j) => (
              <div key={j.id} style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                <strong>{j.nome}</strong>
                <div style={{ font: '12px var(--font-mono)', color: '#5b6472' }}>
                  {j.horaEntrada}-{j.horaSaida} · tol {j.toleranciaMinutos}min ·{' '}
                  {j.diasSemana.map((d) => DIAS[d]).join(' ')}
                </div>
              </div>
            ))}
          </Cartao>
        </div>

        <div>
          <NovoFeriado onCriado={carregar} />
          <div style={{ height: 'var(--space-3)' }} />
          <Cartao>
            <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Feriados</h2>
            {feriados.map((f) => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ font: '13px var(--font-mono)' }}>{f.data.slice(0, 10)}</span>
                <span>{f.nome}</span>
                <Badge cor="var(--color-navy-900)">{f.tipo}</Badge>
              </div>
            ))}
          </Cartao>
        </div>
      </div>
    </div>
  );
}

function NovaFilial({ onCriada }: { onCriada: () => void }) {
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    setErro(null);
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo && cnpjLimpo.length !== 14) return setErro('CNPJ deve ter 14 digitos (ou deixe vazio).');
    try {
      await apiPost(
        '/admin/configuracoes/filiais',
        { nome, cnpj: cnpjLimpo || undefined },
        true,
      );
      setNome('');
      setCnpj('');
      onCriada();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao criar filial.');
    }
  }

  return (
    <Cartao>
      <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Nova filial</h2>
      <Campo label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Matriz, Filial Centro" />
      <Campo label="CNPJ (opcional, 14 digitos)" inputMode="numeric" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="somente numeros" />
      {erro && <Badge cor="var(--color-red-alert)">{erro}</Badge>}
      <Botao onClick={criar} disabled={!nome}>Criar filial</Botao>
    </Cartao>
  );
}

const REGIMES: { v: string; rot: string }[] = [
  { v: 'COMPENSACAO_MENSAL', rot: 'Compensacao mensal' },
  { v: 'BANCO_ANUAL', rot: 'Banco anual (acordo coletivo)' },
  { v: 'HORA_EXTRA', rot: 'Hora extra direta (sem banco)' },
];

function NovaJornada({ onCriada }: { onCriada: () => void }) {
  const [nome, setNome] = useState('');
  const [entrada, setEntrada] = useState('08:00');
  const [saida, setSaida] = useState('17:00');
  const [tol, setTol] = useState('10');
  const [carga, setCarga] = useState('480');
  const [regime, setRegime] = useState('COMPENSACAO_MENSAL');
  const [limiteExtra, setLimiteExtra] = useState('120');
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [erro, setErro] = useState<string | null>(null);

  function toggle(d: number) {
    setDias((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort()));
  }
  async function criar() {
    setErro(null);
    try {
      await apiPost(
        '/admin/configuracoes/jornadas',
        {
          nome,
          horaEntrada: entrada,
          horaSaida: saida,
          toleranciaMinutos: Number(tol),
          diasSemana: dias,
          cargaDiariaMinutos: Number(carga),
          regimeHoras: regime,
          limiteExtraDiariaMin: Number(limiteExtra),
        },
        true,
      );
      setNome('');
      onCriada();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao criar jornada.');
    }
  }

  return (
    <Cartao>
      <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Nova jornada</h2>
      <Campo label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
        <Campo label="Entrada" value={entrada} onChange={(e) => setEntrada(e.target.value)} placeholder="08:00" />
        <Campo label="Saida" value={saida} onChange={(e) => setSaida(e.target.value)} placeholder="17:00" />
        <Campo label="Tolerancia (min)" value={tol} onChange={(e) => setTol(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
        <Campo label="Carga diaria (min)" inputMode="numeric" value={carga} onChange={(e) => setCarga(e.target.value)} placeholder="480 = 8h" />
        <Campo label="Limite extra/dia (min)" inputMode="numeric" value={limiteExtra} onChange={(e) => setLimiteExtra(e.target.value)} placeholder="120 = 2h (CLT)" />
      </div>
      <Selecao label="Regime de horas" value={regime} onChange={(e) => setRegime(e.target.value)}>
        {REGIMES.map((r) => (
          <option key={r.v} value={r.v}>{r.rot}</option>
        ))}
      </Selecao>
      <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        {DIAS.map((rot, d) => (
          <button
            key={d}
            onClick={() => toggle(d)}
            style={{
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: dias.includes(d) ? 'var(--color-accent)' : 'var(--color-surface)',
              color: dias.includes(d) ? '#fff' : 'var(--color-navy-900)',
              cursor: 'pointer',
              font: '500 12px var(--font-body)',
            }}
          >
            {rot}
          </button>
        ))}
      </div>
      {erro && <Badge cor="var(--color-red-alert)">{erro}</Badge>}
      <Botao onClick={criar} disabled={!nome || dias.length === 0}>Criar jornada</Botao>
    </Cartao>
  );
}

function NovoFeriado({ onCriado }: { onCriado: () => void }) {
  const [data, setData] = useState('');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('NACIONAL');
  async function criar() {
    await apiPost('/admin/configuracoes/feriados', { data, nome, tipo }, true);
    setData('');
    setNome('');
    onCriado();
  }
  return (
    <Cartao>
      <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Novo feriado</h2>
      <Campo label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
      <Campo label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      <label style={{ display: 'block', font: '500 13px var(--font-body)' }}>Tipo</label>
      <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-3)' }}>
        {['NACIONAL', 'ESTADUAL', 'MUNICIPAL', 'FACULTATIVO'].map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <Botao onClick={criar} disabled={!data || !nome}>Adicionar feriado</Botao>
    </Cartao>
  );
}
