import { Module } from '@nestjs/common';
import { IntegracoesController } from './integracoes.controller';
import { IntegracoesService } from './integracoes.service';

/** ADM 9 -- Integracoes (chaves de API, config folha/eSocial). */
@Module({
  controllers: [IntegracoesController],
  providers: [IntegracoesService],
})
export class IntegracoesModule {}
