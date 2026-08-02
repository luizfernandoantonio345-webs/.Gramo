import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PapelAdmin } from '@prisma/client';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import {
  AjusteManualDto,
  AtualizarRegapDto,
  CriarRegapDto,
  DecidirExcecaoDto,
  EspelhoQueryDto,
} from './dto/gestao.dto';
import { GestaoPontoService } from './gestao-ponto.service';

const LEITURA = [PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL, PapelAdmin.AUDITORIA] as const;
const ESCRITA = [PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL] as const;

/** ADM 4 -- Gestao de Ponto. */
@ApiTags('adm-pontos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/pontos', version: '1' })
export class GestaoPontoController {
  constructor(private readonly service: GestaoPontoService) {}

  @Get('dashboard')
  @Roles(...LEITURA)
  @ApiOperation({ summary: 'Indicadores do dia (presentes, fora da REGAP, pendencias).' })
  dashboard(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.dashboardDia(user);
  }

  @Get('excecoes')
  @Roles(...LEITURA)
  @ApiOperation({ summary: 'Fila de excecoes pendentes de validacao.' })
  excecoes(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.filaExcecoes(user);
  }

  @Post('excecoes/:id/decidir')
  @Roles(...ESCRITA)
  @ApiOperation({ summary: 'Aprova/recusa uma excecao (motivo obrigatorio).' })
  decidir(
    @Param('id') id: string,
    @Body() dto: DecidirExcecaoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.decidirExcecao(id, dto, user);
  }

  @Post(':id/ajuste')
  @Roles(...ESCRITA)
  @ApiOperation({ summary: 'Ajuste manual do ponto (cria registro, nao sobrescreve).' })
  ajuste(
    @Param('id') id: string,
    @Body() dto: AjusteManualDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.ajusteManual(id, dto, user);
  }

  @Get('espelho')
  @Roles(...LEITURA)
  @ApiOperation({ summary: 'Espelho de ponto por funcionario/periodo (escopo por filial).' })
  espelho(@Query() q: EspelhoQueryDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.espelho(q.funcionarioId, q.inicio, q.fim, user);
  }

  @Get('banco-horas')
  @Roles(...LEITURA)
  @ApiOperation({ summary: 'Banco de horas por funcionario/periodo (saldo vs jornada).' })
  bancoHoras(@Query() q: EspelhoQueryDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.bancoHoras(q.funcionarioId, q.inicio, q.fim, user);
  }
}

/** ADM 4 -- Gestao de REGAP (areas autorizadas). */
@ApiTags('adm-regap')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/regaps', version: '1' })
export class RegapController {
  constructor(private readonly service: GestaoPontoService) {}

  @Get()
  @Roles(...LEITURA)
  listar() {
    return this.service.listarRegaps();
  }

  @Post()
  @Roles(...ESCRITA)
  criar(@Body() dto: CriarRegapDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.criarRegap(dto, user);
  }

  @Patch(':id')
  @Roles(...ESCRITA)
  atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarRegapDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.atualizarRegap(id, dto, user);
  }
}
