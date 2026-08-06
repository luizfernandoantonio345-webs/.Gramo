import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PapelAdmin } from '@prisma/client';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { EspelhoPdfDto } from './dto/relatorio.dto';
import { RelatorioService } from './relatorio.service';

const RELATORIOS = [PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL, PapelAdmin.FINANCEIRO] as const;

/** Relatorios gerenciais em PDF (.GRAMO). */
@ApiTags('adm-relatorios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/relatorios', version: '1' })
export class RelatorioController {
  constructor(private readonly service: RelatorioService) {}

  @Post('espelho-pdf/:funcionarioId')
  @Roles(...RELATORIOS)
  @ApiOperation({ summary: 'Espelho de ponto (gerencial) em PDF com a marca .GRAMO.' })
  espelhoPdf(
    @Param('funcionarioId') funcionarioId: string,
    @Body() dto: EspelhoPdfDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.espelhoPdf(funcionarioId, dto.inicio, dto.fim, user, dto.competencia);
  }
}
