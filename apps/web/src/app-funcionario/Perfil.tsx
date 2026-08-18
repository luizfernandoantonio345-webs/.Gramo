import { useCallback, useEffect, useRef, useState } from 'react';
import { Botao, Cartao, Feedback } from '../design-system/components';
import { apiGet, apiPost } from '../lib/api';

interface MeuPerfil {
  nome: string;
  cargo: string | null;
  email: string | null;
  fotoAprovada: boolean;
  fotoBase64?: string;
}

type Etapa = 'perfil' | 'camera' | 'preview';

/**
 * Tela Perfil -- funcionario visualiza seus dados e atualiza a foto de rosto
 * (usada no reconhecimento facial para bater ponto). Captura via camera ou upload.
 */
export function Perfil() {
  const [perfil, setPerfil] = useState<MeuPerfil | null>(null);
  const [etapa, setEtapa] = useState<Etapa>('perfil');
  const [preview, setPreview] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tom: 'sucesso' | 'erro' | 'aviso';
    texto: string;
  } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroCarga, setErroCarga] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const carregar = useCallback(async () => {
    try {
      const p = await apiGet<MeuPerfil>('/funcionario/me');
      setPerfil(p);
      setErroCarga(false);
    } catch {
      setErroCarga(true);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Inicia camera ao entrar na etapa
  useEffect(() => {
    if (etapa !== 'camera') return;
    let ativo = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
      .then((stream) => {
        if (!ativo) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        setFeedback({ tom: 'erro', texto: 'Câmera não disponível. Use o upload de arquivo.' });
        setEtapa('perfil');
      });
    return () => {
      ativo = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [etapa]);

  function capturarFoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    setPreview(canvas.toDataURL('image/jpeg', 0.85));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setEtapa('preview');
  }

  function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ tom: 'erro', texto: 'Arquivo muito grande. Máximo 5 MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target?.result as string);
      setEtapa('preview');
    };
    reader.readAsDataURL(file);
  }

  async function salvarFoto() {
    if (!preview) return;
    setEnviando(true);
    setFeedback(null);
    try {
      await apiPost('/pontos/minha-referencia', { fotoBase64: preview }, true);
      setFeedback({
        tom: 'sucesso',
        texto: 'Foto enviada! O RH irá analisar e aprovar em breve.',
      });
      setEtapa('perfil');
      setPreview(null);
      await carregar();
    } catch (e) {
      setFeedback({ tom: 'erro', texto: e instanceof Error ? e.message : 'Falha ao enviar.' });
    } finally {
      setEnviando(false);
    }
  }

  function cancelar() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setEtapa('perfil');
    setPreview(null);
  }

  if (erroCarga) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <Feedback tom="erro">Não foi possível carregar seus dados. Tente novamente.</Feedback>
      </div>
    );
  }

  if (!perfil) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <Cartao>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Carregando…</p>
        </Cartao>
      </div>
    );
  }

  const iniciais = perfil.nome
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  const fotoAtual = perfil.fotoBase64;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ font: '700 24px var(--font-display)', marginTop: 0 }}>Meu perfil</h1>

      {feedback && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Feedback tom={feedback.tom}>{feedback.texto}</Feedback>
        </div>
      )}

      {/* ── Etapa: perfil ── */}
      {etapa === 'perfil' && (
        <>
          <Cartao>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-4)',
              }}
            >
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {fotoAtual ? (
                  <img
                    src={fotoAtual}
                    alt="Foto de perfil"
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid var(--color-accent)',
                      display: 'block',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: 'var(--color-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      font: '700 28px var(--font-display)',
                      color: '#fff',
                    }}
                  >
                    {iniciais}
                  </div>
                )}
                {/* Badge de status da foto */}
                {fotoAtual && (
                  <span
                    title={
                      perfil.fotoAprovada ? 'Foto aprovada pelo RH' : 'Foto aguardando aprovação'
                    }
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      right: 2,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: perfil.fotoAprovada
                        ? 'var(--color-teal-success)'
                        : 'var(--color-warning)',
                      border: '2px solid var(--color-surface)',
                      display: 'block',
                    }}
                  />
                )}
              </div>

              {/* Info */}
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    font: '700 18px var(--font-display)',
                    color: 'var(--color-text)',
                  }}
                >
                  {perfil.nome}
                </p>
                {perfil.cargo && (
                  <p
                    style={{
                      margin: '2px 0 0',
                      font: '400 14px var(--font-body)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {perfil.cargo}
                  </p>
                )}
                {perfil.email && (
                  <p
                    style={{
                      margin: '2px 0 0',
                      font: '400 12px var(--font-mono)',
                      color: 'var(--color-text-faint)',
                    }}
                  >
                    {perfil.email}
                  </p>
                )}
              </div>
            </div>

            {/* Status da foto de referência */}
            <div
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                marginBottom: 'var(--space-4)',
                font: '400 13px var(--font-body)',
                color: 'var(--color-text-muted)',
              }}
            >
              <strong style={{ color: 'var(--color-text)' }}>Foto de reconhecimento facial</strong>
              <br />
              {!fotoAtual
                ? 'Nenhuma foto cadastrada. Cadastre sua foto para usar o reconhecimento facial ao bater ponto.'
                : perfil.fotoAprovada
                  ? 'Foto aprovada pelo RH — reconhecimento facial ativo.'
                  : 'Foto enviada, aguardando aprovação do RH.'}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <Botao onClick={() => setEtapa('camera')}>
                {fotoAtual ? 'Trocar foto (câmera)' : 'Cadastrar foto (câmera)'}
              </Botao>
              <button
                onClick={() => inputRef.current?.click()}
                className="g-btn g-btn--ghost"
                style={{ minHeight: 44 }}
              >
                {fotoAtual ? 'Trocar foto (galeria)' : 'Cadastrar foto (galeria)'}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={onArquivo}
                style={{ display: 'none' }}
              />
            </div>
          </Cartao>

          <p
            style={{
              marginTop: 'var(--space-3)',
              font: '400 12px var(--font-body)',
              color: 'var(--color-text-faint)',
              lineHeight: 1.5,
            }}
          >
            A foto é usada apenas para verificação de identidade no registro de ponto. Seus dados
            biométricos são protegidos conforme a LGPD.
          </p>
        </>
      )}

      {/* ── Etapa: câmera ── */}
      {etapa === 'camera' && (
        <Cartao>
          <p style={{ margin: '0 0 var(--space-3)', font: '500 14px var(--font-body)' }}>
            Posicione seu rosto no centro e clique em <strong>Tirar foto</strong>.
          </p>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              borderRadius: 'var(--radius-md)',
              background: '#000',
              display: 'block',
              marginBottom: 'var(--space-3)',
            }}
          />
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Botao onClick={capturarFoto}>Tirar foto</Botao>
            <button onClick={cancelar} className="g-btn g-btn--ghost" style={{ minHeight: 44 }}>
              Cancelar
            </button>
          </div>
        </Cartao>
      )}

      {/* ── Etapa: preview ── */}
      {etapa === 'preview' && preview && (
        <Cartao>
          <p style={{ margin: '0 0 var(--space-3)', font: '500 14px var(--font-body)' }}>
            Confirme sua foto antes de enviar:
          </p>
          <img
            src={preview}
            alt="Pré-visualização"
            style={{
              width: '100%',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              display: 'block',
              marginBottom: 'var(--space-4)',
            }}
          />
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Botao onClick={salvarFoto} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Confirmar e enviar'}
            </Botao>
            <button onClick={cancelar} className="g-btn g-btn--ghost" style={{ minHeight: 44 }}>
              Tirar outra
            </button>
          </div>
        </Cartao>
      )}
    </div>
  );
}
