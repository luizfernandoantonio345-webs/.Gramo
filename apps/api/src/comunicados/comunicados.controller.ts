import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PapelAdmin, TipoSujeito } from '@prisma/client';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { ComunicadosService } from './comunicados.service';
import { CriarComunicadoDto } from './dto/comunicados.dto';

/** ADM 8 -- Comunicados (admin). */
@ApiTags('adm-comunicados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/comunicados', version: '1' })
export class AdmComunicadosController {
  constructor(private readonly service: ComunicadosService) {}

  @Post()
  @Roles(PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL)
  @ApiOperation({ summary: 'Cria comunicado (com publico-alvo).' })
  criar(@Body() dto: CriarComunicadoDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.criar(dto, user);
  }

  @Get()
  @Roles(PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL, PapelAdmin.AUDITORIA)
  @ApiOperation({ summary: 'Historico de envios + taxa de visualizacao.' })
  historico() {
    return this.service.historico();
  }
}

/** Comunicados do funcionario. */
@ApiTags('comunicados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'comunicados', version: '1' })
export class ComunicadosController {
  constructor(private readonly service: ComunicadosService) {}

  @Get()
  listar(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.paraFuncionario(this.func(user));
  }

  @Post(':id/lido')
  marcarLido(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.marcarLido(this.func(user), id);
  }

  private func(user: UsuarioAutenticado): string {
    if (user.tipo !== TipoSujeito.FUNCIONARIO) throw new ForbiddenException('Apenas funcionarios.');
    return user.sub;
  }
}
