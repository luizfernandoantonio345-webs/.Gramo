import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PapelAdmin, StatusContestacao, TipoSujeito } from '@prisma/client';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { ContestacaoService } from './contestacao.service';
import { AbrirContestacaoDto, ResponderContestacaoDto } from './dto/ausencias.dto';

const LEITURA = [PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL, PapelAdmin.AUDITORIA] as const;
const ESCRITA = [PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL] as const;

/** Funcionario -- contestar uma marcacao propria. */
@ApiTags('contestacoes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'contestacoes', version: '1' })
export class ContestacaoController {
  constructor(private readonly service: ContestacaoService) {}

  @Post()
  @ApiOperation({ summary: 'Abre contestacao de uma marcacao propria.' })
  abrir(@Body() dto: AbrirContestacaoDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.abrir(this.func(user), dto);
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

/** ADM 11 -- Central de Contestacao de Ponto. */
@ApiTags('adm-contestacoes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/contestacoes', version: '1' })
export class AdmContestacaoController {
  constructor(private readonly service: ContestacaoService) {}

  @Get()
  @Roles(...LEITURA)
  listar(@Query('status') status: StatusContestacao | undefined, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.listar(user, status);
  }

  @Post(':id/responder')
  @Roles(...ESCRITA)
  @ApiOperation({ summary: 'Responde a contestacao (justificativa obrigatoria).' })
  responder(
    @Param('id') id: string,
    @Body() dto: ResponderContestacaoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.responder(id, dto, user);
  }
}
