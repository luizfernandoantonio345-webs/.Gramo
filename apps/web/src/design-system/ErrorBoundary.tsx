import { Component, type ReactNode } from 'react';

/**
 * Rede de seguranca: se qualquer tela filha lancar durante o render, mostra um
 * cartao de erro em vez de apagar o app inteiro (tela branca). Reseta ao trocar
 * a `key` (ex.: navegar para outra secao).
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; rotulo?: string },
  { erro: Error | null }
> {
  override state: { erro: Error | null } = { erro: null };

  static getDerivedStateFromError(erro: Error) {
    return { erro };
  }

  override componentDidCatch(erro: Error) {
    // Loga no console para diagnostico (o Error Boundary ja evita o crash visual).
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] tela quebrou:', erro);
  }

  override render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          border: '1px solid var(--color-danger)',
          background: 'var(--color-danger-tint)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-6)',
          color: 'var(--color-text)',
          font: '400 var(--text-base) var(--font-body)',
          maxWidth: 560,
          margin: 'var(--space-6) auto',
        }}
      >
        <div
          style={{ font: '600 var(--text-lg) var(--font-display)', marginBottom: 'var(--space-3)' }}
        >
          Algo saiu do esperado nesta tela
        </div>
        <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-text-muted)' }}>
          {this.props.rotulo ?? 'O restante do sistema continua funcionando'} — tente outra seção no
          menu ou recarregue a página.
        </p>
        <button
          className="g-btn g-btn--md g-btn--secondary"
          onClick={() => this.setState({ erro: null })}
        >
          Tentar novamente
        </button>
      </div>
    );
  }
}
