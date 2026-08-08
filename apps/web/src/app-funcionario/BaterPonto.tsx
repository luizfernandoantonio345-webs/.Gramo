import { proximoTipoMarcacao, TipoMarcacao } from '@repp/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Botao, Cartao, EstadoVazio, Feedback } from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';
import { contarPendentes, enfileirar } from '../offline/fila-ponto';
import { sincronizarFila } from '../offline/sync';
import {
  carregarModelosRosto,
  compararRostos,
  descritorFacial,
  imagemDeDataUrl,
} from '../lib/rosto';

type StatusRosto = 'idle' | 'preparando' | 'pronto' | 'indisponivel' | 'confere' | 'naoConfere';

type StatusAnel = 'dentro' | 'fora' | 'desconhecido';
type TomFeedback = 'sucesso' | 'erro' | 'aviso' | 'info';

interface PontoResumo {
  id: string;
  nsr: number;
  tipo: string;
  registradoEm: string;
  statusValidacao: string;
  dentroRegap: boolean;
}

/**
 * Tela 3 -- Bater Ponto (app do funcionario). Prioridade de UX: UMA acao clara,
 * grande, para uso em campo (sol, pouca luz, pressa). O "Anel de Presenca" mostra
 * a REGAP em tempo real (teal dentro / ambar fora). O botao NUNCA bloqueia: sem
 * rede, a marcacao vai para a fila offline (Dexie) e sincroniza depois. Estados
 * tratados: carregando, vazio, erro de carga, offline, sucesso e pendente.
 */
export function BaterPonto() {
  const [coords, setCoords] = useState<{ lat: number; lng: number; prec: number | null } | null>(
    null,
  );
  const [anel, setAnel] = useState<StatusAnel>('desconhecido');
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [espelho, setEspelho] = useState<PontoResumo[]>([]);
  const [pendentes, setPendentes] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ tom: TomFeedback; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState(false);
  const [cameraLigada, setCameraLigada] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Reconhecimento facial 1:1: descritor da foto de referencia (aprovada) + status.
  const refDescritor = useRef<Float32Array | null>(null);
  const [statusRosto, setStatusRosto] = useState<StatusRosto>('idle');
  // LGPD: consentimento de biometria facial (exigido antes de cadastrar o rosto).
  const [pedirConsent, setPedirConsent] = useState(false);

  const carregarEspelho = useCallback(async () => {
    try {
      setEspelho(await apiGet<PontoResumo[]>('/pontos/hoje'));
      setErroCarga(false);
    } catch {
      // offline ou falha: mantem o que tem e sinaliza (nao apaga o espelho local).
      setErroCarga(true);
    } finally {
      setPendentes(await contarPendentes());
      setCarregando(false);
    }
  }, []);

  // Geolocalizacao em tempo real.
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) =>
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude, prec: p.coords.accuracy }),
      () => setAnel('desconhecido'),
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Atualiza o anel consultando a REGAP quando a posicao muda (se online).
  useEffect(() => {
    if (!coords || !online) return;
    let cancelado = false;
    apiGet<{ dentro: boolean }>(
      `/pontos/regap-status?latitude=${coords.lat}&longitude=${coords.lng}`,
    )
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
      setFeedback({
        tom: 'aviso',
        texto: 'A câmera exige HTTPS. Abra pelo link seguro (https). A marcação funciona sem foto.',
      });
      return;
    }
    // Desliga um stream anterior antes de abrir outro (evita streams empilhados).
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraLigada(true);
      void prepararRosto(); // carrega modelos + foto de referencia em background
    } catch {
      setFeedback({
        tom: 'aviso',
        texto: 'Câmera indisponível — a marcação segue normalmente sem foto.',
      });
    }
  }

  // Prepara o reconhecimento facial: baixa a foto de referencia (aprovada) e
  // calcula o descritor uma vez. Roda no dispositivo; se nao houver referencia
  // aprovada, o matching fica indisponivel (a marcacao segue normalmente).
  async function prepararRosto() {
    if (statusRosto === 'preparando' || refDescritor.current) return;
    setStatusRosto('preparando');
    try {
      const ref = await apiGet<{ disponivel: boolean; fotoBase64?: string }>(
        '/pontos/minha-referencia',
      );
      if (!ref.disponivel || !ref.fotoBase64) return setStatusRosto('indisponivel');
      await carregarModelosRosto();
      const img = await imagemDeDataUrl(ref.fotoBase64);
      const d = await descritorFacial(img);
      if (!d) return setStatusRosto('indisponivel');
      refDescritor.current = d;
      setStatusRosto('pronto');
    } catch {
      setStatusRosto('indisponivel');
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
    setFeedback(null);
    const foto = await capturarFoto();

    // Reconhecimento facial 1:1 no dispositivo (se ha referencia aprovada e camera
    // ligada). NUNCA bloqueia: um nao-match apenas marca a batida p/ conferencia do RH.
    let identidadeConfere: boolean | undefined;
    if (refDescritor.current && streamRef.current && videoRef.current) {
      const d = await descritorFacial(videoRef.current);
      identidadeConfere = d ? compararRostos(refDescritor.current, d).confere : false;
      setStatusRosto(identidadeConfere ? 'confere' : 'naoConfere');
    }

    const item = {
      uuidIdempotencia: crypto.randomUUID(),
      tipo: tipoSugerido,
      capturadoEm: new Date().toISOString(),
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      precisaoMetros: coords?.prec ?? null,
      fotoBase64: foto,
      justificativa: anel === 'fora' ? 'Registro fora da area (REGAP).' : null,
      identidadeConfere,
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
          identidadeConfere: item.identidadeConfere,
        },
        true,
      );
      const hora = new Date(r.registradoEm).toLocaleTimeString('pt-BR');
      const ok = r.statusValidacao === 'VALIDO';
      setFeedback({
        tom: ok ? 'sucesso' : 'aviso',
        texto: ok
          ? `${rotulo(tipoSugerido)} registrada às ${hora} (NSR ${r.nsr}).`
          : `${rotulo(tipoSugerido)} registrada às ${hora} (NSR ${r.nsr}) — pendente de validação do RH.`,
      });
    } catch {
      // Sem rede (ou falha): enfileira. O registro NUNCA e perdido nem bloqueado.
      await enfileirar(item);
      setFeedback({
        tom: 'aviso',
        texto: 'Sem conexão: marcação salva no aparelho e será sincronizada automaticamente.',
      });
    }
    await carregarEspelho();
    setEnviando(false);
  }

  // Enrollment: o funcionario cadastra/atualiza a propria selfie de referencia.
  // Fica pendente ate o RH aprovar; so entao o matching facial passa a valer.
  async function cadastrarMeuRosto() {
    // LGPD: sem consentimento vigente, abre o termo antes de capturar a biometria.
    const c = await apiGet<{ concedido: boolean }>('/pontos/consentimento-biometria').catch(() => ({
      concedido: false,
    }));
    if (!c.concedido) {
      setPedirConsent(true);
      return;
    }
    const foto = await capturarFoto();
    if (!foto) {
      setFeedback({ tom: 'aviso', texto: 'Ligue a câmera e enquadre seu rosto para cadastrar.' });
      return;
    }
    try {
      await apiPost('/pontos/minha-referencia', { fotoBase64: foto }, true);
      setFeedback({
        tom: 'sucesso',
        texto: 'Rosto cadastrado! O reconhecimento facial já vale a partir da próxima batida.',
      });
      // Recarrega a referencia recem-cadastrada para valer ja na proxima batida.
      refDescritor.current = null;
      setStatusRosto('idle');
      void prepararRosto();
    } catch (e) {
      setFeedback({
        tom: 'erro',
        texto: e instanceof Error ? e.message : 'Falha ao enviar a foto.',
      });
    }
  }

  async function autorizarBiometria() {
    try {
      await apiPost('/pontos/consentimento-biometria', { concedido: true }, true);
      setPedirConsent(false);
      setFeedback({
        tom: 'info',
        texto: 'Autorização registrada. Toque em "Cadastrar meu rosto" para concluir.',
      });
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao autorizar.' });
    }
  }

  async function contestar(pontoId: string) {
    const motivo = window.prompt('Motivo da contestação desta marcação:');
    if (!motivo) return;
    try {
      await apiPost('/contestacoes', { pontoId, motivo }, true);
      setFeedback({ tom: 'sucesso', texto: 'Contestação registrada. O RH irá responder.' });
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao contestar.' });
    }
  }

  const corAnel =
    anel === 'dentro'
      ? 'var(--color-teal-success)'
      : anel === 'fora'
        ? 'var(--color-amber-warning)'
        : 'var(--color-border)';
  const textoAnel =
    anel === 'dentro'
      ? 'Dentro da área (REGAP)'
      : anel === 'fora'
        ? 'Fora da área — registro permitido'
        : 'Localização indisponível';

  const rostoInfo: { cor: string; texto: string } | null =
    statusRosto === 'preparando'
      ? { cor: 'var(--color-border)', texto: 'Preparando reconhecimento facial…' }
      : statusRosto === 'pronto'
        ? { cor: 'var(--color-accent)', texto: 'Rosto de referência carregado' }
        : statusRosto === 'confere'
          ? { cor: 'var(--color-teal-success)', texto: '✓ Rosto reconhecido' }
          : statusRosto === 'naoConfere'
            ? { cor: 'var(--color-amber-warning)', texto: 'Rosto não confere — irá p/ conferência' }
            : statusRosto === 'indisponivel'
              ? { cor: 'var(--color-border)', texto: 'Sem foto de referência aprovada' }
              : null;

  return (
    <div style={{ maxWidth: 440, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ font: '700 24px var(--font-display)', margin: 0 }}>Bater ponto</h1>
        <Badge cor={online ? 'var(--color-teal-success)' : 'var(--color-amber-warning)'}>
          {online ? 'online' : 'offline'}
        </Badge>
      </header>

      {/* Anel de Presenca ao redor da captura facial */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          margin: 'var(--space-4) 0 var(--space-3)',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 232,
            height: 232,
            borderRadius: '50%',
            border: `10px solid ${corAnel}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            background: '#0b1220',
            transition: 'border-color 0.2s ease',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {!cameraLigada && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                color: '#c7d2e3',
                font: '500 13px var(--font-body)',
                textAlign: 'center',
                padding: '0 var(--space-3)',
              }}
            >
              Câmera desligada
              <br />
              (opcional)
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          textAlign: 'center',
          marginBottom: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          alignItems: 'center',
        }}
        role="status"
        aria-live="polite"
      >
        <Badge cor={corAnel}>{textoAnel}</Badge>
        {cameraLigada && rostoInfo && <Badge cor={rostoInfo.cor}>{rostoInfo.texto}</Badge>}
      </div>

      {/* Acao principal: grande, alvo de toque generoso. Nunca bloqueia. */}
      <Botao grande onClick={baterPonto} disabled={enviando}>
        {enviando ? 'Registrando…' : `Bater ${rotulo(tipoSugerido)}`}
      </Botao>
      <div style={{ marginTop: 'var(--space-2)' }}>
        <Botao variante="secundario" onClick={ligarCamera}>
          {cameraLigada ? 'Trocar câmera' : 'Ligar câmera (opcional)'}
        </Botao>
      </div>
      {cameraLigada && (statusRosto === 'indisponivel' || statusRosto === 'pronto') && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <Botao variante="secundario" onClick={cadastrarMeuRosto}>
            {statusRosto === 'pronto'
              ? 'Atualizar meu rosto'
              : 'Cadastrar meu rosto (reconhecimento facial)'}
          </Botao>
        </div>
      )}

      {pedirConsent && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Cartao>
            <h3
              style={{
                font: '600 var(--text-md) var(--font-display)',
                margin: '0 0 var(--space-3)',
              }}
            >
              Autorização de uso da biometria facial (LGPD)
            </h3>
            <p
              style={{
                font: 'var(--text-sm) var(--font-body)',
                color: 'var(--color-text-secondary)',
                margin: '0 0 var(--space-4)',
                lineHeight: 1.5,
              }}
            >
              Autorizo a GRAMO ENGENHARIA a coletar e tratar minha imagem facial exclusivamente para
              confirmar minha identidade no registro de ponto, conforme a LGPD (Lei 13.709/2018,
              art. 11). A imagem é armazenada de forma cifrada e o reconhecimento é feito no meu
              aparelho. Posso revogar a autorização a qualquer momento junto ao RH.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Botao bloco={false} onClick={autorizarBiometria}>
                Autorizo
              </Botao>
              <Botao variante="secundario" bloco={false} onClick={() => setPedirConsent(false)}>
                Agora não
              </Botao>
            </div>
          </Cartao>
        </div>
      )}

      {/* Feedback da acao (sucesso/erro/aviso), com aria-live no componente. */}
      {feedback && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Feedback tom={feedback.tom}>{feedback.texto}</Feedback>
        </div>
      )}

      {/* Status de sincronizacao offline em destaque (promessa do offline-first). */}
      {pendentes > 0 && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Feedback tom="aviso">
            {pendentes === 1
              ? '1 marcação aguardando sincronização.'
              : `${pendentes} marcações aguardando sincronização.`}{' '}
            {online ? 'Enviando…' : 'Será enviada quando a conexão voltar.'}
          </Feedback>
        </div>
      )}

      <div style={{ marginTop: 'var(--space-4)' }}>
        <Cartao>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 'var(--space-2)',
            }}
          >
            <h2 style={{ font: '600 16px var(--font-display)', margin: 0 }}>Marcações de hoje</h2>
            {erroCarga && !carregando && (
              <span
                style={{ font: '400 12px var(--font-body)', color: 'var(--color-amber-warning)' }}
              >
                não atualizado
              </span>
            )}
          </div>

          {carregando ? (
            <EstadoVazio>Carregando marcações…</EstadoVazio>
          ) : espelho.length === 0 ? (
            <EstadoVazio>Nenhuma marcação hoje. Toque em “Bater entrada” para começar.</EstadoVazio>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {espelho.map((p) => {
                const valido = p.statusValidacao === 'VALIDO';
                return (
                  <li
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-3) 0',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <span style={{ font: '500 14px var(--font-body)', flex: 1 }}>
                      {rotulo(p.tipo as TipoMarcacao)}
                    </span>
                    <span style={{ font: '14px var(--font-mono)' }}>
                      {new Date(p.registradoEm).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <Badge
                      cor={valido ? 'var(--color-teal-success)' : 'var(--color-amber-warning)'}
                    >
                      {valido ? 'válido' : 'pendente'}
                    </Badge>
                    <button
                      onClick={() => contestar(p.id)}
                      aria-label={`Contestar marcação de ${rotulo(p.tipo as TipoMarcacao)}`}
                      style={{
                        minHeight: 44,
                        padding: '0 var(--space-2)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-accent)',
                        cursor: 'pointer',
                        font: '500 13px var(--font-body)',
                      }}
                    >
                      contestar
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>
      </div>
    </div>
  );
}

function rotulo(t: TipoMarcacao | string): string {
  switch (t) {
    case TipoMarcacao.ENTRADA:
      return 'Entrada';
    case TipoMarcacao.INICIO_INTERVALO:
      return 'Início intervalo';
    case TipoMarcacao.FIM_INTERVALO:
      return 'Fim intervalo';
    case TipoMarcacao.SAIDA:
      return 'Saída';
    default:
      return String(t);
  }
}
