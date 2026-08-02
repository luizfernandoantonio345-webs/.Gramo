import { Module } from '@nestjs/common';
import { AdmContestacaoController, ContestacaoController } from './contestacao.controller';
import { ContestacaoService } from './contestacao.service';
import { AdmFeriasController, FeriasController } from './ferias.controller';
import { FeriasService } from './ferias.service';

/** ADM 10 (Ferias/Afastamentos) + ADM 11 (Contestacao de ponto). */
@Module({
  controllers: [FeriasController, AdmFeriasController, ContestacaoController, AdmContestacaoController],
  providers: [FeriasService, ContestacaoService],
})
export class AusenciasModule {}
