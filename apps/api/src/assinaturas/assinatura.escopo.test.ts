import { PapelAdmin } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { AssinaturaService } from './assinatura.service';

/**
 * S2 (auditoria): as rotas ADM de assinatura devem restringir o GESTOR_FILIAL
 * aos documentos de funcionarios das SUAS filiais (autorizacao intra-tenant),
 * assim como os demais modulos. RH_MASTER ve a empresa inteira.
 *
 * Testamos que o `where` enviado ao Prisma carrega (ou nao) o filtro de filial.
 * `fila`/`detalhe` nao dependem de TenantContext, entao sao isolaveis.
 */

function montarServico(filiaisDoGestor: string[] | null) {
  // Captura o ultimo `where` passado ao Prisma.
  let ultimoWhere: Record<string, unknown> | undefined;
  const tx = {
    documentoAssinatura: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        ultimoWhere = args.where;
        return [];
      },
      findFirst: async (args: { where: Record<string, unknown> }) => {
        ultimoWhere = args.where;
        // detalhe() lanca NotFound se null; retornamos um doc minimo.
        return { id: 'doc-1', funcionario: { nome: 'x', cpf: '000' }, assinatura: null };
      },
    },
  };
  const prisma = { forTenant: async (cb: (t: typeof tx) => unknown) => cb(tx) };
  const escopo = {
    filiaisPermitidas: async (u: UsuarioAutenticado) =>
      u.papel === PapelAdmin.GESTOR_FILIAL ? filiaisDoGestor : null,
  };
  const svc = new AssinaturaService(prisma as never, null as never, null as never, escopo as never);
  return { svc, getWhere: () => ultimoWhere };
}

const gestor: UsuarioAutenticado = {
  sub: 'admin-1',
  papel: PapelAdmin.GESTOR_FILIAL,
} as UsuarioAutenticado;
const rh: UsuarioAutenticado = {
  sub: 'admin-2',
  papel: PapelAdmin.RH_MASTER,
} as UsuarioAutenticado;

describe('AssinaturaService — escopo por filial (S2)', () => {
  it('fila: GESTOR_FILIAL e restringido as suas filiais', async () => {
    const { svc, getWhere } = montarServico(['filial-1', 'filial-2']);
    await svc.fila({} as never, gestor);
    expect(getWhere()).toMatchObject({
      funcionario: { filialId: { in: ['filial-1', 'filial-2'] } },
    });
  });

  it('fila: RH_MASTER ve a empresa inteira (sem filtro de filial)', async () => {
    const { svc, getWhere } = montarServico(null);
    await svc.fila({} as never, rh);
    expect(getWhere()).not.toHaveProperty('funcionario');
  });

  it('detalhe: GESTOR_FILIAL carrega o filtro de filial no where', async () => {
    const { svc, getWhere } = montarServico(['filial-1']);
    await svc.detalhe('doc-1', gestor);
    expect(getWhere()).toMatchObject({
      id: 'doc-1',
      funcionario: { filialId: { in: ['filial-1'] } },
    });
  });

  it('detalhe: RH_MASTER nao aplica filtro de filial', async () => {
    const { svc, getWhere } = montarServico(null);
    await svc.detalhe('doc-1', rh);
    expect(getWhere()).not.toHaveProperty('funcionario');
  });
});
