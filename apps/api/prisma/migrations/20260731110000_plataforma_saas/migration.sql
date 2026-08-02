-- CreateEnum
CREATE TYPE "StatusFatura" AS ENUM ('PENDENTE', 'PAGA', 'CANCELADA');

-- CreateTable
CREATE TABLE "planos" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "preco_mensal_centavos" INTEGER NOT NULL,
    "limite_funcionarios" INTEGER,
    "limite_armazenamento_mb" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "super_admins" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "totp_secret" TEXT,
    "totp_ativado" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "tentativas_falhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_ate" TIMESTAMP(3),
    "ultimo_login_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "super_refresh_tokens" (
    "id" UUID NOT NULL,
    "super_admin_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "revogado_em" TIMESTAMP(3),
    "ip" TEXT,
    "user_agent" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faturas" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "competencia" TEXT NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "status" "StatusFatura" NOT NULL DEFAULT 'PENDENTE',
    "vencimento" TIMESTAMP(3) NOT NULL,
    "gateway_ref" TEXT,
    "pago_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_super_admin" (
    "id" UUID NOT NULL,
    "super_admin_id" UUID,
    "acao" TEXT NOT NULL,
    "entidade_afetada" TEXT NOT NULL,
    "entidade_id" UUID,
    "valor_novo" JSONB,
    "ip" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_super_admin_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "empresas" ADD COLUMN "plano_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "planos_nome_key" ON "planos"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_email_key" ON "super_admins"("email");

-- CreateIndex
CREATE INDEX "super_refresh_tokens_token_hash_idx" ON "super_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "faturas_empresa_id_competencia_idx" ON "faturas"("empresa_id", "competencia");

-- CreateIndex
CREATE INDEX "logs_super_admin_timestamp_idx" ON "logs_super_admin"("timestamp");

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "planos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
