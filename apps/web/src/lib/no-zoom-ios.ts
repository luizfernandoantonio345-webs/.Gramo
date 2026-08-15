/**
 * iOS/Safari: bloqueia o zoom por PINCA (2 dedos).
 *
 * O `touch-action: manipulation` (tokens.css) ja mata o zoom por toque duplo em
 * todos os navegadores. Falta so a pinca no iPhone: o Safari a expoe pelos
 * eventos `gesture*` (nao-padrao) e ignora o `user-scalable=no` do viewport.
 * Cancelar esses eventos remove a pinca sem afetar rolagem de 1 dedo nem
 * cliques. Fora do Safari e um no-op — os eventos simplesmente nao disparam.
 */
export function bloquearZoomPincaIOS(): void {
  const cancelar = (e: Event) => e.preventDefault();
  document.addEventListener('gesturestart', cancelar, { passive: false });
  document.addEventListener('gesturechange', cancelar, { passive: false });
  document.addEventListener('gestureend', cancelar, { passive: false });
}
