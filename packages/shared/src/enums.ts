/**
 * Enums de dominio compartilhados entre back e front.
 *
 * Padrao "const object + union type" (em vez de `enum` do TS) de proposito:
 * os valores string sao ESTRUTURALMENTE compativeis com os enums gerados pelo
 * Prisma (que sao unioes de string literais). Assim, um valor vindo do banco
 * (`$Enums.TipoMarcacao`) e aceito onde estas funcoes puras esperam o tipo, e
 * vice-versa -- sem casts. Os valores string sao persistidos: NUNCA renomear
 * sem migration. Devem espelhar os enums do schema.prisma.
 */

export const TipoMarcacao = {
  ENTRADA: 'ENTRADA',
  INICIO_INTERVALO: 'INICIO_INTERVALO',
  FIM_INTERVALO: 'FIM_INTERVALO',
  SAIDA: 'SAIDA',
} as const;
export type TipoMarcacao = (typeof TipoMarcacao)[keyof typeof TipoMarcacao];

/**
 * REGRA INEGOCIAVEL: o botao NUNCA bloqueia. Todo registro e ACEITO; o status
 * apenas sinaliza o que o RH precisa validar depois (ADM 4).
 */
export const StatusValidacaoPonto = {
  VALIDO: 'VALIDO',
  PENDENTE_REGAP: 'PENDENTE_REGAP',
  PENDENTE_IDENTIDADE: 'PENDENTE_IDENTIDADE',
  PENDENTE_HORARIO: 'PENDENTE_HORARIO',
} as const;
export type StatusValidacaoPonto = (typeof StatusValidacaoPonto)[keyof typeof StatusValidacaoPonto];

/** Origem da hora gravada. Servidor quando online; dispositivo apenas offline. */
export const OrigemHora = {
  SERVIDOR: 'SERVIDOR',
  DISPOSITIVO: 'DISPOSITIVO',
} as const;
export type OrigemHora = (typeof OrigemHora)[keyof typeof OrigemHora];

/** Papeis administrativos (ADM 1). Auditoria = somente leitura. */
export const PapelAdmin = {
  RH_MASTER: 'RH_MASTER',
  GESTOR_FILIAL: 'GESTOR_FILIAL',
  FINANCEIRO: 'FINANCEIRO',
  AUDITORIA: 'AUDITORIA',
} as const;
export type PapelAdmin = (typeof PapelAdmin)[keyof typeof PapelAdmin];

/** Status comercial da empresa-cliente (Super Admin / ADM 0). */
export const StatusEmpresa = {
  ATIVA: 'ATIVA',
  SUSPENSA: 'SUSPENSA',
  CANCELADA: 'CANCELADA',
} as const;
export type StatusEmpresa = (typeof StatusEmpresa)[keyof typeof StatusEmpresa];

/** Status do vinculo do funcionario -- reflete no controle de ponto. */
export const StatusFuncionario = {
  PENDENTE_CADASTRO: 'PENDENTE_CADASTRO',
  ATIVO: 'ATIVO',
  AFASTADO: 'AFASTADO',
  FERIAS: 'FERIAS',
  DESLIGADO: 'DESLIGADO',
} as const;
export type StatusFuncionario = (typeof StatusFuncionario)[keyof typeof StatusFuncionario];

/** Tipo de sujeito autenticado (para logs e tokens). */
export const TipoSujeito = {
  ADMIN: 'ADMIN',
  FUNCIONARIO: 'FUNCIONARIO',
  SUPER_ADMIN: 'SUPER_ADMIN',
  SISTEMA: 'SISTEMA',
} as const;
export type TipoSujeito = (typeof TipoSujeito)[keyof typeof TipoSujeito];

/** Motivo pelo qual um ponto entrou na fila de excecoes (ADM 4). */
export const TipoExcecao = {
  REGAP: 'REGAP',
  HORARIO: 'HORARIO',
  IDENTIDADE: 'IDENTIDADE',
  ESQUECIDO: 'ESQUECIDO',
  SAIDA_ANTECIPADA: 'SAIDA_ANTECIPADA',
  OUTRO: 'OUTRO',
} as const;
export type TipoExcecao = (typeof TipoExcecao)[keyof typeof TipoExcecao];

/** Situacao da validacao de uma excecao pelo RH. */
export const StatusExcecao = {
  PENDENTE: 'PENDENTE',
  APROVADA: 'APROVADA',
  RECUSADA: 'RECUSADA',
} as const;
export type StatusExcecao = (typeof StatusExcecao)[keyof typeof StatusExcecao];

/** Tipos de documento do funcionario (Tela 4 / ADM 2). */
export const TipoDocumento = {
  RG: 'RG',
  CPF: 'CPF',
  COMPROVANTE_RESIDENCIA: 'COMPROVANTE_RESIDENCIA',
  CTPS: 'CTPS',
  ASO: 'ASO',
  CONTRATO: 'CONTRATO',
  OUTRO: 'OUTRO',
} as const;
export type TipoDocumento = (typeof TipoDocumento)[keyof typeof TipoDocumento];

/** Situacao de um documento enviado. */
export const StatusDocumento = {
  PENDENTE: 'PENDENTE',
  EM_ANALISE: 'EM_ANALISE',
  APROVADO: 'APROVADO',
  REJEITADO: 'REJEITADO',
  VENCIDO: 'VENCIDO',
} as const;
export type StatusDocumento = (typeof StatusDocumento)[keyof typeof StatusDocumento];

/** Tipo de documento enviado para assinatura (ADM 3 / Tela 2). */
export const TipoDocAssinatura = {
  HOLERITE: 'HOLERITE',
  COMUNICADO: 'COMUNICADO',
  ADVERTENCIA: 'ADVERTENCIA',
  ACORDO: 'ACORDO',
  OUTRO: 'OUTRO',
} as const;
export type TipoDocAssinatura = (typeof TipoDocAssinatura)[keyof typeof TipoDocAssinatura];

/** Fluxo de status de um documento para assinatura. */
export const StatusAssinatura = {
  ENVIADO: 'ENVIADO',
  VISUALIZADO: 'VISUALIZADO',
  ASSINADO: 'ASSINADO',
  RECUSADO: 'RECUSADO',
} as const;
export type StatusAssinatura = (typeof StatusAssinatura)[keyof typeof StatusAssinatura];

/** Metodo usado no ato da assinatura (prova de intencao/identidade). */
export const MetodoAssinatura = {
  SENHA: 'SENHA',
  PIN: 'PIN',
} as const;
export type MetodoAssinatura = (typeof MetodoAssinatura)[keyof typeof MetodoAssinatura];

/** Tipo de arquivo de exportacao legal (Portaria 671). */
export const TipoExportacao = {
  AFD: 'AFD',
  AEJ: 'AEJ',
} as const;
export type TipoExportacao = (typeof TipoExportacao)[keyof typeof TipoExportacao];

/** Situacao de uma fatura (faturamento SaaS - ADM 0). */
export const StatusFatura = {
  PENDENTE: 'PENDENTE',
  PAGA: 'PAGA',
  CANCELADA: 'CANCELADA',
} as const;
export type StatusFatura = (typeof StatusFatura)[keyof typeof StatusFatura];

/** Tipo de ausencia (ADM 10 - Ferias e Afastamentos). */
export const TipoAusencia = {
  FERIAS: 'FERIAS',
  AFASTAMENTO: 'AFASTAMENTO',
  LICENCA: 'LICENCA',
  ATESTADO: 'ATESTADO',
  OUTRO: 'OUTRO',
} as const;
export type TipoAusencia = (typeof TipoAusencia)[keyof typeof TipoAusencia];

/** Situacao de uma solicitacao de ausencia. */
export const StatusAusencia = {
  PENDENTE: 'PENDENTE',
  APROVADA: 'APROVADA',
  RECUSADA: 'RECUSADA',
} as const;
export type StatusAusencia = (typeof StatusAusencia)[keyof typeof StatusAusencia];

/** Situacao de uma contestacao de ponto (ADM 11). */
export const StatusContestacao = {
  ABERTA: 'ABERTA',
  RESPONDIDA: 'RESPONDIDA',
} as const;
export type StatusContestacao = (typeof StatusContestacao)[keyof typeof StatusContestacao];

/** Eventos do log de acessos (ADM 1). */
export const EventoAcesso = {
  LOGIN_SUCESSO: 'LOGIN_SUCESSO',
  LOGIN_FALHA: 'LOGIN_FALHA',
  LOGOUT: 'LOGOUT',
  TWO_FA_SUCESSO: 'TWO_FA_SUCESSO',
  TWO_FA_FALHA: 'TWO_FA_FALHA',
  PRIMEIRO_ACESSO: 'PRIMEIRO_ACESSO',
  SENHA_REDEFINIDA: 'SENHA_REDEFINIDA',
  ACESSO_REVOGADO: 'ACESSO_REVOGADO',
  BLOQUEIO_TENTATIVAS: 'BLOQUEIO_TENTATIVAS',
} as const;
export type EventoAcesso = (typeof EventoAcesso)[keyof typeof EventoAcesso];
