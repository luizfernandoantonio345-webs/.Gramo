import { useCallback, useEffect, useState } from 'react';
import { Badge, Botao, Campo, Cartao } from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';

interface Chave {
  id: string;
  nome: string;
  prefixo: string;
  escopo: string;
  revogadaEm: string | null;
}
interface Config {
  id: string;
  tipo: string;
  ativo: boolean;
}

/** ADM 9 -- Integracoes: chaves de API e config folha/eSocial. */
export function PainelIntegracoes() {
  const [chaves, setChaves] = useState<Chave[]>([]);
  const [config, setConfig] = useState<Config[]>([]);
  const [nome, setNome] = useState('');
  const [tokenNovo, setTokenNovo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [c, cfg] = await Promise.all([
        apiGet<Chave[]>('/admin/integracoes/chaves'),
        apiGet<Config[]>('/admin/integracoes/config'),
      ]);
      setChaves(c);
      setConfig(cfg);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function gerar() {
    setErro(null);
    try {
      const r = await apiPost<{ token: string }>('/admin/integracoes/chaves', { nome }, true);
      setTokenNovo(r.token);
      setNome('');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar.');
    }
  }
  async function revogar(id: string) {
    await apiPost(`/admin/integracoes/chaves/${id}/revogar`, {}, true);
    await carregar();
  }
  async function alternar(tipo: string, ativo: boolean) {
    await apiPost(`/admin/integracoes/config/${tipo}`, { ativo }, true);
    await carregar();
  }

  const tipoAtivo = (t: string) => config.find((c) => c.tipo === t)?.ativo ?? false;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ font: '700 24px var(--font-display)' }}>Integracoes</h1>
      {erro && <Badge cor="var(--color-red-alert)">{erro}</Badge>}

      <Cartao>
        <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Integracoes de RH</h2>
        {['FOLHA_PAGAMENTO', 'ESOCIAL'].map((t) => (
          <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
            <div>
              <strong>{t.replace('_', ' ')}</strong>
              <div style={{ font: '11px var(--font-body)', color: '#5b6472' }}>
                {t === 'ESOCIAL' ? 'Transmissao de eventos de jornada (infra externa).' : 'Envio de banco de horas/horas extras.'}
              </div>
            </div>
            <button onClick={() => alternar(t, !tipoAtivo(t))} style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: tipoAtivo(t) ? 'var(--color-teal-success)' : 'var(--color-border)', color: tipoAtivo(t) ? '#fff' : 'var(--color-navy-900)', cursor: 'pointer', font: '500 12px var(--font-body)' }}>
              {tipoAtivo(t) ? 'ativa' : 'inativa'}
            </button>
          </div>
        ))}
      </Cartao>

      <div style={{ height: 'var(--space-3)' }} />
      <Cartao>
        <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Chaves de API</h2>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'end' }}>
          <Campo label="Nome da chave" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Botao onClick={gerar} disabled={!nome}>Gerar chave</Botao>
        </div>
        {tokenNovo && (
          <div style={{ margin: 'var(--space-2) 0', padding: 'var(--space-2)', background: 'var(--color-neutral-bg)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ font: '600 12px var(--font-body)', color: 'var(--color-red-alert)' }}>Copie agora (nao sera exibida de novo):</div>
            <code style={{ font: '12px var(--font-mono)', wordBreak: 'break-all' }}>{tokenNovo}</code>
          </div>
        )}
        {chaves.map((c) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
            <div>
              <strong>{c.nome}</strong>
              <div style={{ font: '11px var(--font-mono)', color: '#5b6472' }}>{c.prefixo}... · {c.escopo}</div>
            </div>
            {c.revogadaEm ? (
              <Badge cor="var(--color-border)">revogada</Badge>
            ) : (
              <button onClick={() => revogar(c.id)} style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-red-alert)', color: '#fff', cursor: 'pointer', font: '500 12px var(--font-body)' }}>
                Revogar
              </button>
            )}
          </div>
        ))}
      </Cartao>
    </div>
  );
}
