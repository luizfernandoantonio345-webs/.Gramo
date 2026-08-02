import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PapelAdmin } from '@prisma/client';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { GerarFechamentoDto } from './dto/fechamento.dto';
import { FechamentoService } from './fechamento.service';

/**
 * ADM 4 -- Fechamento mensal do ponto. Gera o espelho da competencia como
 * documento assinavel; o funcionario assina pelo fluxo de assinaturas (Tela 2).
 */
@ApiTags('adm-fechamento')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/fechamentos', version: '1' })
export class FechamentoController {
  constructor(private readonly service: FechamentoService) {}

  @Post()
  @Roles(PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL)
  @ApiOperation({ summary: 'Gera o espelho de ponto (PDF) da competencia para assinatura.' })
  gerar(@Body() dto: GerarFechamentoDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.gerar(dto.funcionarioId, dto.competencia, user);
  }
}
