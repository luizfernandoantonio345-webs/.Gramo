import { randomBytes } from 'node:crypto';

/**
 * Gera segredos fortes para producao e imprime um bloco pronto para colar no .env.
 * Uso: node scripts/gerar-segredos.mjs
 * NUNCA versione o .env resultante.
 */
const b64url = (n) => randomBytes(n).toString('base64url');
const b64 = (n) => randomBytes(n).toString('base64');
const senha = (n = 24) => randomBytes(n).toString('base64url').slice(0, n);

const ownerPass = senha();
const appPass = senha();
const superPass = senha();
const db = 'repp';

const bloco = `# ===== Gerado por scripts/gerar-segredos.mjs em ${new Date().toISOString()} =====
NODE_ENV=production
API_PORT=3000
WEB_PORT=8080

# Banco (3 roles)
POSTGRES_USER=repp_owner
POSTGRES_PASSWORD=${ownerPass}
POSTGRES_APP_PASSWORD=${appPass}
POSTGRES_SUPER_PASSWORD=${superPass}
POSTGRES_DB=${db}
POSTGRES_PORT=5432
DATABASE_URL=postgresql://repp_app:${appPass}@postgres:5432/${db}?schema=public
SUPER_DATABASE_URL=postgresql://repp_super:${superPass}@postgres:5432/${db}?schema=public
MIGRATION_DATABASE_URL=postgresql://repp_owner:${ownerPass}@postgres:5432/${db}?schema=public

# Autenticacao / cripto
JWT_ACCESS_SECRET=${b64url(48)}
JWT_REFRESH_SECRET=${b64url(48)}
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=2592000
DATA_ENCRYPTION_KEY=${b64(32)}
ASSINATURA_SEED=${b64(32)}

# Super Admin inicial (troque a senha no 1o acesso + configure 2FA)
SUPER_ADMIN_EMAIL=admin@suaempresa.com
SUPER_ADMIN_SENHA=${senha(16)}

# CORS (dominio do PWA) e e-mail (preencha quando tiver)
CORS_ORIGINS=https://app.suaempresa.com
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=no-reply@suaempresa.com

# Certificado ICP-Brasil (preencha com scripts/preparar-certificado.mjs)
# ASSINATURA_P12_BASE64=
# ASSINATURA_P12_SENHA=

# Storage (em producao, migrar para S3-compat)
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=./storage
`;

console.log(bloco);
console.error('\n>> Copie o bloco acima para um arquivo .env (NAO versione). Guarde a SUPER_ADMIN_SENHA.');
