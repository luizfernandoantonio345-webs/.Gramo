/**
 * Deteccao de tipo de arquivo por "magic bytes" (assinatura no inicio do
 * conteudo). Serve para conferir o conteudo REAL contra o MIME declarado no
 * upload -- um cliente pode mentir o `mime`, mas nao o cabecalho do arquivo.
 *
 * Cobre apenas os formatos aceitos pelo produto (PDF/JPG/PNG). Puro e sem deps
 * para rodar igual no backend e no PWA.
 */
export type TipoArquivoDetectado = 'application/pdf' | 'image/jpeg' | 'image/png' | null;

/** Retorna o MIME detectado pelos primeiros bytes, ou null se nao reconhecido. */
export function detectarTipoArquivo(bytes: Uint8Array): TipoArquivoDetectado {
  // PDF: "%PDF-"
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'application/pdf';
  }
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  return null;
}

/**
 * True se o conteudo (magic bytes) corresponde ao MIME declarado. Usar no upload
 * para rejeitar arquivo cujo cabecalho nao bate com o formato informado.
 */
export function conteudoBateComMime(bytes: Uint8Array, mimeDeclarado: string): boolean {
  const real = detectarTipoArquivo(bytes);
  return real !== null && real === mimeDeclarado;
}
