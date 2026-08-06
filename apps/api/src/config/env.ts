import { z } from 'zod';

/**
 * Validacao das variaveis de ambiente na inicializacao (fail-fast).
 * Se algo obrigatorio faltar, a API nao sobe -- melhor do que quebrar em runtime.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),
  MIGRATION_DATABASE_URL: z.string().url().optional(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2592000),

  // Chave AES-256 (32 bytes em base64) para dados sensiveis (LGPD/biometria).
  DATA_ENCRYPTION_KEY: z.string().min(32),

  // Seed (32 bytes base64) da chave Ed25519 de assinatura. Opcional: se ausente,
  // e derivada por HKDF de DATA_ENCRYPTION_KEY (separacao de chave).
  ASSINATURA_SEED: z.string().optional(),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./storage'),

  // Dev/demo APENAS: pula o 2FA no login admin/super. Proibido em producao.
  DEV_BYPASS_2FA: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Variaveis de ambiente invalidas:\n${issues}`);
  }

  // FAIL-FAST de seguranca: o bypass de 2FA NUNCA pode subir em producao. Melhor
  // derrubar o boot do que operar com 2FA desligado por engano.
  if (parsed.data.NODE_ENV === 'production' && parsed.data.DEV_BYPASS_2FA === 'true') {
    throw new Error(
      'DEV_BYPASS_2FA=true e PROIBIDO em producao (2FA e obrigatorio). Remova a variavel.',
    );
  }
  // Aviso: em producao sem CORS_ORIGINS, o CORS cross-origin fica negado (ver
  // main.ts). Sinalizamos para evitar "por que o front nao conecta?".
  if (parsed.data.NODE_ENV === 'production' && !config.CORS_ORIGINS) {
    // eslint-disable-next-line no-console
    console.warn(
      '[env] Producao sem CORS_ORIGINS: requisicoes cross-origin serao negadas. Defina o dominio do PWA.',
    );
  }

  return parsed.data;
}
