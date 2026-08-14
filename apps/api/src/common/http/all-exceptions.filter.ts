import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Filtro global: padroniza TODA resposta de erro em JSON com requestId e nunca
 * vaza stack/detalhe interno ao cliente em producao. Mapeia erros conhecidos do
 * Prisma para status HTTP adequados (ex.: violacao de unicidade -> 409).
 *
 * Regra do projeto: o ponto/assinatura sao imutaveis (REVOKE UPDATE/DELETE no
 * banco); uma tentativa de alteracao chega aqui como erro do Prisma e vira 403.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const requestId = req.id ?? '-';

    const { status, message } = this.mapear(exception);

    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${req.method} ${req.originalUrl} -> ${status}: ${this.detalhe(exception)}`,
      );
    } else {
      this.logger.warn(`[${requestId}] ${req.method} ${req.originalUrl} -> ${status}: ${message}`);
    }

    res.status(status).json({
      statusCode: status,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
  }

  private mapear(e: unknown): { status: number; message: string } {
    if (e instanceof HttpException) {
      const resp = e.getResponse();
      const message =
        typeof resp === 'string'
          ? resp
          : ((resp as { message?: string | string[] }).message ?? e.message);
      return {
        status: e.getStatus(),
        message: Array.isArray(message) ? message.join(' ') : message,
      };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      switch (e.code) {
        case 'P2002':
          return {
            status: HttpStatus.CONFLICT,
            message: 'Registro duplicado (violacao de unicidade).',
          };
        case 'P2025':
          return { status: HttpStatus.NOT_FOUND, message: 'Registro nao encontrado.' };
        default:
          // 42501 = permission denied (RLS/append-only): ponto imutavel, escopo, etc.
          if (this.ehPermissao(e)) {
            return {
              status: HttpStatus.FORBIDDEN,
              message: 'Operacao nao permitida (registro protegido).',
            };
          }
          return { status: HttpStatus.BAD_REQUEST, message: 'Requisicao invalida.' };
      }
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Erro interno.' };
  }

  private ehPermissao(e: Prisma.PrismaClientKnownRequestError): boolean {
    const meta = (e.meta ?? {}) as { code?: string };
    return meta.code === '42501' || /permission denied/i.test(e.message);
  }

  private detalhe(e: unknown): string {
    if (e instanceof Error) return e.stack ?? e.message;
    return String(e);
  }
}
