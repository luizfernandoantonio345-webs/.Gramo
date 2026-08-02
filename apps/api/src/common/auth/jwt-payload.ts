import type { PapelAdmin, TipoSujeito } from '@prisma/client';

/** Conteudo do access token (JWT). Vinculado sempre a uma empresa. */
export interface JwtPayload {
  /** Id do sujeito (admin ou funcionario). */
  sub: string;
  tipo: TipoSujeito;
  empresaId: string;
  /** Papel do admin; ausente para funcionario. */
  papel?: PapelAdmin;
}

/** Usuario autenticado anexado a request. */
export type UsuarioAutenticado = JwtPayload;
