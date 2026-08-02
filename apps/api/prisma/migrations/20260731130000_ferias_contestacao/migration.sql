-- CreateEnum
CREATE TYPE "TipoAusencia" AS ENUM ('FERIAS', 'AFASTAMENTO', 'LICENCA', 'ATESTADO', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusAusencia" AS ENUM ('PENDENTE', 'APROVADA', 'RECUSADA');

-- CreateEnum
CREATE TYPE "StatusContestacao" AS ENUM ('ABERTA', 'RESPONDIDA');

-- CreateTable
CREATE TABLE "ferias_afastamentos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "funcionario_id" UUID NOT NULL,
    "tipo" "TipoAusencia" NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "motivo" TEXT,
    "status" "StatusAusencia" NOT NULL DEFAULT 'PENDENTE',
    "aprovador_id" UUID,
    "motivo_resposta" TEXT,
    "data_resposta" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ferias_afastamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contestacoes_ponto" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "funcionario_id" UUID NOT NULL,
    "ponto_id" UUID NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" "StatusContestacao" NOT NULL DEFAULT 'ABERTA',
    "resposta" TEXT,
    "respondido_por_id" UUID,
    "data_resposta" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contestacoes_ponto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ferias_afastamentos_empresa_id_status_idx" ON "ferias_afastamentos"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "ferias_afastamentos_empresa_id_funcionario_id_idx" ON "ferias_afastamentos"("empresa_id", "funcionario_id");

-- CreateIndex
CREATE INDEX "contestacoes_ponto_empresa_id_status_idx" ON "contestacoes_ponto"("empresa_id", "status");

-- AddForeignKey
ALTER TABLE "ferias_afastamentos" ADD CONSTRAINT "ferias_afastamentos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ferias_afastamentos" ADD CONSTRAINT "ferias_afastamentos_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes_ponto" ADD CONSTRAINT "contestacoes_ponto_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes_ponto" ADD CONSTRAINT "contestacoes_ponto_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes_ponto" ADD CONSTRAINT "contestacoes_ponto_ponto_id_fkey" FOREIGN KEY ("ponto_id") REFERENCES "pontos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
