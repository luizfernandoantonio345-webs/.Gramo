import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { KioskService } from './kiosk.service';

function montar(funcionario: { id: string; nome: string; desativadoEm: Date | null } | null) {
  const tx = {
    funcionario: { findFirst: vi.fn(async () => funcionario) },
    dispositivoKiosk: { update: vi.fn(async () => ({})) },
  };
  const prisma = { forTenant: async (cb: (t: typeof tx) => unknown) => cb(tx) };
  const registrar = vi.fn(async (id: string) => ({
    id: 'ponto-1',
    nsr: 42,
    funcionarioId: id,
    statusValidacao: 'VALIDO',
  }));
  const ponto = { registrar };
  const svc = new KioskService(prisma as never, ponto as never);
  return { svc, tx, registrar };
}

const disp = { id: 'kiosk-1', filialId: 'filial-1' };

describe('KioskService.baterPonto', () => {
  it('resolve o CPF na filial do dispositivo e reusa o PontoService (nunca duplica logica)', async () => {
    const { svc, tx, registrar } = montar({ id: 'func-9', nome: 'Ana', desativadoEm: null });
    const r = await svc.baterPonto(disp, {
      cpf: '529.982.247-25',
      uuidIdempotencia: '10000000-0000-4000-8000-000000000001',
    } as never);

    // CPF normalizado (so digitos) + escopo pela filial do dispositivo.
    expect(tx.funcionario.findFirst).toHaveBeenCalledWith({
      where: { cpf: '52998224725', filialId: 'filial-1' },
      select: { id: true, nome: true, desativadoEm: true },
    });
    expect(registrar).toHaveBeenCalledWith('func-9', expect.objectContaining({ tipo: undefined }));
    expect(r).toMatchObject({ funcionario: 'Ana', nsr: 42 });
    expect(tx.dispositivoKiosk.update).toHaveBeenCalled(); // marca ultimo uso
  });

  it('CPF desconhecido na unidade -> erro claro (nao bloqueia ponto, e identidade)', async () => {
    const { svc, registrar } = montar(null);
    await expect(
      svc.baterPonto(disp, { cpf: '52998224725', uuidIdempotencia: 'x' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(registrar).not.toHaveBeenCalled();
  });

  it('funcionario desligado (soft-delete) nao registra pelo quiosque', async () => {
    const { svc, registrar } = montar({ id: 'f', nome: 'X', desativadoEm: new Date() });
    await expect(
      svc.baterPonto(disp, { cpf: '52998224725', uuidIdempotencia: 'x' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(registrar).not.toHaveBeenCalled();
  });
});
