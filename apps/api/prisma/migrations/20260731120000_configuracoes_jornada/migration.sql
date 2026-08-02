-- CreateEnum
CREATE TYPE "TipoFeriado" AS ENUM ('NACIONAL', 'ESTADUAL', 'MUNICIPAL', 'FACULTATIVO');

-- CreateTable
CREATE TABLE "jornadas" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "hora_entrada" TEXT NOT NULL,
    "hora_saida" TEXT NOT NULL,
    "tolerancia_minutos" INTEGER NOT NULL DEFAULT 10,
    "dias_semana" INTEGER[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jornadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feriados" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "filial_id" UUID,
    "data" DATE NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoFeriado" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feriados_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "funcionarios" ADD COLUMN "jornada_id" UUID;

-- CreateIndex
CREATE INDEX "jornadas_empresa_id_idx" ON "jornadas"("empresa_id");

-- CreateIndex
CREATE INDEX "feriados_empresa_id_data_idx" ON "feriados"("empresa_id", "data");

-- AddForeignKey
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "jornadas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jornadas" ADD CONSTRAINT "jornadas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feriados" ADD CONSTRAINT "feriados_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feriados" ADD CONSTRAINT "feriados_filial_id_fkey" FOREIGN KEY ("filial_id") REFERENCES "filiais"("id") ON DELETE SET NULL ON UPDATE CASCADE;
