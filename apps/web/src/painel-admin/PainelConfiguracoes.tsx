import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  EstadoVazio,
  Feedback,
  Selecao,
} from '../design-system/components';
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
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const grid2 = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 'var(--space-4)',
  } as const;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--space-4)' }}>
      <CabecalhoPagina
        titulo="Configurações"
        subtitulo="Filiais (estabelecimentos), jornadas e feriados"
      />
      {erro && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}

      <div style={{ ...grid2, marginBottom: 'var(--space-4)' }}>
        <NovaFilial onCriada={carregar} />
        <Cartao>
          <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>
            Filiais (estabelecimentos)
          </h2>
          {filiais.length === 0 ? (
            <EstadoVazio>Nenhuma filial. Cadastre a primeira ao lado.</EstadoVazio>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {filiais.map((f) => (
                <li
                  key={f.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) 0',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <strong style={{ font: '600 14px var(--font-body)' }}>{f.nome}</strong>
                  <span style={{ font: '12px var(--font-mono)', color: '#5b6472' }}>
                    {f.cnpj ?? 'sem CNPJ'} · {f.timezone}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      <div style={grid2}>
        <div>
          <NovaJornada onCriada={carregar} />
          <div style={{ height: 'var(--space-3)' }} />
          <Cartao>
            <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Jornadas padrão</h2>
            {jornadas.length === 0 ? (
              <EstadoVazio>Nenhuma jornada cadastrada.</EstadoVazio>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {jornadas.map((j) => (
                  <li
                    key={j.id}
                    style={{
                      padding: 'var(--space-2) 0',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <strong style={{ font: '600 14px var(--font-body)' }}>{j.nome}</strong>
                    <div style={{ font: '12px var(--font-mono)', color: '#5b6472' }}>
                      {j.horaEntrada}-{j.horaSaida} · tol {j.toleranciaMinutos}min ·{' '}
                      {j.diasSemana.map((d) => DIAS[d]).join(' ')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>

        <div>
          <NovoFeriado onCriado={carregar} />
          <div style={{ height: 'var(--space-3)' }} />
          <Cartao>
            <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Feriados</h2>
            {feriados.length === 0 ? (
              <EstadoVazio>Nenhum feriado cadastrado.</EstadoVazio>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {feriados.map((f) => (
                  <li
                    key={f.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-2) 0',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <span style={{ font: '13px var(--font-mono)' }}>{f.data.slice(0, 10)}</span>
                    <span style={{ flex: 1, font: '500 14px var(--font-body)' }}>{f.nome}</span>
                    <Badge cor="var(--color-navy-900)">{f.tipo.toLowerCase()}</Badge>
                  </li>
                ))}
              </ul>
            )}
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
    if (cnpjLimpo && cnpjLimpo.length !== 14)
      return setErro('CNPJ deve ter 14 dígitos (ou deixe vazio).');
    try {
      await apiPost('/admin/configuracoes/filiais', { nome, cnpj: cnpjLimpo || undefined }, true);
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
      <Campo
        label="Nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Ex.: Matriz, Filial Centro"
      />
      <Campo
        label="CNPJ (opcional, 14 dígitos)"
        inputMode="numeric"
        value={cnpj}
        onChange={(e) => setCnpj(e.target.value)}
        placeholder="somente números"
      />
      {erro && (
        <div style={{ marginBottom: 'var(--space-2)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}
      <Botao onClick={criar} disabled={!nome}>
        Criar filial
      </Botao>
    </Cartao>
  );
}

const REGIMES: { v: string; rot: string }[] = [
  { v: 'COMPENSACAO_MENSAL', rot: 'Compensação mensal' },
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
        <Campo
          label="Entrada"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="08:00"
        />
        <Campo
          label="Saída"
          value={saida}
          onChange={(e) => setSaida(e.target.value)}
          placeholder="17:00"
        />
        <Campo label="Tolerância (min)" value={tol} onChange={(e) => setTol(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
        <Campo
          label="Carga diária (min)"
          inputMode="numeric"
          value={carga}
          onChange={(e) => setCarga(e.target.value)}
          placeholder="480 = 8h"
        />
        <Campo
          label="Limite extra/dia (min)"
          inputMode="numeric"
          value={limiteExtra}
          onChange={(e) => setLimiteExtra(e.target.value)}
          placeholder="120 = 2h (CLT)"
        />
      </div>
      <Selecao label="Regime de horas" value={regime} onChange={(e) => setRegime(e.target.value)}>
        {REGIMES.map((r) => (
          <option key={r.v} value={r.v}>
            {r.rot}
          </option>
        ))}
      </Selecao>
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-1)',
          marginBottom: 'var(--space-3)',
          flexWrap: 'wrap',
        }}
      >
        {DIAS.map((rot, d) => {
          const ativo = dias.includes(d);
          return (
            <button
              key={d}
              onClick={() => toggle(d)}
              aria-pressed={ativo}
              style={{
                minHeight: 44,
                padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${ativo ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: ativo ? 'var(--color-accent)' : 'var(--color-surface)',
                color: ativo ? '#fff' : 'var(--color-navy-900)',
                cursor: 'pointer',
                font: '600 12px var(--font-body)',
              }}
            >
              {rot}
            </button>
          );
        })}
      </div>
      {erro && (
        <div style={{ marginBottom: 'var(--space-2)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}
      <Botao onClick={criar} disabled={!nome || dias.length === 0}>
        Criar jornada
      </Botao>
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
      <Selecao label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
        {['NACIONAL', 'ESTADUAL', 'MUNICIPAL', 'FACULTATIVO'].map((t) => (
          <option key={t} value={t}>
            {t.toLowerCase()}
          </option>
        ))}
      </Selecao>
      <Botao onClick={criar} disabled={!data || !nome}>
        Adicionar feriado
      </Botao>
    </Cartao>
  );
}
