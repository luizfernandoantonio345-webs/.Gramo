import { useState } from 'react';
import {
  ambienteDemo,
  Botao,
  BotaoDemo,
  Campo,
  Cartao,
  Feedback,
  MarcaRepp,
} from '../design-system/components';
import { apiPost, type ParTokens } from '../lib/api';

type Etapa = 'credenciais' | 'setup-2fa' | 'verificar-2fa';

/** ADM 0 -- login do Super Admin (plataforma). Visual distinto. */
export function SuperLogin({ onAutenticado }: { onAutenticado: (t: ParTokens) => void }) {
  const [etapa, setEtapa] = useState<Etapa>('credenciais');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [desafioToken, setDesafioToken] = useState('');
  const [otpauth, setOtpauth] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function login() {
    setErro(null);
    try {
      const r = await apiPost<{
        desafioToken?: string;
        setup2fa?: boolean;
        accessToken?: string;
        refreshToken?: string;
        expiresIn?: number;
      }>('/super/auth/login', { email, senha });
      if (r.accessToken) {
        onAutenticado(r as ParTokens);
        return;
      }
      setDesafioToken(r.desafioToken ?? '');
      if (r.setup2fa) {
        const s = await apiPost<{ otpauthUrl: string }>('/super/auth/2fa/setup', {
          desafioToken: r.desafioToken,
        });
        setOtpauth(s.otpauthUrl);
        setEtapa('setup-2fa');
      } else {
        setEtapa('verificar-2fa');
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha no login.');
    }
  }

  async function verificar() {
    setErro(null);
    try {
      onAutenticado(await apiPost<ParTokens>('/super/auth/2fa/verify', { desafioToken, codigo }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Codigo invalido.');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-navy-deep)', paddingTop: 60 }}>
      <div style={{ maxWidth: 420, margin: '0 auto', padding: 'var(--space-4)' }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <MarcaRepp subtitulo="Plataforma · Super Admin" />
        </div>
        <Cartao>
          {etapa === 'credenciais' && (
            <>
              <Campo
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Campo
                label="Senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <Botao onClick={login} disabled={!email || !senha}>
                Continuar
              </Botao>
              {ambienteDemo() && (
                <BotaoDemo
                  onClick={() => {
                    setEmail('super@piloto.local');
                    setSenha('Super@12345');
                  }}
                />
              )}
            </>
          )}
          {etapa === 'setup-2fa' && (
            <>
              <p style={{ font: '400 13px var(--font-body)' }}>Configure o 2FA (otpauth):</p>
              <code
                style={{
                  display: 'block',
                  wordBreak: 'break-all',
                  background: 'var(--color-neutral-bg)',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-sm)',
                  font: '11px var(--font-mono)',
                  marginBottom: 'var(--space-3)',
                }}
              >
                {otpauth}
              </code>
              <Campo
                label="Codigo"
                inputMode="numeric"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              <Botao onClick={verificar} disabled={codigo.length !== 6}>
                Ativar e entrar
              </Botao>
            </>
          )}
          {etapa === 'verificar-2fa' && (
            <>
              <Campo
                label="Codigo 2FA"
                inputMode="numeric"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              <Botao onClick={verificar} disabled={codigo.length !== 6}>
                Entrar
              </Botao>
            </>
          )}
          {erro && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Feedback tom="erro">{erro}</Feedback>
            </div>
          )}
        </Cartao>
      </div>
    </div>
  );
}
