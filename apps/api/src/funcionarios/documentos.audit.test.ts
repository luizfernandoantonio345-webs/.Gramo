import { describe, expect, it, vi } from 'vitest';
import { TenantContext } from '../common/tenant/tenant-context';
import { DocumentosService } from './documentos.service';

/**
 * D2 (Fase D): toda escrita de negocio deixa trilha de auditoria. O upload de
 * documento (acao do funcionario) passou a registrar LogAuditoria alem de criar
 * a linha de documento -- ambos na MESMA transacao (tudo-ou-nada).
 */
function montar() {
  const criado: { documento?: Record<string, unknown>; audit?: Record<string, unknown> } = {};
  const tx = {
    documento: {
      create: async (a: { data: Record<string, unknown> }) => {
        criado.documento = a.data;
        return { id: 'doc-1', tipo: a.data.tipo, status: a.data.status };
      },
    },
    logAuditoria: {
      create: async (a: { data: Record<string, unknown> }) => {
        criado.audit = a.data;
        return {};
      },
    },
  };
  const prisma = { forTenant: async (cb: (t: typeof tx) => unknown) => cb(tx) };
  const storage = { salvarArquivo: async () => 'documento/2026/ref.enc' };
  const svc = new DocumentosService(prisma as never, storage as never);
  return { svc, criado };
}

describe('DocumentosService.enviar — auditoria (D2)', () => {
  it('cria o documento E registra LogAuditoria do envio (ator = funcionario)', async () => {
    vi.spyOn(TenantContext, 'requireEmpresaId').mockReturnValue('empresa-1');
    const { svc, criado } = montar();

    const doc = await svc.enviar('func-1', {
      tipo: 'RG',
      arquivoBase64: Buffer.from('conteudo-do-arquivo').toString('base64'),
      nomeArquivo: 'rg.pdf',
    } as never);

    expect(doc.id).toBe('doc-1');
    expect(criado.documento).toMatchObject({ funcionarioId: 'func-1', empresaId: 'empresa-1' });
    expect(criado.audit).toMatchObject({
      empresaId: 'empresa-1',
      usuarioId: 'func-1',
      usuarioTipo: 'funcionario',
      acao: 'documento.enviar',
      entidadeAfetada: 'documentos',
      entidadeId: 'doc-1',
    });
  });
});
