import { Module } from '@nestjs/common';
import { BancoHorasModule } from '../banco-horas/banco-horas.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/** ADM 5 -- Dashboard Geral. */
@Module({
  imports: [BancoHorasModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
