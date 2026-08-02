/**
 * Politica de bloqueio por tentativas (Tela 1): bloqueia apos 5 tentativas
 * erradas por 15 minutos.
 *
 * Funcoes PURAS (sem I/O, sem Date.now interno): recebem `agora` como parametro
 * para serem deterministicas e testaveis. O estado (tentativasFalhas,
 * bloqueadoAte) e persistido no proprio sujeito (funcionario/admin).
 */

export const MAX_TENTATIVAS = 5;
export const JANELA_BLOQUEIO_MS = 15 * 60 * 1000; // 15 minutos

export interface EstadoLockout {
  tentativasFalhas: number;
  bloqueadoAte: Date | null;
}

/** O sujeito esta bloqueado agora? */
export function estaBloqueado(estado: EstadoLockout, agora: Date): boolean {
  return estado.bloqueadoAte !== null && estado.bloqueadoAte.getTime() > agora.getTime();
}

/**
 * Novo estado apos uma tentativa FALHA. Ao atingir MAX_TENTATIVAS, define
 * `bloqueadoAte = agora + 15min` e zera o contador (proximo ciclo recomeca).
 */
export function registrarFalha(estado: EstadoLockout, agora: Date): EstadoLockout {
  const tentativas = estado.tentativasFalhas + 1;
  if (tentativas >= MAX_TENTATIVAS) {
    return { tentativasFalhas: 0, bloqueadoAte: new Date(agora.getTime() + JANELA_BLOQUEIO_MS) };
  }
  return { tentativasFalhas: tentativas, bloqueadoAte: null };
}

/** Estado apos um login BEM-SUCEDIDO: zera tudo. */
export function registrarSucesso(): EstadoLockout {
  return { tentativasFalhas: 0, bloqueadoAte: null };
}

/** Minutos restantes de bloqueio (arredondado para cima), 0 se liberado. */
export function minutosRestantes(estado: EstadoLockout, agora: Date): number {
  if (!estaBloqueado(estado, agora)) return 0;
  const restanteMs = estado.bloqueadoAte!.getTime() - agora.getTime();
  return Math.ceil(restanteMs / 60000);
}
