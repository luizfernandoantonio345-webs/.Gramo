import { proximoTipoMarcacao, TipoMarcacao } from '@repp/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Botao, Cartao } from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';
import { contarPendentes, enfileirar } from '../offline/fila-ponto';
import { sincronizarFila } from '../offline/sync';

type StatusAnel = 'dentro' | 'fora' | 'desconhecido';

interface PontoResumo {
  id: string;
  nsr: number;
  tipo: string;
  registradoEm: string;
  statusValidacao: string;
  dentroRegap: boolean;
}

/**
 * Tela 3 -- Bater Ponto. O "Anel de Presenca" mostra o status de REGAP em tempo
 * real (teal dentro / ambar fora). O botao NUNCA bloqueia: sem rede, a marcacao
 * vai para a fila offline (Dexie) e sincroniza depois.
 */
export function BaterPonto() {
  const [coords, setCoords] = useState<{ lat: number; lng: number; prec: number | null } | null>(null);
  const [anel, setAnel] = useState<StatusAnel>('desconhecido');
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [espelho, setEspelho] = useState<PontoResumo[]>([]);
  const [pendentes, setPendentes] = useState<number>(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const carregarEspelho = useCallback(async () => {
    try {
      setEspelho(await apiGet<PontoResumo[]>('/pontos/hoje'));
    } catch {
      /* offline: mantem o que tem */
    }
    setPendentes(await contarPendentes());
  }, []);

  // Geolocalizacao em tempo real.
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude, prec: p.coords.accuracy }),
      () => setAnel('desconhecido'),
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Atualiza o anel consultando a REGAP quando a posicao muda (se online).
  useEffect(() => {
    if (!coords || !online) return;
    let cancelado = false;
    apiGet<{ dentro: boolean }>(`/pontos/regap-status?latitude=${coords.lat}&longitude=${coords.lng}`)
      .then((r) => !cancelado && setAnel(r.dentro ? 'dentro' : 'fora'))
      .catch(() => !cancelado && setAnel('desconhecido'));
    return () => {
      cancelado = true;
    };
  }, [coords, online]);

  // Conectividade: ao voltar a rede, sincroniza a fila.
  useEffect(() => {
    const aoOnline = async () => {
      setOnline(true);
      try {
        await sincronizarFila();
      } catch {
        /* tenta depois */
      }
      await carregarEspelho();
    };
    const aoOffline = () => setOnline(false);
    window.addEventListener('online', aoOnline);
    window.addEventListener('offline', aoOffline);
    void carregarEspelho();
    return () => {
      window.removeEventListener('online', aoOnline);
      window.removeEventListener('offline', aoOffline);
    };
  }, [carregarEspelho]);

  const tipoSugerido = proximoTipoMarcacao(espelho.map((p) => p.tipo as TipoMarcacao));

  async function capturarFoto(): Promise<string | null> {
    const video = videoRef.current;
    if (!video || !streamRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  }

  async function ligarCamera() {
    // Camera exige contexto seguro (HTTPS) -- so localhost e excecao. Em HTTP
    // (ex.: acesso por IP na LAN) navigator.mediaDevices nem existe.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMsg('Camera exige HTTPS. Abra pelo link seguro (https). A marcacao funciona sem foto.');
      return;
    }
    // Desliga um stream anterior antes de abrir outro (evita streams empilhados).
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setMsg('Camera indisponivel -- a marcacao segue normalmente sem foto.');
    }
  }

  // Libera a camera ao sair da tela (senao o dispositivo fica com a camera ligada).
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function baterPonto() {
    setEnviando(true);
    setMsg(null);
    const foto = await capturarFoto();
    const item = {
      uuidIdempotencia: crypto.randomUUID(),
      tipo: tipoSugerido,
      capturadoEm: new Date().toISOString(),
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      precisaoMetros: coords?.prec ?? null,
      fotoBase64: foto,
      justificativa: anel === 'fora' ? 'Registro fora da area (REGAP).' : null,
    };
    try {
      if (!navigator.onLine) throw new Error('offline');
      const r = await apiPost<PontoResumo>(
        '/pontos',
        {
          uuidIdempotencia: item.uuidIdempotencia,
          latitude: item.latitude ?? undefined,
          longitude: item.longitude ?? undefined,
          precisaoMetros: item.precisaoMetros ?? undefined,
          fotoBase64: item.fotoBase64 ?? undefined,
          justificativa: item.justificativa ?? undefined,
        },
        true,
      );
      const hora = new Date(r.registradoEm).toLocaleTimeString('pt-BR');
      setMsg(
        `Registrado as ${hora} (NSR ${r.nsr})` +
          (r.statusValidacao === 'VALIDO' ? '' : ' -- pendente de validacao do RH.'),
      );
    } catch {
      // Sem rede (ou falha): enfileira. O registro NUNCA e perdido nem bloqueado.
      await enfileirar(item);
      setMsg('Sem conexao: marcacao salva no aparelho e sera sincronizada depois.');
    }
    await carregarEspelho();
    setEnviando(false);
  }

  async function contestar(pontoId: string) {
    const motivo = window.prompt('Motivo da contestacao desta marcacao:');
    if (!motivo) return;
    try {
      await apiPost('/contestacoes', { pontoId, motivo }, true);
      setMsg('Contestacao registrada. O RH ira responder.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao contestar.');
    }
  }

  const corAnel =
    anel === 'dentro'
      ? 'var(--color-teal-success)'
      : anel === 'fora'
        ? 'var(--color-amber-warning)'
        : 'var(--color-border)';

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ font: '700 22px var(--font-display)' }}>Bater Ponto</h1>
        <Badge cor={online ? 'var(--color-teal-success)' : 'var(--color-amber-warning)'}>
          {online ? 'online' : 'offline'}
        </Badge>
      </div>

      {/* Anel de Presenca ao redor da captura facial */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: 'var(--space-4) 0' }}>
        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: '50%',
            border: `10px solid ${corAnel}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            background: '#000',
          }}
        >
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
        <Badge cor={corAnel}>
          {anel === 'dentro' ? 'Dentro da area (REGAP)' : anel === 'fora' ? 'Fora da area -- registro permitido' : 'Localizacao indisponivel'}
        </Badge>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <Botao variante="secundario" onClick={ligarCamera}>
          Ligar camera
        </Botao>
        <Botao onClick={baterPonto} disabled={enviando}>
          {enviando ? 'Registrando...' : `Bater ${rotulo(tipoSugerido)}`}
        </Botao>
      </div>

      {msg && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Badge cor="var(--color-accent)">{msg}</Badge>
        </div>
      )}
      {pendentes > 0 && (
        <p style={{ font: '400 13px var(--font-body)', color: 'var(--color-amber-warning)' }}>
          {pendentes} marcacao(oes) aguardando sincronizacao.
        </p>
      )}

      <Cartao>
        <h2 style={{ font: '600 15px var(--font-display)', marginTop: 0 }}>Marcacoes de hoje</h2>
        {espelho.length === 0 && <p style={{ color: '#5b6472' }}>Nenhuma marcacao ainda.</p>}
        {espelho.map((p) => (
          <div
            key={p.id}
            style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}
          >
            <span style={{ font: '500 14px var(--font-body)' }}>{rotulo(p.tipo as TipoMarcacao)}</span>
            <span style={{ font: '13px var(--font-mono)' }}>
              {new Date(p.registradoEm).toLocaleTimeString('pt-BR')}
            </span>
            <Badge cor={p.statusValidacao === 'VALIDO' ? 'var(--color-teal-success)' : 'var(--color-amber-warning)'}>
              {p.statusValidacao === 'VALIDO' ? 'valido' : 'pendente'}
            </Badge>
            <button
              onClick={() => contestar(p.id)}
              style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', font: '400 12px var(--font-body)' }}
            >
              contestar
            </button>
          </div>
        ))}
      </Cartao>
    </div>
  );
}

function rotulo(t: TipoMarcacao | string): string {
  switch (t) {
    case TipoMarcacao.ENTRADA:
      return 'Entrada';
    case TipoMarcacao.INICIO_INTERVALO:
      return 'Inicio intervalo';
    case TipoMarcacao.FIM_INTERVALO:
      return 'Fim intervalo';
    case TipoMarcacao.SAIDA:
      return 'Saida';
    default:
      return String(t);
  }
}
