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
import { TelaQuiosque } from './quiosque/TelaQuiosque';
import {
  definirSessao,
  EVENTO_SESSAO_EXPIRADA,
  limparSessao,
  sessaoAtual,
  type Contexto,
  type ParTokens,
} from './lib/api';

/**
 * Navegacao (Fases 1-3): apos autenticar, o funcionario acessa Bater Ponto
 * (Tela 3) e Documentos (Tela 4); o admin acessa Gestao de Ponto (ADM 4) e
 * Gestao de Funcionarios (ADM 2).
 */
export function App(): JSX.Element {
  // Modo Quiosque (tablet na portaria): standalone, sem login de funcionario.
  // Acessado por ?modo=quiosque -- isolado do fluxo normal.
  if (new URLSearchParams(window.location.search).get('modo') === 'quiosque') {
    return <TelaQuiosque />;
  }

  // Restaura a sessao apos recarregar (o token fica no localStorage).
  const sessao = sessaoAtual();
  const [contexto, setContexto] = useState<Contexto>(sessao ?? 'funcionario');
  const [autenticado, setAutenticado] = useState(sessao !== null);
  const [secao, setSecao] = useState('principal');

  function aoAutenticar(t: ParTokens) {
    definirSessao(t, contexto);
    setSecao('principal');
    setAutenticado(true);
  }
  function sair() {
    limparSessao();
    setAutenticado(false);
  }

  // Sessao expirada sem renovacao possivel -> volta ao login.
  useEffect(() => {
    const aoExpirar = () => setAutenticado(false);
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar);
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar);
  }, []);

  if (autenticado && contexto === 'super') {
    return <SuperPanel onSair={sair} />;
  }

  if (autenticado) {
    const abas =
      contexto === 'funcionario'
        ? [
            { id: 'principal', rotulo: 'Bater Ponto' },
            { id: 'folha', rotulo: 'Folha' },
            { id: 'documentos', rotulo: 'Documentos' },
            { id: 'ferias', rotulo: 'Ferias' },
            { id: 'comunicados', rotulo: 'Comunicados' },
          ]
        : [
            { id: 'dashboard', rotulo: 'Dashboard' },
            { id: 'principal', rotulo: 'Gestao de Ponto' },
            { id: 'funcionarios', rotulo: 'Funcionarios' },
            { id: 'assinaturas', rotulo: 'Assinaturas' },
            { id: 'ausencias', rotulo: 'Ausencias' },
            { id: 'comunicados', rotulo: 'Comunicados' },
            { id: 'relatorios', rotulo: 'Relatorios' },
            { id: 'auditoria', rotulo: 'Auditoria' },
            { id: 'config', rotulo: 'Configuracoes' },
            { id: 'integracoes', rotulo: 'Integracoes' },
            { id: 'quiosque', rotulo: 'Quiosque' },
          ];
    const telas: Record<string, JSX.Element> =
      contexto === 'funcionario'
        ? {
            principal: <BaterPonto />,
            folha: <Folha />,
            documentos: <Documentos />,
            ferias: <Ferias />,
            comunicados: <Comunicados />,
          }
        : {
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
          };
    return (
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--space-2) var(--space-3)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {abas.map((a) => (
              <TabBtn key={a.id} ativo={secao === a.id} onClick={() => setSecao(a.id)}>
                {a.rotulo}
              </TabBtn>
            ))}
          </div>
          <button
            onClick={sair}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-accent)',
              cursor: 'pointer',
            }}
          >
            Sair
          </button>
        </div>
        {telas[secao] ?? telas.principal}
      </div>
    );
  }

  return (
    <>
      <nav
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          padding: 'var(--space-3)',
          justifyContent: 'center',
        }}
      >
        <TabBtn ativo={contexto === 'funcionario'} onClick={() => setContexto('funcionario')}>
          Funcionario
        </TabBtn>
        <TabBtn ativo={contexto === 'admin'} onClick={() => setContexto('admin')}>
          Administrador
        </TabBtn>
        <TabBtn ativo={contexto === 'super'} onClick={() => setContexto('super')}>
          Plataforma
        </TabBtn>
      </nav>
      {contexto === 'funcionario' ? (
        <TelaLogin onAutenticado={aoAutenticar} />
      ) : contexto === 'admin' ? (
        <AdmLogin onAutenticado={aoAutenticar} />
      ) : (
        <SuperLogin onAutenticado={aoAutenticar} />
      )}
    </>
  );
}

function TabBtn({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)',
        background: ativo ? 'var(--color-accent)' : 'var(--color-surface)',
        color: ativo ? 'var(--color-navy-deep)' : 'var(--color-navy-900)',
        cursor: 'pointer',
        font: '500 14px var(--font-body)',
      }}
    >
      {children}
    </button>
  );
}
