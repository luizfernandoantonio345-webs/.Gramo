-- CreateEnum
CREATE TYPE "StatusEmpresa" AS ENUM ('ATIVA', 'SUSPENSA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "PapelAdmin" AS ENUM ('RH_MASTER', 'GESTOR_FILIAL', 'FINANCEIRO', 'AUDITORIA');

-- CreateEnum
CREATE TYPE "StatusFuncionario" AS ENUM ('PENDENTE_CADASTRO', 'ATIVO', 'AFASTADO', 'FERIAS', 'DESLIGADO');

-- CreateEnum
CREATE TYPE "TipoMarcacao" AS ENUM ('ENTRADA', 'INICIO_INTERVALO', 'FIM_INTERVALO', 'SAIDA');

-- CreateEnum
CREATE TYPE "StatusValidacaoPonto" AS ENUM ('VALIDO', 'PENDENTE_REGAP', 'PENDENTE_IDENTIDADE', 'PENDENTE_HORARIO');

-- CreateEnum
CREATE TYPE "OrigemHora" AS ENUM ('SERVIDOR', 'DISPOSITIVO');

-- CreateEnum
CREATE TYPE "TipoSujeito" AS ENUM ('ADMIN', 'FUNCIONARIO', 'SUPER_ADMIN', 'SISTEMA');

-- CreateEnum
CREATE TYPE "EventoAcesso" AS ENUM ('LOGIN_SUCESSO', 'LOGIN_FALHA', 'LOGOUT', 'TWO_FA_SUCESSO', 'TWO_FA_FALHA', 'PRIMEIRO_ACESSO', 'SENHA_REDEFINIDA', 'ACESSO_REVOGADO', 'BLOQUEIO_TENTATIVAS');

-- CreateEnum
CREATE TYPE "TipoExcecao" AS ENUM ('REGAP', 'HORARIO', 'IDENTIDADE', 'ESQUECIDO', 'SAIDA_ANTECIPADA', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusExcecao" AS ENUM ('PENDENTE', 'APROVADA', 'RECUSADA');

-- CreateTable
CREATE TABLE "empresas" (
    "id" UUID NOT NULL,
    "razao_social" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "subdominio" TEXT NOT NULL,
    "plano" TEXT NOT NULL DEFAULT 'piloto',
    "status" "StatusEmpresa" NOT NULL DEFAULT 'ATIVA',
    "data_ativacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filiais" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filiais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_admin" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "papel" "PapelAdmin" NOT NULL,
    "totp_secret" TEXT,
    "totp_ativado" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "tentativas_falhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_ate" TIMESTAMP(3),
    "ultimo_login_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_filial_acesso" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "filial_id" UUID NOT NULL,

    CONSTRAINT "admin_filial_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funcionarios" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "filial_id" UUID,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "cargo" TEXT,
    "jornada_contratual" TEXT,
    "senha_hash" TEXT,
    "status" "StatusFuncionario" NOT NULL DEFAULT 'PENDENTE_CADASTRO',
    "foto_referencia_ref" TEXT,
    "foto_aprovada" BOOLEAN NOT NULL DEFAULT false,
    "tentativas_falhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_ate" TIMESTAMP(3),
    "ultimo_login_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "desativado_em" TIMESTAMP(3),

    CONSTRAINT "funcionarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regap" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "filial_id" UUID,
    "nome" TEXT NOT NULL,
    "latitude_centro" DECIMAL(10,7) NOT NULL,
    "longitude_centro" DECIMAL(10,7) NOT NULL,
    "raio_metros" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contadores_nsr" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "filial_id" UUID NOT NULL,
    "ultimo_nsr" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "contadores_nsr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pontos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "filial_id" UUID,
    "funcionario_id" UUID NOT NULL,
    "nsr" BIGINT NOT NULL,
    "uuid_idempotencia" UUID NOT NULL,
    "tipo" "TipoMarcacao" NOT NULL,
    "registrado_em" TIMESTAMP(3) NOT NULL,
    "origem_hora" "OrigemHora" NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "precisao_metros" INTEGER,
    "dentro_regap" BOOLEAN NOT NULL,
    "status_validacao" "StatusValidacaoPonto" NOT NULL,
    "justificativa" TEXT,
    "foto_captura_ref" TEXT,
    "hash_integridade" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pontos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pontos_ajustes" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "ponto_original_id" UUID NOT NULL,
    "autor_admin_id" UUID NOT NULL,
    "motivo" TEXT NOT NULL,
    "novo_valor" JSONB NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pontos_ajustes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "justificativas_autorizacoes" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "funcionario_id" UUID NOT NULL,
    "ponto_id" UUID NOT NULL,
    "tipo" "TipoExcecao" NOT NULL,
    "motivo" TEXT,
    "status" "StatusExcecao" NOT NULL DEFAULT 'PENDENTE',
    "aprovador_id" UUID,
    "motivo_resposta" TEXT,
    "data_resposta" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "justificativas_autorizacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimentos_lgpd" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "funcionario_id" UUID NOT NULL,
    "finalidade" TEXT NOT NULL,
    "versao_termo" TEXT NOT NULL,
    "concedido" BOOLEAN NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "registrado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimentos_lgpd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID,
    "usuario_tipo" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade_afetada" TEXT NOT NULL,
    "entidade_id" UUID,
    "valor_anterior" JSONB,
    "valor_novo" JSONB,
    "ip" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convites" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "funcionario_id" UUID NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),
    "criado_por_admin_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "sujeito_id" UUID NOT NULL,
    "sujeito_tipo" "TipoSujeito" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "revogado_em" TIMESTAMP(3),
    "ip" TEXT,
    "user_agent" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_acesso" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "sujeito_id" UUID,
    "sujeito_tipo" "TipoSujeito" NOT NULL,
    "identificador" TEXT,
    "evento" "EventoAcesso" NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_recuperacao" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "sujeito_id" UUID NOT NULL,
    "sujeito_tipo" "TipoSujeito" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_recuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_subdominio_key" ON "empresas"("subdominio");

-- CreateIndex
CREATE INDEX "filiais_empresa_id_idx" ON "filiais"("empresa_id");

-- CreateIndex
CREATE INDEX "usuarios_admin_empresa_id_idx" ON "usuarios_admin"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_admin_empresa_id_email_key" ON "usuarios_admin"("empresa_id", "email");

-- CreateIndex
CREATE INDEX "admin_filial_acesso_empresa_id_idx" ON "admin_filial_acesso"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_filial_acesso_admin_id_filial_id_key" ON "admin_filial_acesso"("admin_id", "filial_id");

-- CreateIndex
CREATE INDEX "funcionarios_empresa_id_status_idx" ON "funcionarios"("empresa_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "funcionarios_empresa_id_cpf_key" ON "funcionarios"("empresa_id", "cpf");

-- CreateIndex
CREATE INDEX "regap_empresa_id_idx" ON "regap"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "contadores_nsr_filial_id_key" ON "contadores_nsr"("filial_id");

-- CreateIndex
CREATE INDEX "contadores_nsr_empresa_id_idx" ON "contadores_nsr"("empresa_id");

-- CreateIndex
CREATE INDEX "pontos_empresa_id_funcionario_id_registrado_em_idx" ON "pontos"("empresa_id", "funcionario_id", "registrado_em");

-- CreateIndex
CREATE INDEX "pontos_empresa_id_status_validacao_idx" ON "pontos"("empresa_id", "status_validacao");

-- CreateIndex
CREATE UNIQUE INDEX "pontos_filial_id_nsr_key" ON "pontos"("filial_id", "nsr");

-- CreateIndex
CREATE UNIQUE INDEX "pontos_empresa_id_uuid_idempotencia_key" ON "pontos"("empresa_id", "uuid_idempotencia");

-- CreateIndex
CREATE INDEX "pontos_ajustes_empresa_id_ponto_original_id_idx" ON "pontos_ajustes"("empresa_id", "ponto_original_id");

-- CreateIndex
CREATE INDEX "justificativas_autorizacoes_empresa_id_status_idx" ON "justificativas_autorizacoes"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "justificativas_autorizacoes_empresa_id_funcionario_id_idx" ON "justificativas_autorizacoes"("empresa_id", "funcionario_id");

-- CreateIndex
CREATE INDEX "consentimentos_lgpd_empresa_id_funcionario_id_finalidade_idx" ON "consentimentos_lgpd"("empresa_id", "funcionario_id", "finalidade");

-- CreateIndex
CREATE INDEX "logs_auditoria_empresa_id_timestamp_idx" ON "logs_auditoria"("empresa_id", "timestamp");

-- CreateIndex
CREATE INDEX "logs_auditoria_empresa_id_entidade_afetada_entidade_id_idx" ON "logs_auditoria"("empresa_id", "entidade_afetada", "entidade_id");

-- CreateIndex
CREATE INDEX "convites_empresa_id_funcionario_id_idx" ON "convites"("empresa_id", "funcionario_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_empresa_id_sujeito_id_sujeito_tipo_idx" ON "refresh_tokens"("empresa_id", "sujeito_id", "sujeito_tipo");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "logs_acesso_empresa_id_timestamp_idx" ON "logs_acesso"("empresa_id", "timestamp");

-- CreateIndex
CREATE INDEX "logs_acesso_empresa_id_sujeito_id_idx" ON "logs_acesso"("empresa_id", "sujeito_id");

-- CreateIndex
CREATE INDEX "tokens_recuperacao_empresa_id_sujeito_id_idx" ON "tokens_recuperacao"("empresa_id", "sujeito_id");

-- AddForeignKey
ALTER TABLE "filiais" ADD CONSTRAINT "filiais_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_admin" ADD CONSTRAINT "usuarios_admin_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_filial_acesso" ADD CONSTRAINT "admin_filial_acesso_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_filial_acesso" ADD CONSTRAINT "admin_filial_acesso_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "usuarios_admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_filial_acesso" ADD CONSTRAINT "admin_filial_acesso_filial_id_fkey" FOREIGN KEY ("filial_id") REFERENCES "filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_filial_id_fkey" FOREIGN KEY ("filial_id") REFERENCES "filiais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regap" ADD CONSTRAINT "regap_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regap" ADD CONSTRAINT "regap_filial_id_fkey" FOREIGN KEY ("filial_id") REFERENCES "filiais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contadores_nsr" ADD CONSTRAINT "contadores_nsr_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contadores_nsr" ADD CONSTRAINT "contadores_nsr_filial_id_fkey" FOREIGN KEY ("filial_id") REFERENCES "filiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pontos" ADD CONSTRAINT "pontos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pontos" ADD CONSTRAINT "pontos_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pontos_ajustes" ADD CONSTRAINT "pontos_ajustes_ponto_original_id_fkey" FOREIGN KEY ("ponto_original_id") REFERENCES "pontos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificativas_autorizacoes" ADD CONSTRAINT "justificativas_autorizacoes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificativas_autorizacoes" ADD CONSTRAINT "justificativas_autorizacoes_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificativas_autorizacoes" ADD CONSTRAINT "justificativas_autorizacoes_ponto_id_fkey" FOREIGN KEY ("ponto_id") REFERENCES "pontos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimentos_lgpd" ADD CONSTRAINT "consentimentos_lgpd_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimentos_lgpd" ADD CONSTRAINT "consentimentos_lgpd_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convites" ADD CONSTRAINT "convites_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convites" ADD CONSTRAINT "convites_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convites" ADD CONSTRAINT "convites_criado_por_admin_id_fkey" FOREIGN KEY ("criado_por_admin_id") REFERENCES "usuarios_admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_acesso" ADD CONSTRAINT "logs_acesso_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_recuperacao" ADD CONSTRAINT "tokens_recuperacao_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
