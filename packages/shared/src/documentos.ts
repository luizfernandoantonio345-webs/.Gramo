import { TipoDocumento } from './enums';

/**
 * Regras de documentacao do funcionario (Tela 4 / ADM 2). Puras e compartilhadas.
 */

/** Documentos obrigatorios no cadastro (Detalhamento de Telas, Tela 4). */
export const DOCUMENTOS_EXIGIDOS: readonly TipoDocumento[] = [
  TipoDocumento.RG,
  TipoDocumento.CPF,
  TipoDocumento.COMPROVANTE_RESIDENCIA,
  TipoDocumento.CTPS,
  TipoDocumento.ASO,
  TipoDocumento.CONTRATO,
] as const;

/** Rotulo amigavel de cada tipo. */
export function rotuloDocumento(tipo: TipoDocumento): string {
  const mapa: Record<TipoDocumento, string> = {
    RG: 'RG',
    CPF: 'CPF',
    COMPROVANTE_RESIDENCIA: 'Comprovante de residencia',
    CTPS: 'Carteira de trabalho (CTPS)',
    ASO: 'ASO (exame admissional)',
    CONTRATO: 'Contrato de trabalho',
    OUTRO: 'Outro',
  };
  return mapa[tipo];
}

/** Um documento com data de validade esta vencido em relacao a `agora`? */
export function documentoVencido(dataValidade: Date | null, agora: Date): boolean {
  if (!dataValidade) return false;
  return dataValidade.getTime() < agora.getTime();
}

/** Faltam quantos dias para vencer (negativo se ja venceu; null se sem validade). */
export function diasParaVencer(dataValidade: Date | null, agora: Date): number | null {
  if (!dataValidade) return null;
  const ms = dataValidade.getTime() - agora.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/** Vence nos proximos `janelaDias` dias (e ainda nao venceu)? (alertas ADM 2) */
export function venceEmBreve(dataValidade: Date | null, agora: Date, janelaDias = 30): boolean {
  const dias = diasParaVencer(dataValidade, agora);
  return dias !== null && dias >= 0 && dias <= janelaDias;
}
