import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PapelAdmin, TipoIntegracao } from '@prisma/client';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { AtualizarIntegracaoDto, GerarChaveDto } from './dto/integracoes.dto';
import { IntegracoesService } from './integracoes.service';

/** ADM 9 -- Integracoes (chaves de API e configuracao). Somente RH Master. */
@ApiTags('adm-integracoes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelAdmin.RH_MASTER)
@Controller({ path: 'admin/integracoes', version: '1' })
export class IntegracoesController {
  constructor(private readonly service: IntegracoesService) {}

  @Post('chaves')
  @ApiOperation({ summary: 'Gera chave de API (token exibido uma unica vez).' })
  gerarChave(@Body() dto: GerarChaveDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.gerarChave(dto, user);
  }

  @Get('chaves')
  listarChaves() {
    return this.service.listarChaves();
  }

  @Post('chaves/:id/revogar')
  revogarChave(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.revogarChave(id, user);
  }

  @Get('config')
  listarConfig() {
    return this.service.listarConfig();
  }

  @Post('config/:tipo')
  @ApiOperation({ summary: 'Configura integracao (FOLHA_PAGAMENTO | ESOCIAL).' })
  atualizarConfig(
    @Param('tipo') tipo: TipoIntegracao,
    @Body() dto: AtualizarIntegracaoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.atualizarConfig(tipo, dto, user);
  }
}
