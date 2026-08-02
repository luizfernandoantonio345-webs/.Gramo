import { Module } from '@nestjs/common';
import { FechamentoController } from './fechamento.controller';
import { FechamentoService } from './fechamento.service';

/**
 * Fechamento mensal (ADM 4). Deps (Prisma/Storage/Signature/Escopo) vem de
 * modulos globais (PrismaModule/StorageModule/SecurityModule).
 */
@Module({
  controllers: [FechamentoController],
  providers: [FechamentoService],
})
export class FechamentoModule {}
