import { Module } from '@nestjs/common';
import { PontosModule } from '../pontos/pontos.module';
import { AdmKioskController, KioskPontoController } from './kiosk.controller';
import { KioskGuard } from './kiosk.guard';
import { KioskService } from './kiosk.service';

/**
 * Quiosque (tablet na portaria). Reusa o PontoService (PontosModule) para o
 * registro de ponto; autentica o dispositivo por token proprio (KioskGuard).
 */
@Module({
  imports: [PontosModule],
  controllers: [AdmKioskController, KioskPontoController],
  providers: [KioskService, KioskGuard],
})
export class KioskModule {}
