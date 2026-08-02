-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('RG', 'CPF', 'COMPROVANTE_RESIDENCIA', 'CTPS', 'ASO', 'CONTRATO', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusDocumento" AS ENUM ('PENDENTE', 'EM_ANALISE', 'APROVADO', 'REJEITADO', 'VENCIDO');

-- AlterTable
ALTER TABLE "funcionarios" ADD COLUMN     "salario_base" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "documentos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "funcionario_id" UUID NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "arquivo_ref" TEXT NOT NULL,
    "nome_arquivo" TEXT,
    "mime" TEXT,
    "status" "StatusDocumento" NOT NULL DEFAULT 'EM_ANALISE',
    "motivo_rejeicao" TEXT,
    "data_validade" TIMESTAMP(3),
    "revisado_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documentos_empresa_id_funcionario_id_idx" ON "documentos"("empresa_id", "funcionario_id");

-- CreateIndex
CREATE INDEX "documentos_empresa_id_status_idx" ON "documentos"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "documentos_empresa_id_data_validade_idx" ON "documentos"("empresa_id", "data_validade");

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
