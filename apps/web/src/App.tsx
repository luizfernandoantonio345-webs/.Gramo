import { useEffect, useState } from 'react';
import { BaterPonto } from './app-funcionario/BaterPonto';
import { Comunicados } from './app-funcionario/Comunicados';
import { Documentos } from './app-funcionario/Documentos';
import { Ferias } from './app-funcionario/Ferias';
import { Folha } from './app-funcionario/Folha';
import { TelaLogin } from './app-funcionario/TelaLogin';
import { AdmLogin } from './painel-admin/AdmLogin';
import { GestaoFuncionarios } from './painel-admin/GestaoFuncionarios';
import { GestaoPonto } from './painel-admin/GestaoPonto';
import { PainelAssinaturas } from './painel-admin/PainelAssinaturas';
import { PainelAuditoria } from './painel-admin/PainelAuditoria';
import { PainelAusencias } from './painel-admin/PainelAusencias';
import { PainelComunicados } from './painel-admin/PainelComunicados';
import { PainelConfiguracoes } from './painel-admin/PainelConfiguracoes';
import { PainelDashboard } from './painel-admin/PainelDashboard';
import { PainelIntegracoes } from './painel-admin/PainelIntegracoes';
import { PainelQuiosque } from './painel-admin/PainelQuiosque';
import { PainelRelatorios } from './painel-admin/PainelRelatorios';
import { SuperLogin } from './painel-admin/SuperLogin';
import { SuperPanel } from './painel-admin/SuperPanel';
import { TelaoPresenca } from './painel-admin/TelaoPresenca';
import { TelaQuiosque } from './quiosque/TelaQuiosque';
import { AppShell, type GrupoNav } from './design-system/AppShell';
import { ErrorBoundary } from './design-system/ErrorBoundary';
import { Icone } from './design-system/icons';
import {
  definirSessao,
  EVENTO_SESSAO_EXPIRADA,
  limparSessao,
  sessaoAtual,
  type Contexto,
  type ParTokens,
} from './lib/api';

// Navegacao agrupada do painel administrativo.
const GRUPOS_ADMIN: GrupoNav[] = [
  { itens: [{ id: 'dashboard', rotulo: 'Dashboard', icone: 'dashboard' }] },
  {
    titulo: 'Operação',
    itens: [
      { id: 'principal', rotulo: 'Gestão de ponto', icone: 'ponto' },
      { id: 'funcionarios', rotulo: 'Funcionários', icone: 'funcionarios' },
      { id: 'ausencias', rotulo: 'Ausências', icone: 'ausencias' },
      { id: 'comunicados', rotulo: 'Comunicados', icone: 'comunicados' },
    ],
  },
  {
    titulo: 'Documentos',
    itens: [
      { id: 'assinaturas', rotulo: 'Assinaturas', icone: 'assinaturas' },
      { id: 'relatorios', rotulo: 'Relatórios', icone: 'relatorios' },
    ],
  },
  {
    titulo: 'Sistema',
    itens: [
      { id: 'auditoria', rotulo: 'Auditoria', icone: 'auditoria' },
      { id: 'config', rotulo: 'Configurações', icone: 'config' },
      { id: 'integracoes', rotulo: 'Integrações', icone: 'integracoes' },
      { id: 'quiosque', rotulo: 'Quiosque', icone: 'quiosque' },
    ],
  },
];

const GRUPOS_FUNCIONARIO: GrupoNav[] = [
  {
    itens: [
      { id: 'principal', rotulo: 'Bater ponto', icone: 'ponto' },
      { id: 'folha', rotulo: 'Folha', icone: 'folha' },
      { id: 'documentos', rotulo: 'Documentos', icone: 'documentos' },
      { id: 'ferias', rotulo: 'Férias', icone: 'ferias' },
      { id: 'comunicados', rotulo: 'Comunicados', icone: 'comunicados' },
    ],
  },
];

const TITULOS: Record<string, string> = {
  dashboard: 'Dashboard',
  principal: 'Gestão de ponto',
  funcionarios: 'Funcionários',
  ausencias: 'Ausências',
  comunicados: 'Comunicados',
  assinaturas: 'Assinaturas',
  relatorios: 'Relatórios',
  auditoria: 'Auditoria',
  config: 'Configurações',
  integracoes: 'Integrações',
  quiosque: 'Quiosque',
  folha: 'Folha de ponto',
  documentos: 'Documentos',
  ferias: 'Férias e afastamentos',
};

/**
 * Casca de navegacao. Apos autenticar, funcionario e admin usam o AppShell
 * (sidebar + topbar); a plataforma (super) tem painel proprio.
 */
export function App(): JSX.Element {
  // Modos standalone (isolados do fluxo normal), por ?modo=... :
  const modo = new URLSearchParams(window.location.search).get('modo');
  if (modo === 'quiosque') return <TelaQuiosque />;
  if (modo === 'presenca') return <TelaoPresenca />;

  const sessao = sessaoAtual();
  const [contexto, setContexto] = useState<Contexto>(sessao ?? 'funcionario');
  const [autenticado, setAutenticado] = useState(sessao !== null);
  const [secao, setSecao] = useState('principal');

  function aoAutenticar(t: ParTokens) {
    definirSessao(t, contexto);
    setSecao(contexto === 'admin' ? 'dashboard' : 'principal');
    setAutenticado(true);
  }
  function sair() {
    limparSessao();
    setAutenticado(false);
  }

  useEffect(() => {
    const aoExpirar = () => setAutenticado(false);
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar);
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar);
  }, []);

  if (autenticado && contexto === 'super') {
    return <SuperPanel onSair={sair} />;
  }

  if (autenticado) {
    const ehAdmin = contexto === 'admin';
    const telas: Record<string, JSX.Element> = ehAdmin
      ? {
          dashboard: <PainelDashboard />,
          principal: <GestaoPonto />,
          funcionarios: <GestaoFuncionarios />,
          assinaturas: <PainelAssinaturas />,
          ausencias: <PainelAusencias />,
          comunicados: <PainelComunicados />,
          relatorios: <PainelRelatorios />,
          auditoria: <PainelAuditoria />,
          config: <PainelConfiguracoes />,
          integracoes: <PainelIntegracoes />,
          quiosque: <PainelQuiosque />,
        }
      : {
          principal: <BaterPonto />,
          folha: <Folha />,
          documentos: <Documentos />,
          ferias: <Ferias />,
          comunicados: <Comunicados />,
        };

    const acoes = (
      <>
        {ehAdmin && (
          <a
            href="?modo=presenca"
            target="_blank"
            rel="noreferrer"
            className="g-btn g-btn--sm g-btn--ghost"
          >
            <Icone nome="externo" tamanho={16} /> Telão
          </a>
        )}
        <button onClick={sair} className="g-btn g-btn--sm g-btn--ghost">
          <Icone nome="sair" tamanho={16} /> Sair
        </button>
      </>
    );

    return (
      <AppShell
        subtitulo={ehAdmin ? 'Administração' : 'Portal do colaborador'}
        grupos={ehAdmin ? GRUPOS_ADMIN : GRUPOS_FUNCIONARIO}
        ativo={secao}
        aoNavegar={setSecao}
        tituloPagina={TITULOS[secao] ?? ''}
        acoes={acoes}
      >
        <ErrorBoundary key={secao}>
          {telas[secao] ?? telas.principal ?? telas.dashboard}
        </ErrorBoundary>
      </AppShell>
    );
  }

  return <TelaAcesso contexto={contexto} setContexto={setContexto} aoAutenticar={aoAutenticar} />;
}

/** Tela de acesso (nao autenticado): seletor de perfil + formulario de login. */
function TelaAcesso({
  contexto,
  setContexto,
  aoAutenticar,
}: {
  contexto: Contexto;
  setContexto: (c: Contexto) => void;
  aoAutenticar: (t: ParTokens) => void;
}) {
  // Cliente unico (GRAMO): a aba "Plataforma" (operador do SaaS) fica OCULTA --
  // so aparece com ?plataforma=1 (acesso do fornecedor). Assim a empresa nao ve
  // que o sistema atende multiplas empresas.
  const mostrarPlataforma = new URLSearchParams(window.location.search).get('plataforma') === '1';
  const abas: { id: Contexto; rotulo: string }[] = [
    { id: 'funcionario', rotulo: 'Colaborador' },
    { id: 'admin', rotulo: 'Administrador' },
    ...(mostrarPlataforma ? [{ id: 'super' as Contexto, rotulo: 'Plataforma' }] : []),
  ];
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: 'var(--space-9) var(--space-5)',
      }}
    >
      {/* Marca da GRAMO desfocada ao fundo -- sutil, nao compete com o formulario.
          O blur tambem disfarca a baixa resolucao do logo. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backgroundImage: 'url(/gramo-logo.png)',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: 'min(620px, 85vw)',
          filter: 'blur(14px)',
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div className="g-seg" role="tablist" style={{ marginBottom: 'var(--space-8)' }}>
          {abas.map((a) => (
            <button
              key={a.id}
              role="tab"
              aria-selected={contexto === a.id}
              onClick={() => setContexto(a.id)}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
        {contexto === 'funcionario' ? (
          <TelaLogin onAutenticado={aoAutenticar} />
        ) : contexto === 'admin' ? (
          <AdmLogin onAutenticado={aoAutenticar} />
        ) : (
          <SuperLogin onAutenticado={aoAutenticar} />
        )}
      </div>
    </div>
  );
}
