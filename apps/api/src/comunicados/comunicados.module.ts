import { Module } from '@nestjs/common';
import { AdmComunicadosController, ComunicadosController } from './comunicados.controller';
import { ComunicadosService } from './comunicados.service';

/** ADM 8 -- Comunicados e Notificacoes. */
@Module({
  controllers: [AdmComunicadosController, ComunicadosController],
  providers: [ComunicadosService],
})
export class ComunicadosModule {}
