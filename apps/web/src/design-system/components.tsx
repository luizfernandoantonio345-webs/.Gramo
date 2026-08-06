import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

/**
 * Botao primario (radius-lg, caixa alta) conforme o design system.
 * `grande` = acao principal (alvo de toque generoso p/ uso em campo).
 * Sempre >=44px de altura (acessibilidade/toque). `style` do chamador e mesclado.
 */
export function Botao({
  children,
  variante = 'primario',
  grande = false,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario';
  grande?: boolean;
}) {
  const primario = variante === 'primario';
  const cor = primario ? 'var(--gradient-accent)' : 'var(--color-surface-2)';
  // Texto ESCURO sobre o acento vivo (acao primaria) -> contraste alto, ar premium.
  const texto = primario ? 'var(--color-navy-deep)' : 'var(--color-navy-900)';
  return (
    <button
      {...props}
      style={{
        width: '100%',
        minHeight: grande ? 60 : 46,
        padding: grande ? 'var(--space-3) var(--space-4)' : 'var(--space-3)',
        borderRadius: 'var(--radius-lg)',
        border: variante === 'secundario' ? '1px solid var(--color-border)' : 'none',
        background: props.disabled ? 'var(--color-surface-2)' : cor,
        color: props.disabled ? 'var(--color-text-muted)' : texto,
        boxShadow: primario && !props.disabled ? 'var(--glow-accent)' : 'none',
        font: `${grande ? '700 17px' : '700 14px'} var(--font-body)`,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        transition: 'transform 0.06s ease, box-shadow 0.15s ease',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/**
 * Feedback de acao: SEMPRE cor + texto (nunca so cor) e `aria-live` para leitor
 * de tela. Substitui o uso do Badge para mensagens. Tons funcionais:
 * sucesso (teal), erro (vermelho), aviso (ambar -- sinaliza, nao bloqueia), info.
 */
const TONS_FEEDBACK = {
  sucesso: {
    bg: 'rgba(52,211,153,0.12)',
    borda: 'var(--color-teal-success)',
    texto: '#6ee7b7',
    icone: '✓',
  },
  erro: {
    bg: 'rgba(248,113,113,0.12)',
    borda: 'var(--color-red-alert)',
    texto: '#fca5a5',
    icone: '!',
  },
  aviso: {
    bg: 'rgba(251,191,36,0.12)',
    borda: 'var(--color-amber-warning)',
    texto: '#fcd34d',
    icone: '!',
  },
  info: { bg: 'rgba(34,211,238,0.12)', borda: 'var(--color-accent)', texto: '#67e8f9', icone: 'i' },
} as const;

export function Feedback({
  tom = 'info',
  children,
}: {
  tom?: keyof typeof TONS_FEEDBACK;
  children: ReactNode;
}) {
  const t = TONS_FEEDBACK[tom];
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        alignItems: 'flex-start',
        background: t.bg,
        border: `1px solid ${t.borda}`,
        borderLeft: `4px solid ${t.borda}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
        color: t.texto,
        font: '500 14px var(--font-body)',
      }}
    >
      <span
        aria-hidden
        style={{
          flex: '0 0 20px',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: t.borda,
          color: 'var(--color-navy-deep)',
          font: '700 13px var(--font-body)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {t.icone}
      </span>
      <span>{children}</span>
    </div>
  );
}

/** True em ambiente de demonstracao local (localhost) -- libera os atalhos. */
export function ambienteDemo(): boolean {
  return typeof window !== 'undefined' && window.location.hostname === 'localhost';
}

/** Atalho (dev/demo): preenche as credenciais de teste da aba. */
export function BotaoDemo({
  onClick,
  rotulo = 'Preencher credenciais de demonstração',
}: {
  onClick: () => void;
  rotulo?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        marginTop: 'var(--space-2)',
        minHeight: 44,
        borderRadius: 'var(--radius-md)',
        border: '1px dashed var(--color-border)',
        background: 'transparent',
        color: 'var(--color-accent)',
        cursor: 'pointer',
        font: '600 13px var(--font-body)',
      }}
    >
      ⚡ {rotulo}
    </button>
  );
}

/** Estado vazio (lista sem itens) -- mensagem centralizada e discreta. */
export function EstadoVazio({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        textAlign: 'center',
        color: 'var(--color-text-muted)',
        font: '400 14px var(--font-body)',
        padding: 'var(--space-4) 0',
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

/**
 * Cabecalho de pagina (mundo ADM): titulo + subtitulo de contexto + acao opcional
 * a direita. Da consistencia a densidade do painel administrativo.
 */
export function CabecalhoPagina({
  titulo,
  subtitulo,
  acao,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-4)',
      }}
    >
      <div>
        <h1 style={{ font: '700 24px var(--font-display)', margin: 0 }}>{titulo}</h1>
        {subtitulo && (
          <p
            style={{
              font: '400 14px var(--font-body)',
              color: 'var(--color-text-muted)',
              margin: 'var(--space-1) 0 0',
            }}
          >
            {subtitulo}
          </p>
        )}
      </div>
      {acao && <div style={{ flex: '0 0 auto' }}>{acao}</div>}
    </div>
  );
}

/**
 * Cartao de indicador (KPI) do painel ADM: numero grande + rotulo, com faixa
 * superior colorida FUNCIONAL (neutro/ok/aviso/alerta) -- cor sempre acompanha o
 * significado do numero, nunca decorativa.
 */
const TOM_KPI = {
  neutro: 'var(--color-navy-900)',
  ok: 'var(--color-teal-success)',
  aviso: 'var(--color-amber-warning)',
  alerta: 'var(--color-red-alert)',
} as const;

export function Kpi({
  rotulo,
  valor,
  tom = 'neutro',
}: {
  rotulo: string;
  valor: ReactNode;
  tom?: keyof typeof TOM_KPI;
}) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderTop: `3px solid ${TOM_KPI[tom]}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
      }}
    >
      <div style={{ font: '700 28px var(--font-display)', color: TOM_KPI[tom] }}>{valor}</div>
      <div
        style={{
          font: '500 12px var(--font-body)',
          color: 'var(--color-text-muted)',
          marginTop: 2,
        }}
      >
        {rotulo}
      </div>
    </div>
  );
}

/** Campo de formulario com label e mensagem de erro. */
export function Campo({
  label,
  erro,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; erro?: string }) {
  return (
    <label style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
      <span
        style={{
          display: 'block',
          font: '500 13px var(--font-body)',
          marginBottom: 'var(--space-1)',
        }}
      >
        {label}
      </span>
      <input
        {...props}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${erro ? 'var(--color-red-alert)' : 'var(--color-border)'}`,
          font: '400 15px var(--font-body)',
          background: 'var(--color-surface)',
          color: 'var(--color-navy-900)',
        }}
      />
      {erro && (
        <span style={{ color: 'var(--color-red-alert)', font: '400 12px var(--font-body)' }}>
          {erro}
        </span>
      )}
    </label>
  );
}

/** Campo de selecao (dropdown) com label. Reusa o estilo do Campo. */
export function Selecao({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
      <span
        style={{
          display: 'block',
          font: '500 13px var(--font-body)',
          marginBottom: 'var(--space-1)',
        }}
      >
        {label}
      </span>
      <select
        {...props}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          font: '400 15px var(--font-body)',
          background: 'var(--color-surface)',
          color: 'var(--color-navy-900)',
        }}
      >
        {children}
      </select>
    </label>
  );
}

/** Badge de status: SEMPRE cor + texto (acessibilidade/daltonismo). */
export function Badge({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: 'var(--space-1) var(--space-2)',
        borderRadius: 'var(--radius-sm)',
        background: cor,
        color: 'var(--color-navy-deep)', // texto escuro sobre a cor viva do status
        font: '600 12px var(--font-body)',
      }}
    >
      {children}
    </span>
  );
}

/** Cartao branco sobre fundo neutro. */
export function Cartao({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        backgroundImage: 'var(--realce-topo)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        boxShadow: 'var(--sombra-card)',
      }}
    >
      {children}
    </div>
  );
}

/**
 * Marca .GRAMO (lockup): "logo" com gradiente + wordmark + subtitulo opcional.
 * Da identidade profissional as telas de acesso e cabecalhos.
 */
export function MarcaRepp({ subtitulo }: { subtitulo?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <div
        aria-hidden
        style={{
          width: 46,
          height: 46,
          borderRadius: 13,
          background: 'var(--gradient-marca)',
          boxShadow: 'var(--glow-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: '800 24px var(--font-display)',
          color: 'var(--color-navy-deep)',
          flex: '0 0 auto',
        }}
      >
        G
      </div>
      <div>
        <div
          style={{
            font: '800 23px var(--font-display)',
            letterSpacing: '0.01em',
            lineHeight: 1,
          }}
        >
          <span style={{ color: 'var(--color-accent)' }}>.</span>GRAMO
        </div>
        {subtitulo && (
          <div
            style={{
              font: '500 12px var(--font-body)',
              color: 'var(--color-text-muted)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginTop: 4,
            }}
          >
            {subtitulo}
          </div>
        )}
      </div>
    </div>
  );
}
