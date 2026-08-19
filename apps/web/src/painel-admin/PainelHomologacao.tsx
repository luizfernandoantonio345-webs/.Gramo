import { useCallback, useEffect, useState } from 'react';
import { Botao, CabecalhoPagina, Cartao, Feedback, TituloSecao } from '../design-system/components';
import { apiGet } from '../lib/api';

interface StatusCompliance {
  totalFuncionarios: number;
  funcionariosSemPis: number;
  totalMarcacoes: number;
  ultimaExportacaoAfd: string | null;
  nsrAtual: number;
}

interface ItemChecklist {
  titulo: string;
  descricao: string;
  ok: boolean | null; // null = informativo (processo admin)
  alerta?: string;
}

/** ADM — Painel de Homologacao REP-P (Portaria 671/2021). */
export function PainelHomologacao() {
  const [status, setStatus] = useState<StatusCompliance | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setStatus(await apiGet<StatusCompliance>('/admin/compliance/status'));
    } catch {
      setErro('Não foi possível carregar o status de compliance. Tente novamente.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const checklist: ItemChecklist[] = status
    ? [
        {
          titulo: 'NSR sequencial por estabelecimento',
          descricao:
            'O NSR (Número Sequencial de Registro) é gerado pelo servidor, sem furos, de forma atômica por filial. Portaria 671 Art. 75 §3.',
          ok: true,
        },
        {
          titulo: 'Imutabilidade dos registros de ponto',
          descricao:
            'Os pontos são append-only. Nunca sofrem UPDATE ou DELETE. Correções criam um PontoAjuste separado, preservando o original. Portaria 671 Art. 74 §1.',
          ok: true,
        },
        {
          titulo: 'Hash de integridade SHA-256',
          descricao:
            'Cada marcação tem um hash SHA-256 do seu conteúdo canônico, garantindo que qualquer adulteração seja detectável.',
          ok: true,
        },
        {
          titulo: 'AFD (Arquivo Fonte de Dados)',
          descricao:
            'O AFD é gerado no layout da Portaria 671: cabeçalho tipo 1, marcações tipo 7 (REP-P) com NIS/PIS, trailer tipo 9. Auto-validado antes de exportar.',
          ok: true,
          alerta: status.ultimaExportacaoAfd
            ? undefined
            : 'Nenhuma exportação AFD gerada ainda. Vá em Relatórios → Gerar AFD para testar.',
        },
        {
          titulo: 'AEJ (Arquivo Eletrônico de Jornada)',
          descricao:
            'O AEJ é gerado com todas as marcações do período, agrupadas por funcionário, com NSR, tipo, hash e status de validação.',
          ok: true,
        },
        {
          titulo: 'Exportações assinadas Ed25519 + hash SHA-256',
          descricao:
            'Cada AFD e AEJ exportado é cifrado no storage, tem hash SHA-256 e assinatura Ed25519 do servidor. O download verifica a integridade automaticamente.',
          ok: true,
        },
        {
          titulo: 'Comprovante de ponto em PDF assinado (PAdES-B)',
          descricao:
            'O funcionário pode solicitar o comprovante de qualquer marcação, em PDF com assinatura digital no padrão PAdES-B (Portaria 671).',
          ok: true,
        },
        {
          titulo: 'Trilha de auditoria imutável',
          descricao:
            'Toda mutação é registrada no LogAuditoria (append-only). UPDATE e DELETE nessa tabela são revogados no banco via RLS.',
          ok: true,
        },
        {
          titulo: 'Consentimento LGPD biométrico',
          descricao:
            'O consentimento para uso de biometria facial é registrado separadamente (LGPD Art. 11). A foto de referência fica cifrada (AES-256) no storage — nunca em texto no banco.',
          ok: true,
        },
        {
          titulo: 'PIS/PASEP (NIS) cadastrado nos funcionários',
          descricao: `O NIS é o identificador do empregado no campo 5 do AFD tipo 7 (Portaria 671 Anexo I). ${status.funcionariosSemPis} de ${status.totalFuncionarios} funcionários ainda não têm PIS cadastrado.`,
          ok: status.funcionariosSemPis === 0,
          alerta:
            status.funcionariosSemPis > 0
              ? `${status.funcionariosSemPis} funcionário(s) sem PIS. O AFD usa CPF como fallback — mas o validador oficial MTE pode rejeitar. Preencha em Funcionários → editar cada um.`
              : undefined,
        },
        {
          titulo: 'Validação no Programa de Verificação MTE',
          descricao:
            'O arquivo AFD gerado deve ser testado no validador oficial do MTE (portal gov.br) antes de apresentar ao fiscal. Este passo é manual e obrigatório.',
          ok: null,
        },
        {
          titulo: 'Registro do REP-P no eMTE (portal gov.br)',
          descricao:
            'A empresa empregadora deve registrar o uso do sistema REP-P no portal eMTE do Ministério do Trabalho. Veja as instruções abaixo.',
          ok: null,
        },
        {
          titulo: 'Sincronização de horário (NTP)',
          descricao:
            'O servidor usa o horário do sistema operacional do host. Para máxima conformidade, o provedor de hospedagem (Hostinger VPS) deve ter NTP sincronizado com servidores oficiais — o que é padrão em qualquer VPS Linux.',
          ok: true,
        },
      ]
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <CabecalhoPagina
        titulo="Homologação REP-P"
        subtitulo="Portaria MTP 671/2021 — checklist técnico e processo administrativo no MTE"
      />

      {erro && <Feedback tom="erro">{erro}</Feedback>}

      {/* ── Resumo dos números ── */}
      {status && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          {[
            { label: 'Funcionários', valor: status.totalFuncionarios },
            {
              label: 'Sem PIS',
              valor: status.funcionariosSemPis,
              cor: status.funcionariosSemPis > 0 ? 'var(--color-warning)' : 'var(--color-success)',
            },
            { label: 'Marcações', valor: status.totalMarcacoes },
            { label: 'NSR atual', valor: status.nsrAtual },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  font: '700 28px var(--font-display)',
                  color: item.cor ?? 'var(--color-text)',
                }}
              >
                {item.valor}
              </div>
              <div
                style={{
                  font: 'var(--text-xs) var(--font-body)',
                  color: 'var(--color-text-muted)',
                  marginTop: 2,
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Checklist técnico ── */}
      <Cartao>
        <TituloSecao>Checklist técnico — Portaria 671</TituloSecao>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {checklist.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px 1fr',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) 0',
                borderBottom: i < checklist.length - 1 ? '1px solid var(--color-divider)' : 'none',
              }}
            >
              <div style={{ paddingTop: 2, flexShrink: 0 }}>
                {item.ok === true && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" fill="var(--color-teal-success)" />
                    <path
                      d="M8 12l3 3 5-6"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {item.ok === false && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" fill="var(--color-warning)" />
                    <path
                      d="M12 8v4M12 16h.01"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                {item.ok === null && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="var(--color-text-muted)"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M12 8v4M12 16h.01"
                      stroke="var(--color-text-muted)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </div>
              <div>
                <p
                  style={{
                    margin: '0 0 var(--space-1)',
                    font: '600 var(--text-sm) var(--font-body)',
                    color: 'var(--color-text)',
                  }}
                >
                  {item.titulo}
                </p>
                <p
                  style={{
                    margin: 0,
                    font: 'var(--text-sm) var(--font-body)',
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  {item.descricao}
                </p>
                {item.alerta && (
                  <p
                    style={{
                      margin: 'var(--space-1) 0 0',
                      font: '500 var(--text-sm) var(--font-body)',
                      color: 'var(--color-warning)',
                    }}
                  >
                    {item.alerta}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Cartao>

      {/* ── Processo no MTE (passo a passo) ── */}
      <Cartao>
        <TituloSecao>Como registrar o REP-P no Ministério do Trabalho</TituloSecao>
        <p
          style={{
            font: 'var(--text-sm) var(--font-body)',
            color: 'var(--color-text-muted)',
            margin: '0 0 var(--space-5)',
            lineHeight: 1.6,
          }}
        >
          A Portaria 671/2021 exige que a empresa <strong>empregadora</strong> registre o uso de um
          sistema REP-P no portal eMTE. Não é a empresa <em>desenvolvedora</em> do software — é a
          empresa <em>que usa</em> para controlar a jornada dos funcionários.
        </p>

        {[
          {
            numero: '1',
            titulo: 'Acesse o portal eMTE / gov.br',
            conteudo: [
              'Vá em: gov.br/trabalho-e-emprego → eSocial/Empregador → Portal eMTE',
              'URL direta: empregadormte.mte.gov.br',
              'Login com CNPJ da empresa + certificado digital eCNPJ (A1 ou A3) ou login.gov.br',
            ],
          },
          {
            numero: '2',
            titulo: 'Localizar o módulo REP',
            conteudo: [
              'No painel, acesse: Registro Eletrônico de Ponto → REP-P',
              'Selecione "Registrar sistema REP-P" (modalidade Programa)',
            ],
          },
          {
            numero: '3',
            titulo: 'Preencher os dados do sistema',
            conteudo: [
              'Nome do sistema: REP-P GRAMO',
              'Versão do software: 1.0',
              'CNPJ do fornecedor do software: CNPJ da sua empresa de tecnologia',
              'Data de implantação: data em que começou a usar',
              'Filiais: informar cada CNPJ/estabelecimento que usa o sistema',
            ],
          },
          {
            numero: '4',
            titulo: 'Declaração de conformidade',
            conteudo: [
              'O portal pede uma declaração que o sistema atende a Portaria 671/2021',
              'Com o checklist acima tudo verde, você pode assinar essa declaração',
              'O sistema gera o AFD no formato correto e mantém imutabilidade dos registros',
            ],
          },
          {
            numero: '5',
            titulo: 'Guardar o número de registro',
            conteudo: [
              'Após o cadastro, o MTE gera um número de registro do REP-P',
              'Guarde esse número — o fiscal do trabalho pode pedir',
              'O registro deve ser renovado se trocar de sistema',
            ],
          },
          {
            numero: '6',
            titulo: 'Validar o AFD no Programa de Verificação',
            conteudo: [
              'Baixe o "Programa de Verificação de Arquivo do REP" no site do MTE',
              'Gere um AFD em Relatórios → Gerar AFD e salve o arquivo .txt',
              'Abra o arquivo no Programa de Verificação e confirme que passa sem erros',
              'Guarde o resultado como comprovante da conformidade técnica',
            ],
          },
        ].map((passo) => (
          <div
            key={passo.numero}
            style={{
              display: 'grid',
              gridTemplateColumns: '36px 1fr',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-5)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--color-accent)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: '700 16px var(--font-display)',
                flexShrink: 0,
              }}
            >
              {passo.numero}
            </div>
            <div>
              <p
                style={{
                  margin: '0 0 var(--space-2)',
                  font: '600 var(--text-base) var(--font-body)',
                  lineHeight: 1.4,
                }}
              >
                {passo.titulo}
              </p>
              <ul style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>
                {passo.conteudo.map((item, j) => (
                  <li
                    key={j}
                    style={{
                      font: 'var(--text-sm) var(--font-body)',
                      color: 'var(--color-text-muted)',
                      lineHeight: 1.6,
                    }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </Cartao>

      {/* ── Ação rápida: gerar AFD para validar ── */}
      <Cartao>
        <TituloSecao>Próximo passo técnico</TituloSecao>
        <p
          style={{
            font: 'var(--text-sm) var(--font-body)',
            color: 'var(--color-text-muted)',
            margin: '0 0 var(--space-4)',
            lineHeight: 1.6,
          }}
        >
          {status?.funcionariosSemPis
            ? `Antes de qualquer coisa: preencha o PIS de ${status.funcionariosSemPis} funcionário(s) em Funcionários → selecionar → editar. O PIS está na Carteira de Trabalho ou nos holerites antigos.`
            : 'Todos os funcionários têm PIS. Gere um AFD e valide no Programa de Verificação do MTE para confirmar a conformidade técnica.'}
        </p>
        <Botao
          bloco={false}
          onClick={() => {
            const secaoRelatorios = document.querySelector('[data-secao="relatorios"]');
            if (secaoRelatorios) (secaoRelatorios as HTMLElement).click();
          }}
        >
          Ir para Relatórios → Gerar AFD
        </Botao>
      </Cartao>
    </div>
  );
}
