import { useCallback, useEffect, useState } from 'react';
import { Badge, Botao, Campo, Cartao, Selecao } from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';

interface Exportacao {
  id: string;
  tipoArquivo: string;
  periodoReferencia: string;
  totalRegistros: number;
  hashArquivo: string;
  criadoEm: string;
}

interface FilialRef {
  id: string;
  nome: string;
}

/** ADM 6 -- Relatorios e Exportacoes legais (AFD/AEJ, fiscalizacao). */
export function PainelRelatorios() {
  const [inicio, setInicio] = useState('2026-07-01');
  const [fim, setFim] = useState('2026-07-31');
  const [filialId, setFilialId] = useState('');
  const [filiais, setFiliais] = useState<FilialRef[]>([]);
  const [lista, setLista] = useState<Exportacao[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLista(await apiGet<Exportacao[]>('/admin/exportacoes'));
      setFiliais(await apiGet<FilialRef[]>('/admin/configuracoes/filiais'));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function periodo() {
    return {
      inicio: new Date(inicio).toISOString(),
      fim: new Date(`${fim}T23:59:59`).toISOString(),
      // AFD/AEJ sao por estabelecimento (NSR sequencial por filial).
      ...(filialId ? { filialId } : {}),
    };
  }

  async function gerar(tipo: 'afd' | 'aej') {
    setMsg(null);
    try {
      const r = await apiPost<{ hashArquivo: string; totalRegistros: number }>(`/admin/exportacoes/${tipo}`, periodo(), true);
      setMsg(`${tipo.toUpperCase()} gerado: ${r.totalRegistros} registros · hash ${r.hashArquivo.slice(0, 16)}...`);
      await carregar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao gerar.');
    }
  }

  async function pacote() {
    setMsg(null);
    try {
      const r = await apiPost<{ afd: { hash: string }; aej: { hash: string }; trilha: { marcacoes: number } }>(
        '/admin/relatorios/fiscalizacao',
        periodo(),
        true,
      );
      setMsg(`Pacote gerado (AFD+AEJ+trilha). Marcacoes: ${r.trilha.marcacoes}.`);
      await carregar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao gerar pacote.');
    }
  }

  async function baixar(id: string, tipo: string) {
    const r = await apiGet<{ conteudoBase64: string; integridadeOk: boolean; assinaturaValida: boolean }>(
      `/admin/exportacoes/${id}/download`,
    );
    const a = document.createElement('a');
    a.href = `data:application/octet-stream;base64,${r.conteudoBase64}`;
    a.download = `${tipo}_${id.slice(0, 8)}.txt`;
    a.click();
    setMsg(`Download ${tipo} · integridade ${r.integridadeOk ? 'OK' : 'FALHOU'} · assinatura ${r.assinaturaValida ? 'valida' : 'invalida'}`);
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ font: '700 24px var(--font-display)' }}>Relatorios e Exportacoes</h1>
      <p style={{ color: '#5b6472', font: '400 13px var(--font-body)', marginTop: 0 }}>
        Portaria 671: AFD, AEJ e pacote de fiscalizacao (com hash + assinatura do servidor).
      </p>
      {msg && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Badge cor="var(--color-accent)">{msg}</Badge>
        </div>
      )}

      <Cartao>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
          <Campo label="Inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          <Campo label="Fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
        <Selecao label="Filial (obrigatoria p/ AFD quando ha mais de uma)" value={filialId} onChange={(e) => setFilialId(e.target.value)}>
          <option value="">Todas / unica filial</option>
          {filiais.map((f) => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </Selecao>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Botao onClick={() => gerar('afd')}>Gerar AFD</Botao>
          <Botao onClick={() => gerar('aej')}>Gerar AEJ</Botao>
          <Botao variante="secundario" onClick={pacote}>Pacote fiscalizacao</Botao>
        </div>
      </Cartao>

      <div style={{ height: 'var(--space-3)' }} />
      <Cartao>
        <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Exportacoes geradas</h2>
        {lista.length === 0 && <p style={{ color: '#5b6472' }}>Nenhuma exportacao.</p>}
        {lista.map((e) => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
            <Badge cor="var(--color-navy-900)">{e.tipoArquivo}</Badge>
            <span style={{ font: '12px var(--font-mono)' }}>{e.periodoReferencia}</span>
            <span style={{ font: '12px var(--font-body)' }}>{e.totalRegistros} reg.</span>
            <span style={{ font: '11px var(--font-mono)', color: '#5b6472' }}>{e.hashArquivo.slice(0, 12)}...</span>
            <button onClick={() => baixar(e.id, e.tipoArquivo)} style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer' }}>
              Baixar
            </button>
          </div>
        ))}
      </Cartao>
    </div>
  );
}
