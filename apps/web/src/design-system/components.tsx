import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

/** Botao primario (radius-lg, caixa alta) conforme o design system. */
export function Botao({
  children,
  variante = 'primario',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' }) {
  const cor = variante === 'primario' ? 'var(--color-accent)' : 'var(--color-surface)';
  const texto = variante === 'primario' ? '#fff' : 'var(--color-navy-900)';
  return (
    <button
      {...props}
      style={{
        width: '100%',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-lg)',
        border: variante === 'secundario' ? '1px solid var(--color-border)' : 'none',
        background: props.disabled ? '#9db4d8' : cor,
        color: texto,
        font: '600 15px var(--font-body)',
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
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
      <span style={{ display: 'block', font: '500 13px var(--font-body)', marginBottom: 'var(--space-1)' }}>
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
        }}
      />
      {erro && (
        <span style={{ color: 'var(--color-red-alert)', font: '400 12px var(--font-body)' }}>{erro}</span>
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
      <span style={{ display: 'block', font: '500 13px var(--font-body)', marginBottom: 'var(--space-1)' }}>
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
        color: '#fff',
        font: '500 12px var(--font-body)',
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
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
      }}
    >
      {children}
    </div>
  );
}
