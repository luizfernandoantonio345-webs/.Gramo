import { formatarCpf, isCpfValido, normalizarCpf, validarSenha } from '@repp/shared';
import { useEffect, useRef, useState } from 'react';
import {
  ambienteDemo,
  Botao,
  BotaoDemo,
  Campo,
  Cartao,
  Feedback,
  MarcaRepp,
} from '../design-system/components';
import { apiGet, apiPost, type ParTokens } from '../lib/api';
import {
  atualizarRefreshBiometria,
  autenticarBiometria,
  biometriaAtiva,
  desativarBiometria,
  registrarBiometria,
  suportaBiometria,
} from '../lib/biometria';

type Modo = 'login' | 'primeiro-acesso' | 'recuperar' | 'redefinir' | 'prompt-bio';

interface AvatarInfo {
  nome?: string;
  fotoBase64?: string;
}

/**
 * Tela 1 -- Login / Cadastrar / Recuperar senha (funcionario).
 * Modelo banco: CPF+senha como credencial base; Face ID / digital como opcao de
 * acesso rapido — o funcionario escolhe ativar, igual ao app do banco.
 */
export function TelaLogin({ onAutenticado }: { onAutenticado: (t: ParTokens) => void }) {
  const tokenUrl = new URLSearchParams(window.location.search).get('token') ?? '';

  const [modo, setModo] = useState<Modo>(tokenUrl ? 'redefinir' : 'login');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [tokenRedefinir, setTokenRedefinir] = useState(tokenUrl);
  const [codigo, setCodigo] = useState('');
  const [aceite, setAceite] = useState(false);
  const [tokensPendentes, setTokensPendentes] = useState<ParTokens | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [avatar, setAvatar] = useState<AvatarInfo | null>(null);
  const [bioDisponivel, setBioDisponivel] = useState(false);
  const [bioAtiva, setBioAtiva] = useState(biometriaAtiva);
  const timerAvatar = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cpfValido = isCpfValido(cpf);
  const senhaCheck = validarSenha(senha);
  const novaSenhaCheck = validarSenha(novaSenha);

  // Limpa o ?token= da URL sem recarregar.
  const tokenLimpoRef = useRef(false);
  if (!tokenLimpoRef.current && tokenUrl) {
    tokenLimpoRef.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    window.history.replaceState({}, '', url.toString());
  }

  useEffect(() => {
    void suportaBiometria().then(setBioDisponivel);
  }, []);

  // Avatar com debounce ao completar CPF valido no login.
  useEffect(() => {
    if (timerAvatar.current) clearTimeout(timerAvatar.current);
    if (cpf.length === 11 && cpfValido && modo === 'login') {
      timerAvatar.current = setTimeout(() => {
        apiGet<AvatarInfo>(`/auth/funcionario/avatar?cpf=${normalizarCpf(cpf)}`)
          .then((r) => setAvatar(r.nome ? r : null))
          .catch(() => setAvatar(null));
      }, 300);
    } else {
      setAvatar(null);
    }
    return () => {
      if (timerAvatar.current) clearTimeout(timerAvatar.current);
    };
  }, [cpf, cpfValido, modo]);

  function trocarModo(m: Modo) {
    setModo(m);
    setErro(null);
    setSucesso(null);
    setAvatar(null);
  }

  // ── Login / Primeiro acesso ───────────────────────────────────────
  async function enviar() {
    setErro(null);
    if (!cpfValido) return setErro('CPF inválido.');
    if (modo === 'primeiro-acesso') {
      if (!senhaCheck.valido) return setErro(senhaCheck.erros.join(' '));
      if (!aceite) return setErro('É preciso aceitar o termo de consentimento LGPD.');
    }
    setCarregando(true);
    try {
      if (modo === 'login') {
        const r = await apiPost<
          ParTokens | { requiresPasswordChange: true; trocaSenhaToken: string }
        >('/auth/funcionario/login', { cpf: normalizarCpf(cpf), senha });

        if ('requiresPasswordChange' in r) {
          // Bloqueio de segurança ativado pelo RH — nao expor fluxo de troca aqui.
          setErro('Seu acesso foi bloqueado por segurança. Contate o RH.');
          return;
        }
        // Biometria disponivel e ainda nao ativa: propoe ativar (modelo banco).
        if (bioDisponivel && !biometriaAtiva()) {
          setTokensPendentes(r);
          trocarModo('prompt-bio');
          return;
        }
        if (bioAtiva) atualizarRefreshBiometria(r.refreshToken);
        onAutenticado(r);
      } else {
        const t = await apiPost<ParTokens>('/auth/funcionario/primeiro-acesso', {
          codigo: codigo.toUpperCase(),
          cpf: normalizarCpf(cpf),
          senha,
          aceiteTermos: aceite,
        });
        // Apos primeiro acesso, mesma oferta de biometria.
        if (bioDisponivel && !biometriaAtiva()) {
          setTokensPendentes(t);
          trocarModo('prompt-bio');
          return;
        }
        onAutenticado(t);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao autenticar.');
    } finally {
      setCarregando(false);
    }
  }

  // ── Biometria ────────────────────────────────────────────────────
  async function loginBiometria() {
    setErro(null);
    setCarregando(true);
    try {
      const refreshToken = await autenticarBiometria();
      if (!refreshToken) {
        setErro('Biometria não confirmada. Use CPF e senha.');
        return;
      }
      const t = await apiPost<ParTokens>('/auth/funcionario/refresh', { refreshToken });
      atualizarRefreshBiometria(t.refreshToken);
      onAutenticado(t);
    } catch {
      desativarBiometria();
      setBioAtiva(false);
      setErro('Sessão expirada. Faça login com CPF e senha.');
    } finally {
      setCarregando(false);
    }
  }

  async function habilitarBiometria() {
    if (!tokensPendentes) return;
    setCarregando(true);
    try {
      const ok = await registrarBiometria(normalizarCpf(cpf), tokensPendentes.refreshToken);
      if (ok) setBioAtiva(true);
    } finally {
      setCarregando(false);
      onAutenticado(tokensPendentes);
    }
  }

  function recusarBiometria() {
    if (tokensPendentes) onAutenticado(tokensPendentes);
  }

  // ── Recuperar senha ──────────────────────────────────────────────
  async function recuperar() {
    setErro(null);
    if (!cpfValido) return setErro('CPF inválido.');
    setCarregando(true);
    try {
      await apiPost('/auth/funcionario/recuperar-senha', { cpf: normalizarCpf(cpf) });
      setSucesso(
        'Se o CPF estiver cadastrado, enviaremos um link de redefinição para o e-mail do cadastro. Verifique a caixa de entrada.',
      );
    } catch {
      setSucesso(
        'Se o CPF estiver cadastrado, enviaremos um link de redefinição para o e-mail do cadastro. Verifique a caixa de entrada.',
      );
    } finally {
      setCarregando(false);
    }
  }

  // ── Redefinir senha ──────────────────────────────────────────────
  async function redefinir() {
    setErro(null);
    if (!tokenRedefinir) return setErro('Informe o código recebido por e-mail.');
    if (!novaSenhaCheck.valido) return setErro(novaSenhaCheck.erros.join(' '));
    if (novaSenha !== confirmarSenha) return setErro('As senhas não conferem.');
    setCarregando(true);
    try {
      await apiPost('/auth/funcionario/redefinir-senha', {
        token: tokenRedefinir.trim(),
        novaSenha,
      });
      setSucesso('Senha redefinida com sucesso! Faça login com a nova senha.');
      setTimeout(() => trocarModo('login'), 2500);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Código inválido ou expirado.');
    } finally {
      setCarregando(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <MarcaRepp subtitulo="Ponto Eletrônico" />
      </div>

      {/* Avatar de boas-vindas */}
      {avatar && modo === 'login' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-surface-2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          {avatar.fotoBase64 ? (
            <img
              src={avatar.fotoBase64}
              alt={`Foto de ${avatar.nome}`}
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--color-accent)',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: '700 22px var(--font-display)',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {avatar.nome?.[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p
              style={{
                margin: 0,
                font: '600 15px var(--font-display)',
                color: 'var(--color-text)',
              }}
            >
              Olá, {avatar.nome}!
            </p>
            <p
              style={{
                margin: 0,
                font: '400 12px var(--font-body)',
                color: 'var(--color-text-muted)',
              }}
            >
              Digite sua senha para entrar.
            </p>
          </div>
        </div>
      )}

      {!avatar && modo !== 'recuperar' && modo !== 'redefinir' && modo !== 'prompt-bio' && (
        <p
          style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 'var(--space-3)' }}
        >
          {modo === 'login' ? 'Acesse sua conta' : 'Primeiro acesso com código do RH'}
        </p>
      )}

      {/* ── BIOMETRIA: botão de acesso rápido (quando registrada) ── */}
      {bioAtiva && modo === 'login' && (
        <Cartao>
          <button
            type="button"
            onClick={() => void loginBiometria()}
            disabled={carregando}
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-4)',
              background: 'none',
              border: 'none',
              cursor: carregando ? 'wait' : 'pointer',
              color: 'var(--color-text)',
            }}
          >
            <svg
              width="52"
              height="52"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 10c-1.1 0-2 .9-2 2v4" />
              <path d="M12 6a6 6 0 0 1 6 6v2" />
              <path d="M6.3 8.7A6 6 0 0 0 6 12v2" />
              <path d="M12 2a10 10 0 0 1 10 10v1" />
              <path d="M2.1 11A10 10 0 0 1 12 2" />
            </svg>
            <span style={{ font: '600 15px var(--font-display)' }}>
              {carregando ? 'Verificando…' : 'Entrar com biometria'}
            </span>
            <span style={{ font: '400 12px var(--font-body)', color: 'var(--color-text-muted)' }}>
              Face ID · Touch ID · digital
            </span>
          </button>
          <hr
            style={{
              border: 'none',
              borderTop: '1px solid var(--color-border)',
              margin: '0 0 var(--space-3)',
            }}
          />
          <button
            type="button"
            onClick={() => setBioAtiva(false)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              font: '400 13px var(--font-body)',
              cursor: 'pointer',
              padding: 'var(--space-1) 0',
            }}
          >
            Usar CPF e senha
          </button>
          {erro && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Feedback tom="erro">{erro}</Feedback>
            </div>
          )}
        </Cartao>
      )}

      {/* ── PROMPT: ativar biometria após login (modelo banco) ── */}
      {modo === 'prompt-bio' && (
        <Cartao>
          <div style={{ textAlign: 'center', padding: 'var(--space-2) 0 var(--space-3)' }}>
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: 'block', margin: '0 auto var(--space-3)' }}
              aria-hidden="true"
            >
              <path d="M12 10c-1.1 0-2 .9-2 2v4" />
              <path d="M12 6a6 6 0 0 1 6 6v2" />
              <path d="M6.3 8.7A6 6 0 0 0 6 12v2" />
              <path d="M12 2a10 10 0 0 1 10 10v1" />
              <path d="M2.1 11A10 10 0 0 1 12 2" />
            </svg>
            <p style={{ margin: 0, font: '600 16px var(--font-display)' }}>
              Ativar acesso por biometria?
            </p>
            <p
              style={{
                margin: 'var(--space-2) 0 0',
                font: '400 13px var(--font-body)',
                color: 'var(--color-text-muted)',
              }}
            >
              Na próxima vez, entre com Face ID, Touch ID ou digital — sem digitar senha.
            </p>
          </div>
          <Botao onClick={() => void habilitarBiometria()} disabled={carregando}>
            {carregando ? 'Configurando…' : 'Ativar biometria'}
          </Botao>
          <button
            type="button"
            onClick={recusarBiometria}
            style={{
              marginTop: 'var(--space-2)',
              display: 'block',
              width: '100%',
              textAlign: 'center',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              font: '400 13px var(--font-body)',
              cursor: 'pointer',
              padding: 'var(--space-2) 0',
              minHeight: 44,
            }}
          >
            Agora não
          </button>
        </Cartao>
      )}

      {/* ── LOGIN / PRIMEIRO ACESSO ── */}
      {(modo === 'login' || modo === 'primeiro-acesso') && !bioAtiva && (
        <Cartao>
          <form
            name={modo === 'login' ? 'login' : 'cadastro'}
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
            autoComplete="on"
          >
            {modo === 'primeiro-acesso' && (
              <Campo
                label="Código de convite"
                name="invitation-code"
                autoComplete="one-time-code"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="8 caracteres"
                maxLength={8}
              />
            )}
            <Campo
              label="CPF"
              name="username"
              autoComplete="username"
              inputMode="numeric"
              value={cpf.length ? formatarCpf(cpf) : ''}
              onChange={(e) => setCpf(normalizarCpf(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && void enviar()}
              erro={cpf.length >= 11 && !cpfValido ? 'Dígito verificador inválido' : undefined}
              placeholder="000.000.000-00"
            />
            <Campo
              label="Senha"
              name="password"
              type="password"
              autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void enviar()}
              erro={
                modo === 'primeiro-acesso' && senha.length > 0 && !senhaCheck.valido
                  ? senhaCheck.erros[0]
                  : undefined
              }
              placeholder="mínimo 8 caracteres, letra + número"
            />

            {modo === 'primeiro-acesso' && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  minHeight: 44,
                  marginBottom: 'var(--space-3)',
                  font: '400 13px var(--font-body)',
                }}
              >
                <input
                  type="checkbox"
                  checked={aceite}
                  onChange={(e) => setAceite(e.target.checked)}
                  style={{ width: 20, height: 20, flex: '0 0 auto' }}
                />
                <span>
                  Aceito o termo de uso e o <strong>consentimento LGPD</strong> para biometria
                  facial.
                </span>
              </label>
            )}

            {erro && (
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <Feedback tom="erro">{erro}</Feedback>
              </div>
            )}

            <Botao onClick={enviar} disabled={carregando}>
              {carregando ? 'Aguarde…' : modo === 'login' ? 'Entrar' : 'Cadastrar'}
            </Botao>

            {modo === 'login' && ambienteDemo() && (
              <BotaoDemo
                onClick={() => {
                  setCpf('52998224725');
                  setSenha('Gramo@12345');
                }}
              />
            )}
          </form>

          {/* Esqueceu a senha */}
          {modo === 'login' && (
            <button
              type="button"
              onClick={() => trocarModo('recuperar')}
              style={{
                marginTop: 'var(--space-3)',
                display: 'block',
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                font: '400 13px var(--font-body)',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Esqueceu a senha?
            </button>
          )}
        </Cartao>
      )}

      {/* ── RECUPERAR SENHA ── */}
      {modo === 'recuperar' && (
        <Cartao>
          <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Recuperar senha</h2>
          <p
            style={{
              font: '400 13px var(--font-body)',
              color: 'var(--color-text-muted)',
              marginTop: 0,
            }}
          >
            Informe seu CPF. Enviaremos um link de redefinição para o e-mail cadastrado pelo RH.
          </p>

          {sucesso ? (
            <Feedback tom="sucesso">{sucesso}</Feedback>
          ) : (
            <form
              name="recuperar-senha"
              onSubmit={(e) => {
                e.preventDefault();
                void recuperar();
              }}
            >
              <Campo
                label="CPF"
                name="username"
                autoComplete="username"
                inputMode="numeric"
                value={cpf.length ? formatarCpf(cpf) : ''}
                onChange={(e) => setCpf(normalizarCpf(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && void recuperar()}
                erro={cpf.length >= 11 && !cpfValido ? 'Dígito verificador inválido' : undefined}
                placeholder="000.000.000-00"
              />
              {erro && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <Feedback tom="erro">{erro}</Feedback>
                </div>
              )}
              <Botao onClick={recuperar} disabled={carregando || !cpfValido}>
                {carregando ? 'Enviando…' : 'Enviar link de recuperação'}
              </Botao>
            </form>
          )}

          {sucesso && (
            <button
              type="button"
              onClick={() => {
                setSucesso(null);
                trocarModo('redefinir');
              }}
              style={{
                marginTop: 'var(--space-3)',
                display: 'block',
                background: 'none',
                border: 'none',
                color: 'var(--color-accent)',
                font: '400 13px var(--font-body)',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Já tenho o código — digitar manualmente
            </button>
          )}
        </Cartao>
      )}

      {/* ── REDEFINIR SENHA ── */}
      {modo === 'redefinir' && (
        <Cartao>
          <h2 style={{ font: '600 16px var(--font-display)', marginTop: 0 }}>Nova senha</h2>
          <p
            style={{
              font: '400 13px var(--font-body)',
              color: 'var(--color-text-muted)',
              marginTop: 0,
            }}
          >
            Cole o código recebido por e-mail e escolha uma nova senha.
          </p>

          {sucesso ? (
            <Feedback tom="sucesso">{sucesso}</Feedback>
          ) : (
            <form
              name="redefinir-senha"
              onSubmit={(e) => {
                e.preventDefault();
                void redefinir();
              }}
            >
              <Campo
                label="Código de recuperação"
                name="recovery-token"
                autoComplete="one-time-code"
                value={tokenRedefinir}
                onChange={(e) => setTokenRedefinir(e.target.value)}
                placeholder="Cole o código do e-mail"
              />
              <Campo
                label="Nova senha"
                name="new-password"
                type="password"
                autoComplete="new-password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void redefinir()}
                erro={
                  novaSenha.length > 0 && !novaSenhaCheck.valido
                    ? novaSenhaCheck.erros[0]
                    : undefined
                }
                placeholder="mínimo 8 caracteres, letra + número"
              />
              <Campo
                label="Confirmar nova senha"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void redefinir()}
                erro={
                  confirmarSenha.length > 0 && novaSenha !== confirmarSenha
                    ? 'Senhas não conferem'
                    : undefined
                }
                placeholder="repita a nova senha"
              />
              {erro && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <Feedback tom="erro">{erro}</Feedback>
                </div>
              )}
              <Botao onClick={redefinir} disabled={carregando}>
                {carregando ? 'Salvando…' : 'Salvar nova senha'}
              </Botao>
            </form>
          )}
        </Cartao>
      )}

      {/* ── Links de navegação entre modos ── */}
      <div
        style={{
          marginTop: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-1)',
        }}
      >
        {(modo === 'login' || modo === 'primeiro-acesso') && !bioAtiva && (
          <button
            type="button"
            onClick={() => trocarModo(modo === 'login' ? 'primeiro-acesso' : 'login')}
            style={{
              minHeight: 44,
              background: 'none',
              border: 'none',
              color: 'var(--color-accent)',
              cursor: 'pointer',
              font: '500 14px var(--font-body)',
            }}
          >
            {modo === 'login'
              ? 'Primeiro acesso? Cadastre-se com o código do RH'
              : 'Já tenho conta — fazer login'}
          </button>
        )}
        {(modo === 'recuperar' || modo === 'redefinir') && (
          <button
            type="button"
            onClick={() => trocarModo('login')}
            style={{
              minHeight: 44,
              background: 'none',
              border: 'none',
              color: 'var(--color-accent)',
              cursor: 'pointer',
              font: '500 14px var(--font-body)',
            }}
          >
            ← Voltar para o login
          </button>
        )}
      </div>
    </div>
  );
}
