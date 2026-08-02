import { describe, expect, it } from 'vitest';
import { TenantContext } from './tenant-context';

describe('TenantContext', () => {
  it('propaga a empresa dentro de run()', () => {
    const dentro = TenantContext.run({ empresaId: 'empresa-1' }, () =>
      TenantContext.requireEmpresaId(),
    );
    expect(dentro).toBe('empresa-1');
  });

  it('nao vaza contexto entre execucoes (isolamento de tenant)', () => {
    TenantContext.run({ empresaId: 'empresa-A' }, () => {
      expect(TenantContext.get()?.empresaId).toBe('empresa-A');
    });
    // Fora de qualquer run(), nao ha contexto.
    expect(TenantContext.get()).toBeUndefined();
  });

  it('requireEmpresaId lanca quando nao ha tenant', () => {
    expect(() => TenantContext.requireEmpresaId()).toThrow(/TenantContext ausente/);
  });

  it('mantem contextos aninhados independentes', () => {
    TenantContext.run({ empresaId: 'externa' }, () => {
      TenantContext.run({ empresaId: 'interna' }, () => {
        expect(TenantContext.requireEmpresaId()).toBe('interna');
      });
      expect(TenantContext.requireEmpresaId()).toBe('externa');
    });
  });
});
