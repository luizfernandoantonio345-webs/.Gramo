import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PapelAdmin } from '@prisma/client';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { AuditoriaService } from './auditoria.service';
import { AuditoriaQuery } from './dto/auditoria.dto';

/** ADM 6 -- Relatorios e Auditoria (RH Master e Auditoria; somente leitura). */
@ApiTags('adm-auditoria')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelAdmin.RH_MASTER, PapelAdmin.AUDITORIA)
@Controller({ path: 'admin/auditoria', version: '1' })
export class AuditoriaController {
  constructor(private readonly service: AuditoriaService) {}

  @Get()
  @ApiOperation({ summary: 'Trilha de auditoria (acoes) filtravel e paginada.' })
  trilha(@Query() q: AuditoriaQuery) {
    return this.service.trilha(q);
  }

  @Get('acessos')
  @ApiOperation({ summary: 'Log de acessos (login/2FA/logout).' })
  acessos(@Query() q: AuditoriaQuery) {
    return this.service.acessos(q);
  }

  @Get('aprovacoes')
  @ApiOperation({ summary: 'Excecoes decididas (aprovadas/recusadas) com justificativas.' })
  aprovacoes() {
    return this.service.aprovacoes();
  }
}
