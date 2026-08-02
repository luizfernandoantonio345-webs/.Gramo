import { useCallback, useEffect, useState } from 'react';
import { formatarBRL } from '@repp/shared';
import { Badge, Botao, Campo, Cartao } from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';

interface Empresa {
  id: string;
  razaoSocial: string;
  cnpj: string;
  subdominio: string;
  status: string;
  planoRef: { nome: string } | null;
}
interface Plano {
  id: string;
  nome: string;
  precoMensalCentavos: number;
}
interface Uso {
  funcionariosAtivos: number;
  marcacoesMes: number;
  documentos: number;
}

/** ADM 0 -- painel do Super Admin (plataforma). */
export function SuperPanel({ onSair }: { onSair: () => void }) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [uso, setUso] = useState<Record<string, Uso>>({});
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [e, p] = await Promise.all([apiGet<Empresa[]>('/super/empresas'), apiGet<Plano[]>('/super/planos')]);
      setEmpresas(e);
      setPlanos(p);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function status(id: string, acao: 'suspender' | 'ativar') {
    await apiPost(`/super/empresas/${id}/${acao}`, {}, true);
    await carregar();
  }

  async function verUso(id: string) {
    setUso((u) => ({ ...u, [id]: { funcionariosAtivos: -1, marcacoesMes: -1, documentos: -1 } }));
    const m = await apiGet<Uso>(`/super/empresas/${id}/uso`);
    setUso((u) => ({ ...u, [id]: m }));
  }

  return (
    <div>
      <div style={{ background: 'var(--color-navy-900)', color: '#fff', padding: 'var(--space-3) var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ font: '700 12px var(--font-mono)', letterSpacing: '0.15em', color: '#8fb0ef' }}>
          SUPER ADMIN · PLATAFORMA
        </span>
        <button onClick={onSair} style={{ background: 'none', border: 'none', color: '#8fb0ef', cursor: 'pointer' }}>Sair</button>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--space-4)' }}>
        {erro && <Badge cor="var(--color-red-alert)">{erro}</Badge>}

        <NovaEmpresa planos={planos} onCriada={carregar} />
        <div style={{ height: 'var(--space-3)' }} />

        <Cartao>
          <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Empresas-cliente</h2>
          {empresas.map((e) => (
            <div key={e.id} style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{e.razaoSocial}</strong>
                  <div style={{ font: '12px var(--font-mono)', color: '#5b6472' }}>
                    {e.subdominio} · {e.cnpj} · {e.planoRef?.nome ?? 'sem plano'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <Badge cor={e.status === 'ATIVA' ? 'var(--color-teal-success)' : 'var(--color-amber-warning)'}>{e.status}</Badge>
                  <button onClick={() => verUso(e.id)} style={btn()}>Uso</button>
                  {e.status === 'ATIVA' ? (
                    <button onClick={() => status(e.id, 'suspender')} style={btn('var(--color-amber-warning)')}>Suspender</button>
                  ) : (
                    <button onClick={() => status(e.id, 'ativar')} style={btn('var(--color-teal-success)')}>Ativar</button>
                  )}
                </div>
              </div>
              {uso[e.id] && (
                <div style={{ font: '12px var(--font-mono)', color: '#5b6472', marginTop: 4 }}>
                  funcionarios ativos: {uso[e.id]!.funcionariosAtivos} · marcacoes/mes: {uso[e.id]!.marcacoesMes} · documentos: {uso[e.id]!.documentos}
                </div>
              )}
            </div>
          ))}
        </Cartao>

        <div style={{ height: 'var(--space-3)' }} />
        <Cartao>
          <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Planos</h2>
          {planos.map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0' }}>
              <span>{p.nome}</span>
              <span style={{ font: '13px var(--font-mono)' }}>{formatarBRL(p.precoMensalCentavos)}/mes</span>
            </div>
          ))}
          <NovoPlano onCriado={carregar} />
        </Cartao>
      </div>
    </div>
  );
}

function NovaEmpresa({ planos, onCriada }: { planos: Plano[]; onCriada: () => void }) {
  const [razaoSocial, setRazao] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [subdominio, setSub] = useState('');
  const [planoId, setPlanoId] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    setErro(null);
    try {
      await apiPost('/super/empresas', { razaoSocial, cnpj, subdominio, planoId: planoId || undefined }, true);
      setRazao('');
      setCnpj('');
      setSub('');
      onCriada();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao cadastrar.');
    }
  }

  return (
    <Cartao>
      <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Cadastrar empresa (onboarding)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--space-2)' }}>
        <Campo label="Razao social" value={razaoSocial} onChange={(e) => setRazao(e.target.value)} />
        <Campo label="CNPJ (14 digitos)" value={cnpj} onChange={(e) => setCnpj(e.target.value.replace(/\D/g, ''))} />
        <Campo label="Subdominio" value={subdominio} onChange={(e) => setSub(e.target.value.toLowerCase())} />
      </div>
      <label style={{ display: 'block', font: '500 13px var(--font-body)' }}>Plano</label>
      <select value={planoId} onChange={(e) => setPlanoId(e.target.value)} style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-3)' }}>
        <option value="">(sem plano)</option>
        {planos.map((p) => (
          <option key={p.id} value={p.id}>{p.nome}</option>
        ))}
      </select>
      {erro && <Badge cor="var(--color-red-alert)">{erro}</Badge>}
      <Botao onClick={criar} disabled={!razaoSocial || cnpj.length !== 14 || !subdominio}>Cadastrar</Botao>
    </Cartao>
  );
}

function NovoPlano({ onCriado }: { onCriado: () => void }) {
  const [nome, setNome] = useState('');
  const [reais, setReais] = useState('');
  async function criar() {
    await apiPost('/super/planos', { nome, precoMensalCentavos: Math.round(Number(reais) * 100) }, true);
    setNome('');
    setReais('');
    onCriado();
  }
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'end', marginTop: 'var(--space-2)' }}>
      <Campo label="Novo plano" value={nome} onChange={(e) => setNome(e.target.value)} />
      <Campo label="R$/mes" value={reais} onChange={(e) => setReais(e.target.value)} />
      <Botao onClick={criar} disabled={!nome || !reais}>Criar plano</Botao>
    </div>
  );
}

function btn(cor?: string) {
  return {
    padding: '4px 10px',
    borderRadius: 'var(--radius-sm)',
    border: cor ? 'none' : '1px solid var(--color-border)',
    background: cor ?? 'var(--color-surface)',
    color: cor ? '#fff' : 'var(--color-navy-900)',
    cursor: 'pointer',
    font: '500 12px var(--font-body)',
  } as const;
}
