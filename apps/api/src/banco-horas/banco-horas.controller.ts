import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PapelAdmin } from '@prisma/client';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { BancoHorasService } from './banco-horas.service';
import { RegistrarAjusteDto } from './dto/banco-horas.dto';

/** ADM 4 -- Banco de horas (regimes configuraveis + ajustes/compensacoes). */
@ApiTags('adm-banco-horas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/banco-horas', version: '1' })
export class BancoHorasController {
  constructor(private readonly service: BancoHorasService) {}

  // Declarado ANTES de ':funcionarioId' para nao ser capturado pela rota de param.
  @Get('apuracao')
  @Roles(
    PapelAdmin.RH_MASTER,
    PapelAdmin.GESTOR_FILIAL,
    PapelAdmin.FINANCEIRO,
    PapelAdmin.AUDITORIA,
  )
  @ApiOperation({
    summary:
      'Apuracao valorada da competencia (horas normais/extras + adicionais) por funcionario.',
  })
  apuracao(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('inicio') inicio: string,
    @Query('fim') fim: string,
    @Query('percentualExtra') percentualExtra?: string,
    @Query('percentualPericulosidade') percentualPericulosidade?: string,
    @Query('percentualNoturno') percentualNoturno?: string,
    @Query('divisorMensal') divisorMensal?: string,
    @Query('valorHoraPadrao') valorHoraPadrao?: string,
  ) {
    const num = (s?: string) => (s === undefined || s === '' ? undefined : Number(s));
    return this.service.apuracaoPeriodo(user, {
      inicioIso: inicio,
      fimIso: fim,
      percentualExtra: num(percentualExtra),
      percentualPericulosidade: num(percentualPericulosidade),
      percentualNoturno: num(percentualNoturno),
      divisorMensal: num(divisorMensal),
      valorHoraPadrao: num(valorHoraPadrao),
    });
  }

  @Get(':funcionarioId')
  @Roles(PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL, PapelAdmin.AUDITORIA)
  @ApiOperation({ summary: 'Saldo consolidado do banco de horas conforme o regime da jornada.' })
  consolidado(
    @Param('funcionarioId') funcionarioId: string,
    @Query('inicio') inicio: string,
    @Query('fim') fim: string,
    @Query('competencia') competencia: string | undefined,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.consolidado(funcionarioId, inicio, fim, user, competencia);
  }

  @Post('ajuste')
  @Roles(PapelAdmin.RH_MASTER)
  @ApiOperation({ summary: 'Lanca ajuste/compensacao no banco de horas (append-only).' })
  ajuste(@Body() dto: RegistrarAjusteDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.registrarAjuste(dto, user);
  }
}
