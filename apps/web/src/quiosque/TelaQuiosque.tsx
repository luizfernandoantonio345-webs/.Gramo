import { formatarCpf, isCpfValido, normalizarCpf } from '@repp/shared';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Botao, Campo, Feedback } from '../design-system/components';
import { definirTokenKiosk, kioskPost, limparTokenKiosk, tokenKioskAtual } from '../lib/api';

interface ResultadoKiosk {
  funcionario: string;
  nsr: number;
  tipo: string;
  registradoEm: string;
  statusValidacao: string;
}

const ROTULO: Record<string, string> = {
  ENTRADA: 'Entrada',
  INICIO_INTERVALO: 'Início do intervalo',
  FIM_INTERVALO: 'Fim do intervalo',
  SAIDA: 'Saída',
};

/**
 * Modo Quiosque (tablet fixo na portaria). Acessado por `?modo=quiosque`. Nao ha
 * login de funcionario: o dispositivo autentica por token (guardado no aparelho);
 * cada pessoa se identifica pelo CPF. Registra pela mesma regra do app (nunca
 * bloqueia). Layout full-screen, alto contraste, auto-reset para o proximo.
 */
export function TelaQuiosque() {
  const [token, setToken] = useState<string | null>(tokenKioskAtual());

  if (!token) {
    return <ConfigurarDispositivo onConfigurado={() => setToken(tokenKioskAtual())} />;
  }
  return <Registrar onTrocarDispositivo={() => setToken(null)} />;
}

/** Primeira vez no tablet: cola o token do dispositivo gerado pelo RH. */
function ConfigurarDispositivo({ onConfigurado }: { onConfigurado: () => void }) {
  const [valor, setValor] = useState('');
  return (
    <Palco>
      <div style={{ maxWidth: 520, width: '100%' }}>
        <h1 style={{ font: '700 28px var(--font-display)', color: '#fff', marginTop: 0 }}>
          Configurar quiosque
        </h1>
        <p style={{ color: '#c7d2e3', font: '400 15px var(--font-body)' }}>
          Cole o <strong>token do dispositivo</strong> gerado pelo RH (Painel → Quiosque). Fica
          guardado só neste aparelho.
        </p>
        <Campo
          label="Token do dispositivo"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="kiosk_…"
        />
        <Botao
          grande
          disabled={valor.trim().length < 8}
          onClick={() => {
            definirTokenKiosk(valor);
            onConfigurado();
          }}
        >
          Ativar quiosque
        </Botao>
      </div>
    </Palco>
  );
}

function Registrar({ onTrocarDispositivo }: { onTrocarDispositivo: () => void }) {
  const [cpf, setCpf] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<ResultadoKiosk | null>(null);
  const coordsRef = useRef<{ lat: number; lng: number; prec: number | null } | null>(null);

  // Geolocalizacao best-effort (se o tablet permitir) -- mesma semantica do app.
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) =>
        (coordsRef.current = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          prec: p.coords.accuracy,
        }),
      () => (coordsRef.current = null),
      { enableHighAccuracy: true, maximumAge: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Apos um sucesso, volta ao teclado de CPF em 5s (para o proximo da fila).
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => {
      setOk(null);
      setCpf('');
    }, 5000);
    return () => clearTimeout(t);
  }, [ok]);

  const cpfValido = isCpfValido(cpf);

  async function registrar() {
    setErro(null);
    setEnviando(true);
    try {
      const r = await kioskPost<ResultadoKiosk>('/kiosk/ponto', {
        cpf: normalizarCpf(cpf),
        uuidIdempotencia: crypto.randomUUID(),
        latitude: coordsRef.current?.lat,
        longitude: coordsRef.current?.lng,
        precisaoMetros: coordsRef.current?.prec ?? undefined,
      });
      setOk(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao registrar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  if (ok) {
    const valido = ok.statusValidacao === 'VALIDO';
    return (
      <Palco>
        <div style={{ textAlign: 'center' }}>
          <div
            aria-hidden
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              margin: '0 auto var(--space-4)',
              background: valido ? 'var(--color-teal-success)' : 'var(--color-amber-warning)',
              color: 'var(--color-navy-deep)',
              font: '700 52px var(--font-display)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✓
          </div>
          <div style={{ font: '700 34px var(--font-display)', color: '#fff' }}>
            {ok.funcionario}
          </div>
          <div style={{ font: '600 22px var(--font-body)', color: '#c7d2e3', marginTop: 8 }}>
            {ROTULO[ok.tipo] ?? ok.tipo} registrada às{' '}
            {new Date(ok.registradoEm).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
          <div style={{ font: '400 15px var(--font-mono)', color: '#8fb0ef', marginTop: 8 }}>
            NSR {ok.nsr}
            {valido ? '' : ' · pendente de validação do RH'}
          </div>
        </div>
      </Palco>
    );
  }

  return (
    <Palco>
      <div style={{ maxWidth: 460, width: '100%', textAlign: 'center' }}>
        <h1 style={{ font: '700 30px var(--font-display)', color: '#fff', marginTop: 0 }}>
          Registrar ponto
        </h1>
        <p style={{ color: '#c7d2e3', font: '400 16px var(--font-body)', marginTop: 0 }}>
          Digite seu CPF
        </p>

        <div style={{ textAlign: 'left' }}>
          <Campo
            label="CPF"
            inputMode="numeric"
            autoFocus
            value={cpf.length ? formatarCpf(cpf) : ''}
            onChange={(e) => setCpf(normalizarCpf(e.target.value))}
            placeholder="000.000.000-00"
            erro={cpf.length >= 11 && !cpfValido ? 'Dígito verificador inválido' : undefined}
          />
        </div>

        {erro && (
          <div style={{ margin: 'var(--space-3) 0', textAlign: 'left' }}>
            <Feedback tom="erro">{erro}</Feedback>
          </div>
        )}

        <Botao grande disabled={!cpfValido || enviando} onClick={registrar}>
          {enviando ? 'Registrando…' : 'Registrar ponto'}
        </Botao>

        <button
          onClick={() => {
            if (window.confirm('Desativar o quiosque neste aparelho?')) {
              limparTokenKiosk();
              onTrocarDispositivo();
            }
          }}
          style={{
            marginTop: 'var(--space-4)',
            minHeight: 44,
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            font: '400 12px var(--font-body)',
          }}
        >
          configurar dispositivo
        </button>
      </div>
    </Palco>
  );
}

/** Moldura full-screen do quiosque (fundo institucional, centralizado). */
function Palco({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-navy-deep)',
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
