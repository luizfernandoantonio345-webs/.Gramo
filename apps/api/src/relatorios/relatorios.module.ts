import { Module } from '@nestjs/common';
import { BancoHorasModule } from '../banco-horas/banco-horas.module';
import { RelatorioController } from './relatorio.controller';
import { RelatorioService } from './relatorio.service';

/** Relatorios gerenciais em PDF (.GRAMO). Reusa o BancoHorasService. */
@Module({
  imports: [BancoHorasModule],
  controllers: [RelatorioController],
  providers: [RelatorioService],
})
export class RelatoriosModule {}
