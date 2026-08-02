import { describe, expect, it } from 'vitest';
import { diasParaVencer, documentoVencido, venceEmBreve } from './documentos';

const hoje = new Date('2026-07-30T12:00:00.000Z');

describe('documentos - vencimento', () => {
  it('sem validade nunca vence', () => {
    expect(documentoVencido(null, hoje)).toBe(false);
    expect(venceEmBreve(null, hoje)).toBe(false);
  });

  it('detecta documento vencido', () => {
    expect(documentoVencido(new Date('2026-07-29T12:00:00Z'), hoje)).toBe(true);
    expect(documentoVencido(new Date('2026-07-31T12:00:00Z'), hoje)).toBe(false);
  });

  it('venceEmBreve dentro da janela de 30 dias', () => {
    expect(venceEmBreve(new Date('2026-08-10T12:00:00Z'), hoje)).toBe(true); // ~11 dias
    expect(venceEmBreve(new Date('2026-09-30T12:00:00Z'), hoje)).toBe(false); // >30 dias
    expect(venceEmBreve(new Date('2026-07-01T12:00:00Z'), hoje)).toBe(false); // ja venceu
  });

  it('diasParaVencer calcula corretamente', () => {
    expect(diasParaVencer(new Date('2026-08-01T12:00:00Z'), hoje)).toBe(2);
    expect(diasParaVencer(null, hoje)).toBeNull();
  });
});
