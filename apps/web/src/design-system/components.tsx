import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/**
 * Design System .GRAMO -- tema claro corporativo. Componentes consomem as
 * classes de estado de ui.css (:hover/:focus/:active) e os tokens de tokens.css.
 * A API publica e mantida compativel com as telas existentes.
 */

/* ------------------------------------------------------------------ Botao - */
type VarianteBotao = 'primario' | 'secundario' | 'ghost' | 'perigo';
const CLASSE_VARIANTE: Record<VarianteBotao, string> = {
  primario: 'g-btn--primary',
  secundario: 'g-btn--secondary',
  ghost: 'g-btn--ghost',
  perigo: 'g-btn--danger',
};

export function Botao({
  children,
  variante = 'primario',
  grande = false,
  tamanho,
  bloco = true,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao;
  grande?: boolean;
  tamanho?: 'sm' | 'md' | 'lg';
  bloco?: boolean;
}) {
  const size = tamanho ?? (grande ? 'lg' : 'md');
  const classes = [
    'g-btn',
    `g-btn--${size}`,
    CLASSE_VARIANTE[variante],
    bloco ? 'g-btn--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button {...props} className={classes}>
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- Feedback - */
const TONS_FEEDBACK = {
  sucesso: { bg: 'var(--color-success-tint)', cor: 'var(--color-success)', icone: '✓' },
  erro: { bg: 'var(--color-danger-tint)', cor: 'var(--color-danger)', icone: '!' },
  aviso: { bg: 'var(--color-warning-tint)', cor: 'var(--color-warning)', icone: '!' },
  info: { bg: 'var(--color-info-tint)', cor: 'var(--color-info)', icone: 'i' },
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
        gap: 'var(--space-4)',
        alignItems: 'flex-start',
        background: t.bg,
        border: `1px solid ${t.cor}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4) var(--space-5)',
        color: 'var(--color-text)',
        font: `500 var(--text-base) var(--font-body)`,
      }}
    >
      <span
        aria-hidden
        style={{
          flex: '0 0 20px',
          width: 20,
          height: 20,
          borderRadius: 'var(--radius-full)',
          background: t.cor,
          color: '#fff',
          font: '700 12px var(--font-body)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {t.icone}
      </span>
      <span>{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------ Demo helpers - */
export function ambienteDemo(): boolean {
  return typeof window !== 'undefined' && window.location.hostname === 'localhost';
}

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
      className="g-btn g-btn--md g-btn--block"
      style={{
        marginTop: 'var(--space-3)',
        background: 'transparent',
        border: '1px dashed var(--color-border-strong)',
        color: 'var(--color-accent)',
        fontWeight: 600,
      }}
    >
      ⚡ {rotulo}
    </button>
  );
}

/* ------------------------------------------------------------ EstadoVazio - */
export function EstadoVazio({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        textAlign: 'center',
        color: 'var(--color-text-muted)',
        font: '400 var(--text-base) var(--font-body)',
        padding: 'var(--space-8) 0',
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

/* -------------------------------------------------------- CabecalhoPagina - */
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
        gap: 'var(--space-5)',
        marginBottom: 'var(--space-7)',
        flexWrap: 'wrap',
      }}
    >
      <div>
        <h1
          style={{
            font: '600 var(--text-2xl) var(--font-display)',
            letterSpacing: '-0.01em',
            margin: 0,
            color: 'var(--color-text)',
          }}
        >
          {titulo}
        </h1>
        {subtitulo && (
          <p
            style={{
              font: '400 var(--text-base) var(--font-body)',
              color: 'var(--color-text-muted)',
              margin: 'var(--space-2) 0 0',
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

/* ---------------------------------------------------------------- Kpi ----- */
const TOM_KPI = {
  neutro: 'var(--color-text)',
  ok: 'var(--color-success)',
  aviso: 'var(--color-warning)',
  alerta: 'var(--color-danger)',
} as const;

export function Kpi({
  rotulo,
  valor,
  tom = 'neutro',
  dica,
}: {
  rotulo: string;
  valor: ReactNode;
  tom?: keyof typeof TOM_KPI;
  dica?: string;
}) {
  return (
    <div className="g-card" style={{ padding: 'var(--space-5) var(--space-5) var(--space-4)' }}>
      <div
        style={{
          font: '500 var(--text-sm) var(--font-body)',
          color: 'var(--color-text-muted)',
        }}
      >
        {rotulo}
      </div>
      <div
        style={{
          font: '600 var(--text-2xl) var(--font-display)',
          letterSpacing: '-0.02em',
          color: TOM_KPI[tom],
          marginTop: 'var(--space-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {valor}
      </div>
      {dica && (
        <div
          style={{
            font: '400 var(--text-xs) var(--font-body)',
            color: 'var(--color-text-faint)',
            marginTop: 'var(--space-2)',
          }}
        >
          {dica}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- Campo ----- */
function Rotulo({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'block',
        font: '500 var(--text-sm) var(--font-body)',
        color: 'var(--color-text-secondary)',
        marginBottom: 'var(--space-3)',
      }}
    >
      {children}
    </span>
  );
}

function MsgErro({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'block',
        color: 'var(--color-danger)',
        font: '400 var(--text-xs) var(--font-body)',
        marginTop: 'var(--space-2)',
      }}
    >
      {children}
    </span>
  );
}

export function Campo({
  label,
  erro,
  dica,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; erro?: string; dica?: string }) {
  return (
    <label style={{ display: 'block', marginBottom: 'var(--space-5)' }}>
      <Rotulo>{label}</Rotulo>
      <input {...props} className={`g-input${erro ? ' g-input--erro' : ''}`} />
      {dica && !erro && (
        <span
          style={{
            display: 'block',
            color: 'var(--color-text-muted)',
            font: '400 var(--text-xs) var(--font-body)',
            marginTop: 'var(--space-2)',
          }}
        >
          {dica}
        </span>
      )}
      {erro && <MsgErro>{erro}</MsgErro>}
    </label>
  );
}

export function Selecao({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label style={{ display: 'block', marginBottom: 'var(--space-5)' }}>
      <Rotulo>{label}</Rotulo>
      <select {...props} className="g-select">
        {children}
      </select>
    </label>
  );
}

export function AreaTexto({
  label,
  erro,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; erro?: string }) {
  return (
    <label style={{ display: 'block', marginBottom: 'var(--space-5)' }}>
      <Rotulo>{label}</Rotulo>
      <textarea {...props} className={`g-textarea${erro ? ' g-input--erro' : ''}`} />
      {erro && <MsgErro>{erro}</MsgErro>}
    </label>
  );
}

/* --------------------------------------------------------------- Badge ---- */
/**
 * Badge de status: cor + texto (acessibilidade). Recebe uma cor de acento e
 * renderiza um "tint" suave (fundo claro + texto forte) -- nunca cor solida
 * gritante. `cor` aceita hex ou var() CSS (via color-mix).
 */
export function Badge({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: '3px var(--space-3)',
        borderRadius: 'var(--radius-full)',
        background: `color-mix(in srgb, ${cor} 12%, #fff)`,
        border: `1px solid color-mix(in srgb, ${cor} 28%, #fff)`,
        color: `color-mix(in srgb, ${cor} 82%, #0f172a)`,
        font: '600 var(--text-xs) var(--font-body)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------- Cartao ---- */
export function Cartao({
  children,
  padding = 'var(--space-7)',
  hover = false,
  className,
  style,
}: {
  children: ReactNode;
  padding?: CSSProperties['padding'];
  hover?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`g-card${hover ? ' g-card--hover' : ''}${className ? ` ${className}` : ''}`}
      style={{ padding, ...style }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------- Tabela ---- */
/**
 * Tabela padronizada: envolve <table class="g-table"> com scroll horizontal.
 * A tela fornece <thead>/<tbody>; use className "g-num" em celulas numericas.
 */
export function Tabela({ children, minWidth }: { children: ReactNode; minWidth?: number }) {
  return (
    <div style={{ overflowX: 'auto', margin: '0 calc(var(--space-2) * -1)' }}>
      <table
        className="g-table"
        style={{ minWidth, margin: '0 var(--space-2)', width: 'calc(100% - var(--space-4))' }}
      >
        {children}
      </table>
    </div>
  );
}

/* ---------------------------------------------------- Layout primitives --- */
/** Titulo de secao dentro de um cartao, com area de "meta" opcional a direita. */
export function TituloSecao({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-5)',
      }}
    >
      <h2
        style={{
          font: '600 var(--text-lg) var(--font-display)',
          letterSpacing: '-0.01em',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        {children}
      </h2>
      {meta}
    </div>
  );
}

/** Linha de lista com divisoria inferior (padrao interno dos cartoes). */
export function LinhaLista({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        padding: 'var(--space-4) 0',
        borderBottom: '1px solid var(--color-divider)',
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------- MarcaRepp - */
/**
 * Marca .GRAMO (lockup): tile de acento + wordmark + subtitulo opcional. Sobrio
 * para transmitir autoridade -- sem brilho/gradiente neon.
 */
export function MarcaRepp({ subtitulo }: { subtitulo?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
      <div
        aria-hidden
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'var(--color-accent)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: '700 20px var(--font-display)',
          color: '#fff',
          flex: '0 0 auto',
        }}
      >
        G
      </div>
      <div>
        <div
          style={{
            font: '700 var(--text-xl) var(--font-display)',
            letterSpacing: '-0.02em',
            lineHeight: 1,
            color: 'var(--color-text)',
          }}
        >
          <span style={{ color: 'var(--color-accent)' }}>.</span>GRAMO
        </div>
        {subtitulo && (
          <div
            style={{
              font: '500 var(--text-xs) var(--font-body)',
              color: 'var(--color-text-muted)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginTop: 5,
            }}
          >
            {subtitulo}
          </div>
        )}
      </div>
    </div>
  );
}
