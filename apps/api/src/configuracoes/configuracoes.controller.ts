import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PapelAdmin } from '@prisma/client';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { ConfiguracoesService } from './configuracoes.service';
import {
  AtualizarEmpresaDto,
  AtualizarJornadaDto,
  CriarFeriadoDto,
  CriarFilialDto,
  CriarJornadaDto,
} from './dto/configuracoes.dto';

const LEITURA = [PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL, PapelAdmin.AUDITORIA] as const;

/** ADM 7 -- Configuracoes da Empresa (jornadas, feriados). Escrita: RH Master. */
@ApiTags('adm-configuracoes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/configuracoes', version: '1' })
export class ConfiguracoesController {
  constructor(private readonly service: ConfiguracoesService) {}

  @Get('empresa')
  @Roles(...LEITURA)
  dadosEmpresa() {
    return this.service.dadosEmpresa();
  }

  @Patch('empresa')
  @Roles(PapelAdmin.RH_MASTER)
  @ApiOperation({ summary: 'Atualiza dados da empresa (ex: numero INPI para REP-P).' })
  atualizarEmpresa(@Body() dto: AtualizarEmpresaDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.atualizarEmpresa(dto, user);
  }

  @Get('filiais')
  @Roles(...LEITURA)
  listarFiliais() {
    return this.service.listarFiliais();
  }

  @Post('filiais')
  @Roles(PapelAdmin.RH_MASTER)
  @ApiOperation({ summary: 'Cria filial (estabelecimento com contador de NSR proprio).' })
  criarFilial(@Body() dto: CriarFilialDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.criarFilial(dto, user);
  }

  @Get('jornadas')
  @Roles(...LEITURA)
  listarJornadas() {
    return this.service.listarJornadas();
  }

  @Post('jornadas')
  @Roles(PapelAdmin.RH_MASTER)
  @ApiOperation({ summary: 'Cria jornada padrao (horario, tolerancia, dias).' })
  criarJornada(@Body() dto: CriarJornadaDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.criarJornada(dto, user);
  }

  @Patch('jornadas/:id')
  @Roles(PapelAdmin.RH_MASTER)
  atualizarJornada(
    @Param('id') id: string,
    @Body() dto: AtualizarJornadaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.atualizarJornada(id, dto, user);
  }

  @Get('feriados')
  @Roles(...LEITURA)
  listarFeriados() {
    return this.service.listarFeriados();
  }

  @Post('feriados')
  @Roles(PapelAdmin.RH_MASTER)
  @ApiOperation({ summary: 'Cadastra feriado / ponto facultativo.' })
  criarFeriado(@Body() dto: CriarFeriadoDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.criarFeriado(dto, user);
  }

  @Delete('feriados/:id')
  @Roles(PapelAdmin.RH_MASTER)
  removerFeriado(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.removerFeriado(id, user);
  }
}
