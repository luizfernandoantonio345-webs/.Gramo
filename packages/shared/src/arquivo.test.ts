import { describe, expect, it } from 'vitest';
import { conteudoBateComMime, detectarTipoArquivo } from './arquivo';

const PDF = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EXE = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]); // MZ (executavel)

describe('detectarTipoArquivo', () => {
  it('reconhece PDF, JPEG e PNG pelos magic bytes', () => {
    expect(detectarTipoArquivo(PDF)).toBe('application/pdf');
    expect(detectarTipoArquivo(JPEG)).toBe('image/jpeg');
    expect(detectarTipoArquivo(PNG)).toBe('image/png');
  });

  it('retorna null para formato nao reconhecido ou vazio', () => {
    expect(detectarTipoArquivo(EXE)).toBeNull();
    expect(detectarTipoArquivo(Uint8Array.from([]))).toBeNull();
    expect(detectarTipoArquivo(Uint8Array.from([0x25, 0x50]))).toBeNull(); // PDF truncado
  });
});

describe('conteudoBateComMime', () => {
  it('aceita quando o conteudo bate com o MIME declarado', () => {
    expect(conteudoBateComMime(PDF, 'application/pdf')).toBe(true);
    expect(conteudoBateComMime(PNG, 'image/png')).toBe(true);
  });

  it('rejeita quando o cliente mente o MIME (ex.: .exe declarado como PDF)', () => {
    expect(conteudoBateComMime(EXE, 'application/pdf')).toBe(false);
    expect(conteudoBateComMime(PNG, 'application/pdf')).toBe(false);
    expect(conteudoBateComMime(JPEG, 'image/png')).toBe(false);
  });
});
