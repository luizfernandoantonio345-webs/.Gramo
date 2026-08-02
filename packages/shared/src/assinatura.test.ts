import { describe, expect, it } from 'vitest';
import { MetodoAssinatura, TipoDocAssinatura } from './enums';
import {
  isCompetenciaValida,
  montarManifestoAssinatura,
  type ManifestoAssinatura,
} from './assinatura';

const base: ManifestoAssinatura = {
  empresaId: 'emp-1',
  documentoId: 'doc-1',
  funcionarioId: 'func-1',
  cpf: '52998224725',
  tipo: TipoDocAssinatura.HOLERITE,
  titulo: 'Holerite 07/2026',
  competencia: '2026-07',
  hashDocumento: 'abc123',
  metodo: MetodoAssinatura.SENHA,
  timestamp: '2026-07-31T12:00:00.000Z',
  ip: '1.2.3.4',
  userAgent: 'jest',
};

describe('montarManifestoAssinatura', () => {
  it('e deterministico para o mesmo conteudo', () => {
    expect(montarManifestoAssinatura(base)).toBe(montarManifestoAssinatura({ ...base }));
  });

  it('muda se o hash do documento mudar (deteccao de adulteracao)', () => {
    const original = montarManifestoAssinatura(base);
    expect(montarManifestoAssinatura({ ...base, hashDocumento: 'outro' })).not.toBe(original);
    expect(montarManifestoAssinatura({ ...base, timestamp: '2026-07-31T12:00:01.000Z' })).not.toBe(
      original,
    );
  });
});

describe('isCompetenciaValida', () => {
  it('aceita YYYY-MM valido', () => {
    expect(isCompetenciaValida('2026-07')).toBe(true);
    expect(isCompetenciaValida('2026-12')).toBe(true);
  });
  it('rejeita formatos invalidos', () => {
    expect(isCompetenciaValida('2026-13')).toBe(false);
    expect(isCompetenciaValida('2026-00')).toBe(false);
    expect(isCompetenciaValida('26-07')).toBe(false);
    expect(isCompetenciaValida('2026/07')).toBe(false);
  });
});
