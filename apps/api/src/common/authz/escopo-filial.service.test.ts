import { PapelAdmin } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { EscopoFilialService } from './escopo-filial.service';

// restringe() e puro (nao usa Prisma); instanciamos com um stub.
const svc = new EscopoFilialService(null as never);

describe('EscopoFilialService.restringe', () => {
  it('restringe apenas o GESTOR_FILIAL', () => {
    expect(svc.restringe(PapelAdmin.GESTOR_FILIAL)).toBe(true);
    expect(svc.restringe(PapelAdmin.RH_MASTER)).toBe(false);
    expect(svc.restringe(PapelAdmin.FINANCEIRO)).toBe(false);
    expect(svc.restringe(PapelAdmin.AUDITORIA)).toBe(false);
    expect(svc.restringe(undefined)).toBe(false);
    expect(svc.restringe(null)).toBe(false);
  });
});
