/**
 * Icones de linha (stroke = currentColor), 20x20. Minimalistas e consistentes
 * -- substituem os emojis por um vocabulario visual profissional.
 */
export type NomeIcone =
  | 'dashboard'
  | 'ponto'
  | 'funcionarios'
  | 'ausencias'
  | 'comunicados'
  | 'assinaturas'
  | 'relatorios'
  | 'auditoria'
  | 'config'
  | 'integracoes'
  | 'quiosque'
  | 'folha'
  | 'documentos'
  | 'ferias'
  | 'menu'
  | 'sair'
  | 'externo'
  | 'busca'
  | 'sino'
  | 'sino-off'
  | 'fechar';

const PATHS: Record<NomeIcone, JSX.Element> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  ponto: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  funcionarios: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 20a5.5 5.5 0 0 0-2.5-4.6" />
    </>
  ),
  ausencias: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </>
  ),
  comunicados: (
    <>
      <path d="M4 9v6h3l7 4V5L7 9H4z" />
      <path d="M17.5 9a3.5 3.5 0 0 1 0 6" />
    </>
  ),
  assinaturas: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 14c1.5-2 3-2 3 0s1.5 2 3 0" />
    </>
  ),
  relatorios: (
    <>
      <path d="M4 20h16" />
      <rect x="6" y="11" width="3" height="6" rx="0.8" />
      <rect x="11" y="7" width="3" height="10" rx="0.8" />
      <rect x="16" y="13" width="3" height="4" rx="0.8" />
    </>
  ),
  auditoria: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  config: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
  integracoes: (
    <>
      <path d="M9 7V4M15 7V4M8 7h8v4a4 4 0 0 1-8 0z" />
      <path d="M12 15v5" />
    </>
  ),
  quiosque: (
    <>
      <rect x="4" y="3" width="16" height="13" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </>
  ),
  folha: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  documentos: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  ferias: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  sair: (
    <>
      <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </>
  ),
  externo: (
    <>
      <path d="M14 4h6v6M20 4l-8 8" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  ),
  busca: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  sino: (
    <>
      <path d="M18 9a6 6 0 1 0-12 0c0 6-3 8-3 8h18s-3-2-3-8" />
      <path d="M10.5 21a2 2 0 0 0 3 0" />
    </>
  ),
  'sino-off': (
    <>
      <path d="M18 9a6 6 0 0 0-9.3-5" />
      <path d="M6 9c0 6-3 8-3 8h13" />
      <path d="M10.5 21a2 2 0 0 0 3 0" />
      <path d="M3 3l18 18" />
    </>
  ),
  fechar: <path d="M6 6l12 12M18 6L6 18" />,
};

export function Icone({ nome, tamanho = 20 }: { nome: NomeIcone; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {PATHS[nome]}
    </svg>
  );
}
