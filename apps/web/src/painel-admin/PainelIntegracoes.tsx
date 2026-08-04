import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  EstadoVazio,
  Feedback,
} from '../design-system/components';
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
      setErro(null);
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
      <CabecalhoPagina
        titulo="Integrações"
        subtitulo="Chaves de API e conectores de folha / eSocial"
      />
      {erro && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}

      <Cartao>
        <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Integrações de RH</h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {['FOLHA_PAGAMENTO', 'ESOCIAL'].map((t) => {
            const ativo = tipoAtivo(t);
            return (
              <li
                key={t}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <strong style={{ font: '600 14px var(--font-body)' }}>
                    {t.replace('_', ' ').toLowerCase()}
                  </strong>
                  <div style={{ font: '11px var(--font-body)', color: '#5b6472' }}>
                    {t === 'ESOCIAL'
                      ? 'Transmissão de eventos de jornada (infra externa).'
                      : 'Envio de banco de horas / horas extras.'}
                  </div>
                </div>
                <button
                  onClick={() => alternar(t, !ativo)}
                  aria-pressed={ativo}
                  style={{
                    minHeight: 44,
                    padding: '0 var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: ativo ? 'var(--color-teal-success)' : 'var(--color-border)',
                    color: ativo ? '#fff' : 'var(--color-navy-900)',
                    cursor: 'pointer',
                    font: '600 12px var(--font-body)',
                  }}
                >
                  {ativo ? 'ativa' : 'inativa'}
                </button>
              </li>
            );
          })}
        </ul>
      </Cartao>

      <div style={{ height: 'var(--space-3)' }} />
      <Cartao>
        <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Chaves de API</h2>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Campo label="Nome da chave" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <Botao onClick={gerar} disabled={!nome}>
              Gerar chave
            </Botao>
          </div>
        </div>
        {tokenNovo && (
          <div style={{ margin: 'var(--space-2) 0' }}>
            <Feedback tom="aviso">
              Copie agora — não será exibida de novo:
              <br />
              <code style={{ font: '12px var(--font-mono)', wordBreak: 'break-all' }}>
                {tokenNovo}
              </code>
            </Feedback>
          </div>
        )}
        {chaves.length === 0 ? (
          <EstadoVazio>Nenhuma chave gerada.</EstadoVazio>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {chaves.map((c) => (
              <li
                key={c.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <strong style={{ font: '600 14px var(--font-body)' }}>{c.nome}</strong>
                  <div style={{ font: '11px var(--font-mono)', color: '#5b6472' }}>
                    {c.prefixo}… · {c.escopo}
                  </div>
                </div>
                {c.revogadaEm ? (
                  <Badge cor="var(--color-border)">revogada</Badge>
                ) : (
                  <button
                    onClick={() => revogar(c.id)}
                    style={{
                      minHeight: 44,
                      padding: '0 var(--space-3)',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: 'var(--color-red-alert)',
                      color: '#fff',
                      cursor: 'pointer',
                      font: '600 12px var(--font-body)',
                    }}
                  >
                    Revogar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
