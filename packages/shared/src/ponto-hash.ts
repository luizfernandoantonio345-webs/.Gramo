import { OrigemHora, TipoMarcacao } from './enums';

/**
 * Conteudo canonico de um registro de ponto, base do hash de integridade
 * (SHA-256) exigido pela Portaria 671. Ordem e formato FIXOS -- qualquer
 * mudanca aqui invalida hashes existentes, entao trate como contrato estavel.
 *
 * O hash em si (crypto) e calculado no backend; esta funcao apenas monta a
 * string canonica, para ser identica onde quer que seja verificada.
 */
export interface ConteudoPonto {
  empresaId: string;
  funcionarioId: string;
  nsr: number | string; // BigInt serializado como string
  tipo: TipoMarcacao;
  registradoEm: string; // ISO 8601 UTC
  origemHora: OrigemHora;
  latitude: number | null;
  longitude: number | null;
  dentroRegap: boolean;
  uuidIdempotencia: string;
}

export function montarConteudoCanonicoPonto(p: ConteudoPonto): string {
  // JSON com chaves em ordem explicita e determinista.
  return JSON.stringify([
    'repp-ponto-v1',
    p.empresaId,
    p.funcionarioId,
    String(p.nsr),
    p.tipo,
    p.registradoEm,
    p.origemHora,
    p.latitude ?? null,
    p.longitude ?? null,
    p.dentroRegap,
    p.uuidIdempotencia,
  ]);
}
