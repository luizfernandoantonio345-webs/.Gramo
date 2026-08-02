import { Module } from '@nestjs/common';
import { ConfiguracoesController } from './configuracoes.controller';
import { ConfiguracoesService } from './configuracoes.service';

/** ADM 7 -- Configuracoes da Empresa: jornadas e feriados. */
@Module({
  controllers: [ConfiguracoesController],
  providers: [ConfiguracoesService],
})
export class ConfiguracoesModule {}
