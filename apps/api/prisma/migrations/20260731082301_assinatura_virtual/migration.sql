-- CreateEnum
CREATE TYPE "TipoDocAssinatura" AS ENUM ('HOLERITE', 'COMUNICADO', 'ADVERTENCIA', 'ACORDO', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusAssinatura" AS ENUM ('ENVIADO', 'VISUALIZADO', 'ASSINADO', 'RECUSADO');

-- CreateEnum
CREATE TYPE "MetodoAssinatura" AS ENUM ('SENHA', 'PIN');

-- CreateTable
CREATE TABLE "documentos_assinatura" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "funcionario_id" UUID NOT NULL,
    "tipo" "TipoDocAssinatura" NOT NULL,
    "titulo" TEXT NOT NULL,
    "competencia" TEXT,
    "arquivo_ref" TEXT NOT NULL,
    "hash_documento" TEXT NOT NULL,
    "mime" TEXT,
    "tamanho_bytes" INTEGER NOT NULL,
    "status" "StatusAssinatura" NOT NULL DEFAULT 'ENVIADO',
    "permite_download_antes" BOOLEAN NOT NULL DEFAULT false,
    "enviado_por_admin_id" UUID NOT NULL,
    "motivo_recusa" TEXT,
    "visualizado_em" TIMESTAMP(3),
    "recusado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_assinatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas_virtuais" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "documento_assinatura_id" UUID NOT NULL,
    "funcionario_id" UUID NOT NULL,
    "hash_documento" TEXT NOT NULL,
    "hash_assinatura" TEXT NOT NULL,
    "assinatura_servidor" TEXT NOT NULL,
    "chave_servidor_id" TEXT NOT NULL,
    "metodo" "MetodoAssinatura" NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "timestamp_assinatura" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assinaturas_virtuais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documentos_assinatura_empresa_id_funcionario_id_idx" ON "documentos_assinatura"("empresa_id", "funcionario_id");

-- CreateIndex
CREATE INDEX "documentos_assinatura_empresa_id_status_idx" ON "documentos_assinatura"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "documentos_assinatura_empresa_id_competencia_idx" ON "documentos_assinatura"("empresa_id", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_virtuais_documento_assinatura_id_key" ON "assinaturas_virtuais"("documento_assinatura_id");

-- CreateIndex
CREATE INDEX "assinaturas_virtuais_empresa_id_funcionario_id_idx" ON "assinaturas_virtuais"("empresa_id", "funcionario_id");

-- AddForeignKey
ALTER TABLE "documentos_assinatura" ADD CONSTRAINT "documentos_assinatura_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_assinatura" ADD CONSTRAINT "documentos_assinatura_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas_virtuais" ADD CONSTRAINT "assinaturas_virtuais_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas_virtuais" ADD CONSTRAINT "assinaturas_virtuais_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas_virtuais" ADD CONSTRAINT "assinaturas_virtuais_documento_assinatura_id_fkey" FOREIGN KEY ("documento_assinatura_id") REFERENCES "documentos_assinatura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
