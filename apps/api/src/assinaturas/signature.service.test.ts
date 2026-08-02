import { randomBytes } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { SignatureService } from './signature.service';

beforeAll(() => {
  // Seed fixo -> chave deterministica (estavel entre reinicios).
  process.env.ASSINATURA_SEED = Buffer.alloc(32, 7).toString('base64');
});

describe('SignatureService (Ed25519)', () => {
  it('deriva a mesma chave para o mesmo seed (deterministica)', () => {
    const a = new SignatureService();
    const b = new SignatureService();
    expect(a.chaveId).toBe(b.chaveId);
    expect(a.publicKeyPem).toBe(b.publicKeyPem);
    expect(a.publicKeyPem).toContain('BEGIN PUBLIC KEY');
  });

  it('assina e verifica um manifesto', () => {
    const svc = new SignatureService();
    const manifesto = JSON.stringify(['repp-assinatura-v1', 'doc-1', 'hash-abc']);
    const assinatura = svc.assinar(manifesto);
    expect(svc.verificar(manifesto, assinatura)).toBe(true);
  });

  it('rejeita manifesto adulterado ou assinatura invalida', () => {
    const svc = new SignatureService();
    const manifesto = JSON.stringify(['repp-assinatura-v1', 'doc-1']);
    const assinatura = svc.assinar(manifesto);
    expect(svc.verificar(JSON.stringify(['repp-assinatura-v1', 'doc-2']), assinatura)).toBe(false);
    expect(svc.verificar(manifesto, Buffer.from('lixo').toString('base64'))).toBe(false);
  });

  it('hashDocumento e SHA-256 hex deterministico', () => {
    const svc = new SignatureService();
    const bytes = randomBytes(64);
    const h = svc.hashDocumento(bytes);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(svc.hashDocumento(bytes)).toBe(h);
  });
});
