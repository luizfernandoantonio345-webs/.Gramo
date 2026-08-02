import { MetodoAssinatura, TipoDocAssinatura } from './enums';

/**
 * Manifesto canonico de uma assinatura virtual. E o conteudo exato que:
 *  - tem seu SHA-256 gravado como `hashAssinatura`, e
 *  - e assinado pela chave Ed25519 do servidor (`assinaturaServidor`).
 *
 * A ordem e o formato sao FIXOS e versionados: mudar aqui invalida a
 * verificacao de assinaturas antigas. Reproduzir este manifesto (mesmos campos)
 * permite verificar a integridade do documento e a autoria a qualquer momento.
 */
export interface ManifestoAssinatura {
  empresaId: string;
  documentoId: string;
  funcionarioId: string;
  cpf: string;
  tipo: TipoDocAssinatura;
  titulo: string;
  competencia: string | null;
  /** SHA-256 (hex) dos bytes exatos do documento assinado. */
  hashDocumento: string;
  metodo: MetodoAssinatura;
  /** ISO 8601 UTC -- hora oficial do servidor no ato da assinatura. */
  timestamp: string;
  ip: string | null;
  userAgent: string | null;
}

export const VERSAO_MANIFESTO_ASSINATURA = 'repp-assinatura-v1';

export function montarManifestoAssinatura(m: ManifestoAssinatura): string {
  return JSON.stringify([
    VERSAO_MANIFESTO_ASSINATURA,
    m.empresaId,
    m.documentoId,
    m.funcionarioId,
    m.cpf,
    m.tipo,
    m.titulo,
    m.competencia ?? null,
    m.hashDocumento,
    m.metodo,
    m.timestamp,
    m.ip ?? null,
    m.userAgent ?? null,
  ]);
}

/** Competencia no formato "YYYY-MM" (ex.: holerite de 2026-07). */
export function isCompetenciaValida(competencia: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(competencia);
}
