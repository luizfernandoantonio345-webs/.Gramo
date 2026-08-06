import { describe, expect, it } from 'vitest';
import { validateEnv } from './env';

// Base valida minima (segredos com >=32 chars).
const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  JWT_REFRESH_SECRET: 'y'.repeat(32),
  DATA_ENCRYPTION_KEY: 'z'.repeat(32),
};

describe('validateEnv', () => {
  it('aceita um ambiente de dev valido', () => {
    const env = validateEnv({ ...base, NODE_ENV: 'development' });
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(3000);
  });

  it('REJEITA DEV_BYPASS_2FA=true em producao (fail-fast de seguranca)', () => {
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', DEV_BYPASS_2FA: 'true' }),
    ).toThrowError(/DEV_BYPASS_2FA.*proibido em producao/i);
  });

  it('permite producao sem o bypass', () => {
    const env = validateEnv({ ...base, NODE_ENV: 'production', CORS_ORIGINS: 'https://x' });
    expect(env.NODE_ENV).toBe('production');
  });

  it('falha se faltar segredo obrigatorio', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).toThrowError(/invalidas/i);
  });
});
