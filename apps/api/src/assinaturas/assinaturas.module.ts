import { Module } from '@nestjs/common';
import { AdmAssinaturaController } from './adm-assinatura.controller';
import { AssinaturaController } from './assinatura.controller';
import { AssinaturaService } from './assinatura.service';

/** Fase 4 -- Folha e assinatura virtual: Tela 2 + ADM 3.
 * SignatureService vem do SecurityModule (global). */
@Module({
  controllers: [AssinaturaController, AdmAssinaturaController],
  providers: [AssinaturaService],
})
export class AssinaturasModule {}
