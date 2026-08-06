import { Module } from '@nestjs/common';
import { BancoHorasController } from './banco-horas.controller';
import { BancoHorasService } from './banco-horas.service';

/** Banco de horas (ADM 4). Deps (Prisma/Escopo) vem de modulos globais. */
@Module({
  controllers: [BancoHorasController],
  providers: [BancoHorasService],
  exports: [BancoHorasService],
})
export class BancoHorasModule {}
