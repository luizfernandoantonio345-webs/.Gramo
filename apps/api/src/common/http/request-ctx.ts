import type { Request } from 'express';

/** Extrai IP e User-Agent da requisicao para o log de acessos/auditoria. */
export function extrairCtx(req: Request): { ip?: string; userAgent?: string } {
  const fwd = req.header('x-forwarded-for');
  const ip = (fwd ? fwd.split(',')[0]?.trim() : req.ip) || undefined;
  return { ip, userAgent: req.header('user-agent') || undefined };
}
