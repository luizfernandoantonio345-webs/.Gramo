import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PapelAdmin, StatusAusencia, TipoSujeito } from '@prisma/client';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { CalendarioQuery, DecidirFeriasDto, SolicitarFeriasDto } from './dto/ausencias.dto';
import { FeriasService } from './ferias.service';

const LEITURA = [PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL, PapelAdmin.AUDITORIA] as const;
const ESCRITA = [PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL] as const;

/** Funcionario -- solicitar/consultar ferias e afastamentos. */
@ApiTags('ferias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'ferias', version: '1' })
export class FeriasController {
  constructor(private readonly service: FeriasService) {}

  @Post()
  @ApiOperation({ summary: 'Solicita ferias/afastamento.' })
  solicitar(@Body() dto: SolicitarFeriasDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.solicitar(this.func(user), dto);
  }

  @Get()
  minhas(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.minhas(this.func(user));
  }

  private func(user: UsuarioAutenticado): string {
    if (user.tipo !== TipoSujeito.FUNCIONARIO) throw new ForbiddenException('Apenas funcionarios.');
    return user.sub;
  }
}

/** ADM 10 -- Ferias e Afastamentos. */
@ApiTags('adm-ferias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/ferias', version: '1' })
export class AdmFeriasController {
  constructor(private readonly service: FeriasService) {}

  @Get()
  @Roles(...LEITURA)
  @ApiOperation({ summary: 'Lista solicitacoes (filtro por status; escopo por filial).' })
  listar(
    @Query('status') status: StatusAusencia | undefined,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.listar(user, status);
  }

  @Get('calendario')
  @Roles(...LEITURA)
  @ApiOperation({ summary: 'Ausencias aprovadas no periodo (calendario).' })
  calendario(@Query() q: CalendarioQuery, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.calendario(q.de, q.ate, user);
  }

  @Post(':id/decidir')
  @Roles(...ESCRITA)
  @ApiOperation({ summary: 'Aprova/recusa uma solicitacao.' })
  decidir(
    @Param('id') id: string,
    @Body() dto: DecidirFeriasDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.decidir(id, dto, user);
  }
}
