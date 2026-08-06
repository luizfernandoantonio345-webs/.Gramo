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

type Etapa = 'credenciais' | 'setup-2fa' | 'verificar-2fa' | 'cadastro';

/**
 * ADM 1 -- Login e Gestao de Acesso. 2FA obrigatorio: apos e-mail+senha, o
 * admin configura (primeiro acesso) ou informa o codigo do autenticador.
 */
export function AdmLogin({ onAutenticado }: { onAutenticado: (t: ParTokens) => void }) {
  const [etapa, setEtapa] = useState<Etapa>('credenciais');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [desafioToken, setDesafioToken] = useState('');
  const [otpauth, setOtpauth] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const ehDemo = ambienteDemo();

  async function login() {
    setErro(null);
    setCarregando(true);
    try {
      const r = await apiPost<{
        desafioToken?: string;
        setup2fa?: boolean;
        accessToken?: string;
        refreshToken?: string;
        expiresIn?: number;
      }>('/auth/admin/login', { email, senha });
      // Dev: com o bypass de 2FA ligado, o backend ja devolve os tokens.
      if (r.accessToken) {
        onAutenticado(r as ParTokens);
        return;
      }
      setDesafioToken(r.desafioToken ?? '');
      if (r.setup2fa) {
        const s = await apiPost<{ otpauthUrl: string }>('/auth/admin/2fa/setup', {
          desafioToken: r.desafioToken,
        });
        setOtpauth(s.otpauthUrl);
        setEtapa('setup-2fa');
      } else {
        setEtapa('verificar-2fa');
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha no login.');
    } finally {
      setCarregando(false);
    }
  }

  async function verificar() {
    setErro(null);
    setCarregando(true);
    try {
      const t = await apiPost<ParTokens>('/auth/admin/2fa/verify', { desafioToken, codigo });
      onAutenticado(t);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Codigo invalido.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 'var(--space-4)' }}>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <MarcaRepp subtitulo="Administração" />
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
            <Botao onClick={login} disabled={carregando || !email || !senha}>
              {carregando ? 'Aguarde...' : 'Continuar'}
            </Botao>
            {ehDemo && (
              <BotaoDemo
                onClick={() => {
                  setEmail('admin@piloto.local');
                  setSenha('Piloto@12345');
                }}
              />
            )}
            <button
              onClick={() => {
                setErro(null);
                setEtapa('cadastro');
              }}
              style={{
                marginTop: 'var(--space-3)',
                minHeight: 44,
                background: 'none',
                border: 'none',
                color: 'var(--color-accent)',
                cursor: 'pointer',
                font: '500 14px var(--font-body)',
              }}
            >
              Não tem conta? Cadastrar minha empresa
            </button>
          </>
        )}

        {etapa === 'cadastro' && (
          <CadastroEmpresa
            onCadastrada={(sub) => {
              setErro(null);
              setEtapa('credenciais');
              setEmail('');
              setSenha('');
              window.alert(
                `Empresa cadastrada! Subdominio: ${sub}. Faca login como administrador.`,
              );
            }}
            onVoltar={() => {
              setErro(null);
              setEtapa('credenciais');
            }}
          />
        )}

        {etapa === 'setup-2fa' && (
          <>
            <p style={{ font: '400 14px var(--font-body)' }}>
              <strong>Primeiro acesso:</strong> configure o 2FA no seu app autenticador com a chave
              abaixo (otpauth):
            </p>
            <code
              style={{
                display: 'block',
                wordBreak: 'break-all',
                background: 'var(--color-neutral-bg)',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius-sm)',
                font: '12px var(--font-mono)',
                marginBottom: 'var(--space-3)',
              }}
            >
              {otpauth}
            </code>
            <Campo
              label="Codigo do autenticador"
              inputMode="numeric"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
            <Botao onClick={verificar} disabled={carregando || codigo.length !== 6}>
              Ativar e entrar
            </Botao>
          </>
        )}

        {etapa === 'verificar-2fa' && (
          <>
            <p style={{ font: '400 14px var(--font-body)' }}>
              Informe o codigo do seu autenticador.
            </p>
            <Campo
              label="Codigo 2FA"
              inputMode="numeric"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
            <Botao onClick={verificar} disabled={carregando || codigo.length !== 6}>
              Entrar
            </Botao>
          </>
        )}

        {erro && etapa !== 'cadastro' && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Feedback tom="erro">{erro}</Feedback>
          </div>
        )}
      </Cartao>
    </div>
  );
}

function CadastroEmpresa({
  onCadastrada,
  onVoltar,
}: {
  onCadastrada: (subdominio: string) => void;
  onVoltar: () => void;
}) {
  const [f, setF] = useState({
    razaoSocial: '',
    cnpj: '',
    subdominio: '',
    adminNome: '',
    adminEmail: '',
    adminSenha: '',
  });
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });

  async function cadastrar() {
    setErro(null);
    setCarregando(true);
    try {
      const r = await apiPost<{ subdominio: string }>('/publico/onboarding', {
        razaoSocial: f.razaoSocial,
        cnpj: f.cnpj.replace(/\D/g, ''),
        subdominio: f.subdominio.toLowerCase().trim(),
        adminNome: f.adminNome,
        adminEmail: f.adminEmail,
        adminSenha: f.adminSenha,
      });
      onCadastrada(r.subdominio);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao cadastrar.');
    } finally {
      setCarregando(false);
    }
  }

  const ok = f.razaoSocial && f.cnpj && f.subdominio && f.adminNome && f.adminEmail && f.adminSenha;
  return (
    <>
      <p style={{ font: '400 14px var(--font-body)' }}>Cadastre sua empresa (teste gratuito):</p>
      <Campo label="Razao social" value={f.razaoSocial} onChange={set('razaoSocial')} />
      <Campo
        label="CNPJ (somente numeros)"
        inputMode="numeric"
        value={f.cnpj}
        onChange={set('cnpj')}
      />
      <Campo
        label="Subdominio (ex.: minhaempresa)"
        value={f.subdominio}
        onChange={set('subdominio')}
        placeholder="minusculas, sem espaco"
      />
      <Campo label="Seu nome (admin)" value={f.adminNome} onChange={set('adminNome')} />
      <Campo label="Seu e-mail" type="email" value={f.adminEmail} onChange={set('adminEmail')} />
      <Campo
        label="Senha (min 8, letra + numero)"
        type="password"
        value={f.adminSenha}
        onChange={set('adminSenha')}
      />
      {erro && (
        <div style={{ marginBottom: 'var(--space-2)' }}>
          <Feedback tom="erro">{erro}</Feedback>
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
        <Botao onClick={cadastrar} disabled={carregando || !ok}>
          {carregando ? 'Cadastrando…' : 'Cadastrar empresa'}
        </Botao>
        <Botao variante="secundario" onClick={onVoltar}>
          Voltar
        </Botao>
      </div>
    </>
  );
}
