import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter';

function hostFake() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const req = { id: 'req-1', method: 'POST', originalUrl: '/api/v1/x' };
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => req }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filtro = new AllExceptionsFilter();

  it('preserva status e mensagem de HttpException', () => {
    const { host, status, json } = hostFake();
    filtro.catch(new ConflictException('duplicado'), host);
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0]).toMatchObject({ statusCode: 409, message: 'duplicado', requestId: 'req-1' });
  });

  it('junta array de mensagens (ValidationPipe) em uma string', () => {
    const { host, json } = hostFake();
    filtro.catch(new BadRequestException({ message: ['a', 'b'] }), host);
    expect(json.mock.calls[0][0].message).toBe('a b');
  });

  it('mapeia unicidade do Prisma (P2002) para 409', () => {
    const { host, status } = hostFake();
    const e = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' });
    filtro.catch(e, host);
    expect(status).toHaveBeenCalledWith(409);
  });

  it('mapeia permission denied (42501 / append-only) para 403', () => {
    const { host, status } = hostFake();
    const e = new Prisma.PrismaClientKnownRequestError('permission denied for table pontos', {
      code: 'P2010',
      clientVersion: 'x',
      meta: { code: '42501' },
    });
    filtro.catch(e, host);
    expect(status).toHaveBeenCalledWith(403);
  });

  it('nao vaza detalhe de erro desconhecido (500 generico)', () => {
    const { host, status, json } = hostFake();
    filtro.catch(new Error('segredo interno com stack'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0].message).toBe('Erro interno.');
  });
});
