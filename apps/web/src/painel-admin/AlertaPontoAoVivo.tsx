import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '../lib/api';
import { Icone } from '../design-system/icons';

interface AlertaPonto {
  id: string;
  funcionario: string;
  obra: string;
  motivo: string;
  registradoEm: string;
}
interface Resposta {
  atualizadoEm: string;
  alertas: AlertaPonto[];
}

const INTERVALO_MS = 20000;
const CHAVE_MUDO = 'gramo_alerta_ponto_mudo';

/**
 * Vigia ao vivo (painel do RH): faz polling das marcacoes NAO conformes (fora da
 * REGAP ou do horario) e AVISA com som + toast para verificacao imediata. Fica
 * montado globalmente no painel admin, funcionando em qualquer tela. O som
 * respeita o botao de silenciar (preferencia salva). Sem infra nova: mesmo
 * padrao de polling ja usado no dashboard.
 */
export function AlertaPontoAoVivo({ onVer }: { onVer: () => void }) {
  const [alertas, setAlertas] = useState<AlertaPonto[]>([]);
  const [mudo, setMudo] = useState(() => localStorage.getItem(CHAVE_MUDO) === '1');
  const desdeRef = useRef(new Date().toISOString());
  const vistosRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<AudioContext | null>(null);
  const mudoRef = useRef(mudo);
  mudoRef.current = mudo;

  // "Ding" de dois tons via Web Audio (sem depender de arquivo de audio).
  const tocar = useCallback(() => {
    if (mudoRef.current) return;
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioRef.current ??= new Ctx();
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      const base = ctx.currentTime;
      [880, 1175].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t = base + i * 0.18;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        osc.start(t);
        osc.stop(t + 0.18);
      });
    } catch {
      /* audio indisponivel: segue so com o toast */
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    const consultar = async () => {
      try {
        const r = await apiGet<Resposta>(
          `/admin/dashboard/alertas-ponto?desde=${encodeURIComponent(desdeRef.current)}`,
        );
        if (!vivo) return;
        const novos = r.alertas.filter((a) => !vistosRef.current.has(a.id));
        if (novos.length === 0) return;
        novos.forEach((a) => vistosRef.current.add(a.id));
        // Avanca o marcador para a marcacao mais recente ja vista.
        desdeRef.current = r.alertas.reduce(
          (m, a) => (a.registradoEm > m ? a.registradoEm : m),
          desdeRef.current,
        );
        setAlertas((prev) => [...novos, ...prev].slice(0, 6));
        tocar();
      } catch {
        /* silencioso: erro transitorio se resolve no proximo ciclo */
      }
    };
    void consultar();
    const id = setInterval(consultar, INTERVALO_MS);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [tocar]);

  const dispensar = (id: string) => setAlertas((prev) => prev.filter((a) => a.id !== id));
  const alternarMudo = () =>
    setMudo((m) => {
      const novo = !m;
      localStorage.setItem(CHAVE_MUDO, novo ? '1' : '0');
      return novo;
    });

  const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      {/* Botao de silenciar — renderizado inline na topbar (via acoes em App.tsx). */}
      <button
        onClick={alternarMudo}
        aria-label={mudo ? 'Ativar som dos alertas' : 'Silenciar alertas'}
        title={mudo ? 'Ativar som dos alertas' : 'Silenciar alertas'}
        className="g-btn g-btn--sm g-btn--ghost"
      >
        <Icone nome={mudo ? 'sino-off' : 'sino'} tamanho={16} />
      </button>

      {/* Toasts de alerta — flutuam abaixo da topbar, sem sobrepor. */}
      {alertas.length > 0 && (
        <div
          aria-live="assertive"
          style={{
            position: 'fixed',
            top: 'calc(var(--topbar-h) + var(--space-2))',
            right: 'var(--space-4)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            width: 'min(360px, calc(100vw - 32px))',
            pointerEvents: 'none',
          }}
        >
          {alertas.map((a) => (
            <div
              key={a.id}
              role="alert"
              style={{
                pointerEvents: 'auto',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-danger)',
                borderLeft: '5px solid var(--color-danger)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                padding: 'var(--space-4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span
                  style={{
                    font: '700 var(--text-xs) var(--font-body)',
                    color: 'var(--color-danger)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Ponto para verificar
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    font: 'var(--text-xs) var(--font-mono)',
                    color: 'var(--color-text-faint)',
                  }}
                >
                  {hora(a.registradoEm)}
                </span>
                <button
                  onClick={() => dispensar(a.id)}
                  aria-label="Dispensar"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-faint)',
                    padding: 0,
                  }}
                >
                  <Icone nome="fechar" tamanho={15} />
                </button>
              </div>
              <div
                style={{
                  font: '600 var(--text-base) var(--font-body)',
                  marginTop: 'var(--space-2)',
                }}
              >
                {a.motivo}
              </div>
              <div
                style={{
                  font: 'var(--text-sm) var(--font-body)',
                  color: 'var(--color-text-muted)',
                  marginTop: '2px',
                }}
              >
                {a.funcionario} · {a.obra}
              </div>
              <button
                onClick={() => {
                  onVer();
                  dispensar(a.id);
                }}
                className="g-btn g-btn--sm g-btn--primary"
                style={{ marginTop: 'var(--space-3)' }}
              >
                Verificar na gestão de ponto
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
