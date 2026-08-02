import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Badge, Cartao } from '../design-system/components';
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

  const carregar = useCallback(async () => {
    try {
      if (aba === 'trilha') {
        const r = await apiGet<{ itens: LogAuditoria[] }>('/admin/auditoria?limit=100');
        setTrilha(r.itens);
      } else {
        const r = await apiGet<{ itens: LogAcesso[] }>('/admin/auditoria/acessos?limit=100');
        setAcessos(r.itens);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }, [aba]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ font: '700 24px var(--font-display)' }}>Auditoria</h1>
      <p style={{ color: '#5b6472', font: '400 13px var(--font-body)', marginTop: 0 }}>
        Trilha imutavel de tudo que acontece no sistema -- prova documental (ADM 6).
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        {(['trilha', 'acessos'] as Aba[]).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: aba === a ? 'var(--color-navy-900)' : 'var(--color-surface)',
              color: aba === a ? '#fff' : 'var(--color-navy-900)',
              cursor: 'pointer',
              font: '500 13px var(--font-body)',
            }}
          >
            {a === 'trilha' ? 'Acoes' : 'Acessos'}
          </button>
        ))}
      </div>
      {erro && <Badge cor="var(--color-red-alert)">{erro}</Badge>}

      <Cartao>
        {/* Linha do tempo (Trilha de Confianca): marcador + linha vertical. */}
        {aba === 'trilha' &&
          trilha.map((l) => (
            <Linha key={l.id} cor="var(--color-accent)" quando={l.timestamp}>
              <strong style={{ font: '600 13px var(--font-mono)' }}>{l.acao}</strong>{' '}
              <span style={{ color: '#5b6472' }}>
                {l.entidadeAfetada} · {l.usuarioTipo} · {l.ip ?? '-'}
              </span>
            </Linha>
          ))}
        {aba === 'acessos' &&
          acessos.map((l) => (
            <Linha
              key={l.id}
              cor={l.evento.includes('FALHA') || l.evento.includes('BLOQUEIO') ? 'var(--color-red-alert)' : 'var(--color-teal-success)'}
              quando={l.timestamp}
            >
              <strong style={{ font: '600 13px var(--font-mono)' }}>{l.evento}</strong>{' '}
              <span style={{ color: '#5b6472' }}>
                {l.sujeitoTipo} · {l.identificador ?? '-'} · {l.ip ?? '-'}
              </span>
            </Linha>
          ))}
        {((aba === 'trilha' && trilha.length === 0) || (aba === 'acessos' && acessos.length === 0)) && (
          <p style={{ color: '#5b6472' }}>Nenhum registro.</p>
        )}
      </Cartao>
    </div>
  );
}

function Linha({ cor, quando, children }: { cor: string; quando: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderLeft: `2px solid var(--color-border)`, marginLeft: 6, paddingLeft: 'var(--space-3)', position: 'relative' }}>
      <span style={{ position: 'absolute', left: -7, top: 14, width: 10, height: 10, borderRadius: '50%', background: cor }} />
      <div style={{ flex: 1, font: '400 13px var(--font-body)' }}>{children}</div>
      <span style={{ font: '11px var(--font-mono)', color: '#5b6472', whiteSpace: 'nowrap' }}>
        {new Date(quando).toLocaleString('pt-BR')}
      </span>
    </div>
  );
}
