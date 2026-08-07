import { useState, type ReactNode } from 'react';
import { Icone, type NomeIcone } from './icons';
import { MarcaRepp } from './components';

export interface ItemNav {
  id: string;
  rotulo: string;
  icone: NomeIcone;
}
export interface GrupoNav {
  titulo?: string;
  itens: ItemNav[];
}

/**
 * Shell de aplicacao: sidebar de navegacao agrupada + topbar. Responsivo: em
 * telas estreitas a sidebar vira drawer (hamburger). Toda a logica de sessao/
 * rotas fica no chamador (App.tsx); aqui e so o layout.
 */
export function AppShell({
  subtitulo,
  grupos,
  ativo,
  aoNavegar,
  tituloPagina,
  acoes,
  children,
}: {
  subtitulo: string;
  grupos: GrupoNav[];
  ativo: string;
  aoNavegar: (id: string) => void;
  tituloPagina?: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  const [aberta, setAberta] = useState(false);
  const navegar = (id: string) => {
    aoNavegar(id);
    setAberta(false);
  };

  return (
    <div className="g-shell">
      {aberta && (
        <div className="g-scrim g-scrim--visivel" onClick={() => setAberta(false)} aria-hidden />
      )}

      <aside className={`g-sidebar${aberta ? ' g-sidebar--aberta' : ''}`}>
        <div className="g-sidebar__brand">
          <MarcaRepp subtitulo={subtitulo} />
        </div>
        <nav className="g-sidebar__nav" aria-label="Navegação principal">
          {grupos.map((g, i) => (
            <div key={g.titulo ?? i}>
              {g.titulo && <div className="g-sidebar__group-label">{g.titulo}</div>}
              {g.itens.map((it) => (
                <button
                  key={it.id}
                  className={`g-nav-item${ativo === it.id ? ' g-nav-item--active' : ''}`}
                  onClick={() => navegar(it.id)}
                  aria-current={ativo === it.id ? 'page' : undefined}
                >
                  <span className="g-nav-item__icon">
                    <Icone nome={it.icone} tamanho={18} />
                  </span>
                  {it.rotulo}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="g-main">
        <header className="g-topbar">
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', minWidth: 0 }}
          >
            <button
              className="g-hamburger"
              onClick={() => setAberta((v) => !v)}
              aria-label="Abrir menu"
            >
              <Icone nome="menu" />
            </button>
            <span
              style={{
                font: '600 var(--text-md) var(--font-display)',
                letterSpacing: '-0.01em',
                color: 'var(--color-text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {tituloPagina}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {acoes}
          </div>
        </header>

        <main className="g-content">
          <div className="g-content__inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
