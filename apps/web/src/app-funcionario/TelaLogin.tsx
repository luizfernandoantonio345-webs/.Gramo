import { formatarCpf, isCpfValido, normalizarCpf, validarSenha } from '@repp/shared';
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

type Modo = 'login' | 'primeiro-acesso';

/**
 * Tela 1 -- Login / Cadastrar (funcionario). Login com CPF+senha; primeiro
 * acesso via codigo de convite + aceite LGPD. Login exige internet.
 */
export function TelaLogin({ onAutenticado }: { onAutenticado: (t: ParTokens) => void }) {
  const [modo, setModo] = useState<Modo>('login');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const cpfValido = isCpfValido(cpf);
  const senhaCheck = validarSenha(senha);

  async function enviar() {
    setErro(null);
    if (!cpfValido) return setErro('CPF invalido.');
    if (modo === 'primeiro-acesso') {
      if (!senhaCheck.valido) return setErro(senhaCheck.erros.join(' '));
      if (!aceite) return setErro('E preciso aceitar o termo de consentimento LGPD.');
    }
    setCarregando(true);
    try {
      if (modo === 'login') {
        const t = await apiPost<ParTokens>('/auth/funcionario/login', {
          cpf: normalizarCpf(cpf),
          senha,
        });
        onAutenticado(t);
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

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <MarcaRepp subtitulo="Ponto Eletrônico" />
      </div>
      <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 'var(--space-3)' }}>
        {modo === 'login' ? 'Acesse sua conta' : 'Primeiro acesso com código do RH'}
      </p>

      <Cartao>
        {modo === 'primeiro-acesso' && (
          <Campo
            label="Codigo de convite"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="8 caracteres"
            maxLength={8}
          />
        )}
        <Campo
          label="CPF"
          inputMode="numeric"
          value={cpf.length ? formatarCpf(cpf) : ''}
          onChange={(e) => setCpf(normalizarCpf(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && void enviar()}
          erro={cpf.length >= 11 && !cpfValido ? 'Dígito verificador inválido' : undefined}
          placeholder="000.000.000-00"
        />
        <Campo
          label="Senha"
          type="password"
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
              Aceito o termo de uso e o <strong>consentimento LGPD</strong> para biometria facial.
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
      </Cartao>

      <button
        onClick={() => {
          setModo(modo === 'login' ? 'primeiro-acesso' : 'login');
          setErro(null);
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
        {modo === 'login'
          ? 'Primeiro acesso? Cadastre-se com o código do RH'
          : 'Já tenho conta — fazer login'}
      </button>
    </div>
  );
}
