import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PapelAdmin } from '@prisma/client';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { DashboardService } from './dashboard.service';

/** ADM 5 -- Dashboard Geral (executivo). */
@ApiTags('adm-dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL, PapelAdmin.FINANCEIRO, PapelAdmin.AUDITORIA)
@Controller({ path: 'admin/dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Indicadores consolidados, alertas e presenca (7 dias).' })
  geral(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.geral(user);
  }

  @Get('presenca')
  @ApiOperation({ summary: 'Presenca em tempo real: quem esta trabalhando agora (por filial).' })
  presenca(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.presencaAgora(user);
  }
}
