import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PapelAdmin } from '@prisma/client';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { EmergenciaService } from './emergencia.service';

/**
 * ADM -- Protocolo de seguranca emergencial.
 * Exclusivo para RH_MASTER (acionar) e AUDITORIA (consultar logs).
 */
@ApiTags('emergencia')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'emergencia', version: '1' })
export class EmergenciaController {
  constructor(private readonly service: EmergenciaService) {}

  @Post('protocolo')
  @HttpCode(200)
  @Roles(PapelAdmin.RH_MASTER)
  @ApiOperation({
    summary: 'Protocolo de seguranca emergencial (RH Master).',
    description:
      'Use quando credenciais foram comprometidas ou compartilhadas com terceiros. ' +
      'Revoga TODOS os refresh tokens ativos e marca todos os admins e funcionarios ' +
      'para trocarem a senha no proximo login. Os access tokens ativos expiram em ate 15 min.',
  })
  acionar(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.acionarProtocolo(user);
  }

  @Get('logs-acesso')
  @Roles(PapelAdmin.RH_MASTER, PapelAdmin.AUDITORIA)
  @ApiOperation({
    summary: 'Logs de acesso do periodo (auditoria de acesso externo).',
    description:
      'Retorna ate 1000 registros de log de acesso entre as datas informadas (ISO 8601).',
  })
  @ApiQuery({ name: 'de', example: '2026-08-15T00:00:00Z' })
  @ApiQuery({ name: 'ate', example: '2026-08-20T23:59:59Z' })
  logsAcesso(@Query('de') de: string, @Query('ate') ate: string) {
    const inicio = new Date(de);
    const fim = new Date(ate);
    if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
      throw new BadRequestException('Datas invalidas. Use formato ISO (ex: 2026-08-15T00:00:00Z).');
    }
    return this.service.consultarLogsAcesso(inicio, fim);
  }

  @Get('logs-auditoria')
  @Roles(PapelAdmin.RH_MASTER, PapelAdmin.AUDITORIA)
  @ApiOperation({
    summary: 'Logs de mutacoes do periodo (quem alterou o que).',
    description: 'Retorna ate 500 registros de auditoria de mutacoes entre as datas informadas.',
  })
  @ApiQuery({ name: 'de', example: '2026-08-15T00:00:00Z' })
  @ApiQuery({ name: 'ate', example: '2026-08-20T23:59:59Z' })
  logsAuditoria(@Query('de') de: string, @Query('ate') ate: string) {
    const inicio = new Date(de);
    const fim = new Date(ate);
    if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
      throw new BadRequestException('Datas invalidas. Use formato ISO (ex: 2026-08-15T00:00:00Z).');
    }
    return this.service.consultarLogsAuditoria(inicio, fim);
  }
}
