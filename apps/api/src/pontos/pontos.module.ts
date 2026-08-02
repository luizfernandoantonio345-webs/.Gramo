import { Module } from '@nestjs/common';
import { GestaoPontoController, RegapController } from './gestao-ponto.controller';
import { GestaoPontoService } from './gestao-ponto.service';
import { NsrService } from './nsr.service';
import { PontoController } from './ponto.controller';
import { PontoService } from './ponto.service';

/**
 * Fase 2 -- Ponto. Registro (Tela 3), sync offline, e Gestao de Ponto (ADM 4).
 * StorageService/guards vem de modulos globais (StorageModule/SecurityModule).
 */
@Module({
  controllers: [PontoController, GestaoPontoController, RegapController],
  providers: [PontoService, NsrService, GestaoPontoService],
})
export class PontosModule {}
