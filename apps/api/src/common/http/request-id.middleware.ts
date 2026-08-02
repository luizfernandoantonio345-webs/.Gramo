import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Anexa um id unico por requisicao (correlacao ponta a ponta nos logs e no
 * cabecalho de resposta). Respeita um `x-request-id` vindo de um proxy/edge.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const id = req.header('x-request-id')?.trim() || randomUUID();
    (req as Request & { id?: string }).id = id;
    res.setHeader('x-request-id', id);
    next();
  }
}
