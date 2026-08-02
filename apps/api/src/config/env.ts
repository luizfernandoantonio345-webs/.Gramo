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
  return parsed.data;
}
