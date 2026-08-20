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

type Modo = 'login' | 'primeiro-acesso' | 'recuperar' | 'redefinir' | 'trocar-obrigatorio';

interface AvatarInfo {
  nome?: string;
  fotoBase64?: string;
}

/**
 * Tela 1 -- Login / Cadastrar / Recuperar senha (funcionario).
 * - autoComplete attributes para o gerenciador de senhas do dispositivo salvar as credenciais.
 * - Fluxo "Esqueceu a senha?": envia token ao e-mail → funcionario digita token + nova senha.
 * - Token de redefinicao pre-preenchido se ?token= estiver na URL (link do e-mail).
 */
export function TelaLogin({ onAutenticado }: { onAutenticado: (t: ParTokens) => void }) {
  // Detecta token de redefinicao na URL (link enviado por email).
  const tokenUrl = new URLSearchParams(window.location.search).get('token') ?? '';

  const [modo, setModo] = useState<Modo>(tokenUrl ? 'redefinir' : 'login');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [tokenRedefinir, setTokenRedefinir] = useState(tokenUrl);
  const [trocaSenhaToken, setTrocaSenhaToken] = useState('');
  const [codigo, setCodigo] = useState('');
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [avatar, setAvatar] = useState<AvatarInfo | null>(null);
  const timerAvatar = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cpfValido = isCpfValido(cpf);
  const senhaCheck = validarSenha(senha);
  const novaSenhaCheck = validarSenha(novaSenha);

  // Limpa o ?token= da URL sem recarregar; tokenUrl e constante derivada do
  // href no momento da montagem — nao muda apos isso, ref e o padrao correto.
  const tokenLimpoRef = useRef(false);
  if (!tokenLimpoRef.current && tokenUrl) {
    tokenLimpoRef.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    window.history.replaceState({}, '', url.toString());
  }

  // Busca avatar com debounce ao completar 11 dígitos válidos.
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

  // ---- Login / Primeiro acesso ----
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
          setTrocaSenhaToken(r.trocaSenhaToken);
          trocarModo('trocar-obrigatorio');
          return;
        }
        onAutenticado(r);
      } else {
        const t = await apiPost<ParTokens>('/auth/funcionario/primeiro-acesso', {
          codigo: codigo.toUpperCase(),
          cpf: normalizarCpf(cpf),
          senha,
          aceiteTermos: aceite,
        });
        onAutenticado(t);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao autenticar.');
    } finally {
      setCarregando(false);
    }
  }

  // ---- Troca de senha obrigatória (protocolo de emergência) ----
  async function trocarObrigatorio() {
    setErro(null);
    if (!novaSenhaCheck.valido) return setErro(novaSenhaCheck.erros.join(' '));
    if (novaSenha !== confirmarSenha) return setErro('As senhas não conferem.');
    setCarregando(true);
    try {
      const t = await apiPost<ParTokens>('/auth/funcionario/trocar-senha-obrigatorio', {
        trocaSenhaToken,
        novaSenha,
      });
      onAutenticado(t);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao trocar a senha.');
    } finally {
      setCarregando(false);
    }
  }

  // ---- Recuperar senha: envia e-mail com link de redefinição ----
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
      // Sempre exibe a mensagem neutra — não revela se o CPF existe.
      setSucesso(
        'Se o CPF estiver cadastrado, enviaremos um link de redefinição para o e-mail do cadastro. Verifique a caixa de entrada.',
      );
    } finally {
      setCarregando(false);
    }
  }

  // ---- Redefinir senha: token + nova senha ----
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

  // ──────────────────────────────────────────────────────────────────

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

      {!avatar && modo !== 'recuperar' && modo !== 'redefinir' && (
        <p
          style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 'var(--space-3)' }}
        >
          {modo === 'login' ? 'Acesse sua conta' : 'Primeiro acesso com código do RH'}
        </p>
      )}

      {/* ── LOGIN ── */}
      {(modo === 'login' || modo === 'primeiro-acesso') && (
        <Cartao>
          {/* Nome do formulário para o gerenciador de senhas do dispositivo identificar */}
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

          {/* Esqueceu a senha — só aparece no login */}
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

          {/* Link para digitar o código manualmente (caso o e-mail não chegue com link) */}
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

      {/* ── TROCA DE SENHA OBRIGATÓRIA (emergência) ── */}
      {modo === 'trocar-obrigatorio' && (
        <Cartao>
          <div
            style={{
              padding: 'var(--space-3)',
              background: 'var(--color-warning-bg, #fff8e1)',
              border: '1px solid var(--color-warning, #f59e0b)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <p
              style={{
                margin: 0,
                font: '600 13px var(--font-body)',
                color: 'var(--color-warning-text, #92400e)',
              }}
            >
              🔒 Segurança: troca de senha obrigatória
            </p>
            <p
              style={{
                margin: '4px 0 0',
                font: '400 12px var(--font-body)',
                color: 'var(--color-warning-text, #92400e)',
              }}
            >
              Por medida de segurança, crie uma nova senha para continuar. O código tem validade de
              10 minutos.
            </p>
          </div>

          <form
            name="trocar-senha-obrigatorio"
            onSubmit={(e) => {
              e.preventDefault();
              void trocarObrigatorio();
            }}
          >
            <Campo
              label="Nova senha"
              name="new-password"
              type="password"
              autoComplete="new-password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void trocarObrigatorio()}
              erro={
                novaSenha.length > 0 && !novaSenhaCheck.valido ? novaSenhaCheck.erros[0] : undefined
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
              onKeyDown={(e) => e.key === 'Enter' && void trocarObrigatorio()}
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
            <Botao onClick={trocarObrigatorio} disabled={carregando}>
              {carregando ? 'Salvando…' : 'Salvar nova senha e entrar'}
            </Botao>
          </form>
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
        {(modo === 'login' || modo === 'primeiro-acesso') && (
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
        {/* trocar-obrigatorio: sem link de voltar — a troca é mandatória */}
      </div>
    </div>
  );
}
