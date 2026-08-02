-- CreateEnum
CREATE TYPE "TipoExportacao" AS ENUM ('AFD', 'AEJ');

-- CreateTable
CREATE TABLE "exportacoes_afd_aej" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "tipo_arquivo" "TipoExportacao" NOT NULL,
    "periodo_referencia" TEXT NOT NULL,
    "data_inicial" TIMESTAMP(3) NOT NULL,
    "data_final" TIMESTAMP(3) NOT NULL,
    "arquivo_ref" TEXT NOT NULL,
    "hash_arquivo" TEXT NOT NULL,
    "assinatura_servidor" TEXT NOT NULL,
    "chave_servidor_id" TEXT NOT NULL,
    "total_registros" INTEGER NOT NULL,
    "gerado_por_admin_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exportacoes_afd_aej_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exportacoes_afd_aej_empresa_id_tipo_arquivo_periodo_referen_idx" ON "exportacoes_afd_aej"("empresa_id", "tipo_arquivo", "periodo_referencia");

-- AddForeignKey
ALTER TABLE "exportacoes_afd_aej" ADD CONSTRAINT "exportacoes_afd_aej_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
