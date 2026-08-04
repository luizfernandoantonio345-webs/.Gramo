import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CabecalhoPagina, Cartao, EstadoVazio, Feedback } from '../design-system/components';
import { apiGet } from '../lib/api';

interface LogAuditoria {
  id: string;
  usuarioTipo: string;
  acao: string;
  entidadeAfetada: string;
  ip: string | null;
  timestamp: string;
}
interface LogAcesso {
  id: string;
  sujeitoTipo: string;
  identificador: string | null;
  evento: string;
  ip: string | null;
  timestamp: string;
}

type Aba = 'trilha' | 'acessos';

/** ADM 6 -- Relatorios e Auditoria (Trilha de Confianca). */
export function PainelAuditoria() {
  const [aba, setAba] = useState<Aba>('trilha');
  const [trilha, setTrilha] = useState<LogAuditoria[]>([]);
  const [acessos, setAcessos] = useState<LogAcesso[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      if (aba === 'trilha') {
        const r = await apiGet<{ itens: LogAuditoria[] }>('/admin/auditoria?limit=100');
        setTrilha(r.itens);
      } else {
        const r = await apiGet<{ itens: LogAcesso[] }>('/admin/auditoria/acessos?limit=100');
        setAcessos(r.itens);
      }
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, [aba]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const vazio =
    (aba === 'trilha' && trilha.length === 0) || (aba === 'acessos' && acessos.length === 0);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--space-4)' }}>
      <CabecalhoPagina
        titulo="Auditoria"
        subtitulo="Trilha imutável de tudo que acontece no sistema — prova documental (ADM 6)"
      />

      <div
        role="tablist"
        style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}
      >
        {(['trilha', 'acessos'] as Aba[]).map((a) => {
          const sel = aba === a;
          return (
            <button
              key={a}
              role="tab"
              aria-selected={sel}
              onClick={() => setAba(a)}
              style={{
                minHeight: 44,
                padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: sel ? 'var(--color-navy-900)' : 'var(--color-surface)',
                color: sel ? '#fff' : 'var(--color-navy-900)',
                cursor: 'pointer',
                font: '600 13px var(--font-body)',
              }}
            >
              {a === 'trilha' ? 'Ações' : 'Acessos'}
            </button>
          );
        })}
      </div>

      {erro && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}

      <Cartao>
        {carregando ? (
          <EstadoVazio>Carregando…</EstadoVazio>
        ) : vazio ? (
          <EstadoVazio>Nenhum registro no período.</EstadoVazio>
        ) : aba === 'trilha' ? (
          trilha.map((l) => (
            <Linha key={l.id} cor="var(--color-accent)" quando={l.timestamp}>
              <strong style={{ font: '600 13px var(--font-mono)' }}>{l.acao}</strong>{' '}
              <span style={{ color: '#5b6472' }}>
                {l.entidadeAfetada} · {l.usuarioTipo} · {l.ip ?? '-'}
              </span>
            </Linha>
          ))
        ) : (
          acessos.map((l) => (
            <Linha
              key={l.id}
              cor={
                l.evento.includes('FALHA') || l.evento.includes('BLOQUEIO')
                  ? 'var(--color-red-alert)'
                  : 'var(--color-teal-success)'
              }
              quando={l.timestamp}
            >
              <strong style={{ font: '600 13px var(--font-mono)' }}>{l.evento}</strong>{' '}
              <span style={{ color: '#5b6472' }}>
                {l.sujeitoTipo} · {l.identificador ?? '-'} · {l.ip ?? '-'}
              </span>
            </Linha>
          ))
        )}
      </Cartao>
    </div>
  );
}

function Linha({ cor, quando, children }: { cor: string; quando: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        padding: 'var(--space-2) 0',
        borderLeft: `2px solid var(--color-border)`,
        marginLeft: 6,
        paddingLeft: 'var(--space-3)',
        position: 'relative',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: -7,
          top: 14,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: cor,
        }}
      />
      <div style={{ flex: 1, font: '400 13px var(--font-body)' }}>{children}</div>
      <span style={{ font: '11px var(--font-mono)', color: '#5b6472', whiteSpace: 'nowrap' }}>
        {new Date(quando).toLocaleString('pt-BR')}
      </span>
    </div>
  );
}
