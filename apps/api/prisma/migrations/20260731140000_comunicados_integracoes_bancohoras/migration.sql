-- CreateEnum
CREATE TYPE "PublicoComunicado" AS ENUM ('TODOS', 'FILIAL', 'CARGO', 'FUNCIONARIO');

-- CreateEnum
CREATE TYPE "TipoIntegracao" AS ENUM ('FOLHA_PAGAMENTO', 'ESOCIAL');

-- AlterTable
ALTER TABLE "jornadas" ADD COLUMN "carga_diaria_minutos" INTEGER;

-- CreateTable
CREATE TABLE "comunicados" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "publico_tipo" "PublicoComunicado" NOT NULL,
    "publico_valor" TEXT,
    "criado_por_admin_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comunicados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunicados_leitura" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "comunicado_id" UUID NOT NULL,
    "funcionario_id" UUID NOT NULL,
    "lido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comunicados_leitura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chaves_api" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "prefixo" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "escopo" TEXT NOT NULL DEFAULT 'leitura',
    "revogada_em" TIMESTAMP(3),
    "criado_por_admin_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chaves_api_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integracoes_config" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "tipo" "TipoIntegracao" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integracoes_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comunicados_empresa_id_criado_em_idx" ON "comunicados"("empresa_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "comunicados_leitura_comunicado_id_funcionario_id_key" ON "comunicados_leitura"("comunicado_id", "funcionario_id");

-- CreateIndex
CREATE INDEX "comunicados_leitura_empresa_id_idx" ON "comunicados_leitura"("empresa_id");

-- CreateIndex
CREATE INDEX "chaves_api_empresa_id_idx" ON "chaves_api"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "integracoes_config_empresa_id_tipo_key" ON "integracoes_config"("empresa_id", "tipo");

-- AddForeignKey
ALTER TABLE "comunicados" ADD CONSTRAINT "comunicados_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicados_leitura" ADD CONSTRAINT "comunicados_leitura_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicados_leitura" ADD CONSTRAINT "comunicados_leitura_comunicado_id_fkey" FOREIGN KEY ("comunicado_id") REFERENCES "comunicados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicados_leitura" ADD CONSTRAINT "comunicados_leitura_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chaves_api" ADD CONSTRAINT "chaves_api_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integracoes_config" ADD CONSTRAINT "integracoes_config_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
