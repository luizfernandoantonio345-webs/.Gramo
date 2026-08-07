import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { apiGet, sessaoAtual } from '../lib/api';
import { MarcaRepp } from '../design-system/components';

interface Presente {
  funcionario: string;
  filial: string;
  desde: string;
}
interface Presenca {
  total: number;
  porFilial: { filial: string; total: number }[];
  presentes: Presente[];
}

/**
 * Telão de Presença em Tempo Real (parede do RH/segurança). Acessado por
 * `?modo=presenca` com sessão de admin. Mostra "quem está em cada obra AGORA",
 * atualizando sozinho. Full-screen, alto contraste, legível de longe.
 */
export function TelaoPresenca() {
  const [dados, setDados] = useState<Presenca | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(new Date());
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const temSessao = sessaoAtual() === 'admin';

  const carregar = useCallback(async () => {
    try {
      setDados(await apiGet<Presenca>('/admin/dashboard/presenca'));
      setErro(null);
      setAtualizadoEm(new Date());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao atualizar.');
    }
  }, []);

  // Auto-refresh a cada 15s + relógio de 1s.
  useEffect(() => {
    if (!temSessao) return;
    void carregar();
    const p = setInterval(() => void carregar(), 15000);
    const r = setInterval(() => setAgora(new Date()), 1000);
    return () => {
      clearInterval(p);
      clearInterval(r);
    };
  }, [carregar, temSessao]);

  if (!temSessao) {
    return (
      <Palco>
        <div style={{ textAlign: 'center' }}>
          <MarcaRepp subtitulo="Presença em tempo real" />
          <p
            style={{
              color: 'var(--color-text-muted)',
              font: '500 18px var(--font-body)',
              marginTop: 'var(--space-4)',
            }}
          >
            Entre como <strong>Administrador</strong> primeiro, depois abra este telão.
          </p>
          <a href="/" style={{ color: 'var(--color-accent)', font: '600 16px var(--font-body)' }}>
            Ir para o login →
          </a>
        </div>
      </Palco>
    );
  }

  const obras = dados?.porFilial ?? [];
  const porObra = (filial: string) => (dados?.presentes ?? []).filter((p) => p.filial === filial);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg)',
        padding: 'var(--space-7)',
      }}
    >
      {/* Cabeçalho: marca + total + relógio */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-4)',
        }}
      >
        <MarcaRepp subtitulo="Presença em tempo real" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                font: '800 44px var(--font-display)',
                lineHeight: 1,
                color: 'var(--color-accent)',
              }}
            >
              {dados?.total ?? '—'}
            </div>
            <div
              style={{
                font: '600 12px var(--font-body)',
                color: 'var(--color-text-muted)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              presentes agora
            </div>
          </div>
          <div
            style={{
              font: '700 34px var(--font-mono)',
              color: 'var(--color-navy-900)',
              minWidth: 130,
              textAlign: 'right',
            }}
          >
            {agora.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </div>
        </div>
      </header>

      {erro && (
        <div
          style={{
            color: 'var(--color-amber-warning)',
            font: '500 14px var(--font-body)',
            marginBottom: 'var(--space-3)',
          }}
        >
          Reconectando… ({erro})
        </div>
      )}

      {/* Grade de obras */}
      {obras.length === 0 ? (
        <div
          style={{
            color: 'var(--color-text-muted)',
            font: '500 22px var(--font-body)',
            textAlign: 'center',
            paddingTop: 80,
          }}
        >
          Ninguém registrado como presente no momento.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {obras.map((o) => (
            <section
              key={o.filial}
              style={{
                background: 'var(--color-surface)',
                backgroundImage: 'var(--realce-topo)',
                border: '1px solid var(--color-border)',
                borderTop: '3px solid var(--color-accent)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--sombra-card)',
                padding: 'var(--space-4)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 'var(--space-2)',
                }}
              >
                <h2 style={{ font: '700 20px var(--font-display)', margin: 0 }}>{o.filial}</h2>
                <span
                  style={{
                    font: '800 30px var(--font-display)',
                    color: 'var(--color-teal-success)',
                  }}
                >
                  {o.total}
                </span>
              </div>
              <ul style={{ listStyle: 'none', margin: 'var(--space-3) 0 0', padding: 0 }}>
                {porObra(o.filial).map((p, i) => (
                  <li
                    key={`${p.funcionario}-${i}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-2) 0',
                      borderBottom: '1px solid var(--color-border)',
                      font: '500 16px var(--font-body)',
                    }}
                  >
                    <span>{p.funcionario}</span>
                    <span
                      style={{ color: 'var(--color-text-muted)', font: '14px var(--font-mono)' }}
                    >
                      desde{' '}
                      {new Date(p.desde).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <footer
        style={{
          marginTop: 'var(--space-4)',
          textAlign: 'center',
          font: '400 12px var(--font-mono)',
          color: 'var(--color-text-muted)',
        }}
      >
        atualiza a cada 15s
        {atualizadoEm && ` · última atualização ${atualizadoEm.toLocaleTimeString('pt-BR')}`}
      </footer>
    </div>
  );
}

/** Moldura full-screen centralizada (estados sem dados). */
function Palco({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-neutral-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
    >
      {children}
    </div>
  );
}
