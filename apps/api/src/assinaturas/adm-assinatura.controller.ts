import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PapelAdmin } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { extrairCtx } from '../common/http/request-ctx';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { AssinaturaService } from './assinatura.service';
import { EnviarAssinaturaDto, EnviarLoteDto, FilaAssinaturaQuery } from './dto/assinatura.dto';

const LEITURA = [
  PapelAdmin.RH_MASTER,
  PapelAdmin.GESTOR_FILIAL,
  PapelAdmin.FINANCEIRO,
  PapelAdmin.AUDITORIA,
] as const;
const ESCRITA = [PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL, PapelAdmin.FINANCEIRO] as const;

/** ADM 3 -- Painel de Assinaturas Virtuais. */
@ApiTags('adm-assinaturas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/assinaturas', version: '1' })
export class AdmAssinaturaController {
  constructor(private readonly service: AssinaturaService) {}

  @Post()
  @Roles(...ESCRITA)
  @ApiOperation({ summary: 'Envia um documento para assinatura.' })
  enviar(@Body() dto: EnviarAssinaturaDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.enviar(dto, user);
  }

  @Post('lote')
  @Roles(...ESCRITA)
  @ApiOperation({ summary: 'Envio em massa (ex.: holerites do mes).' })
  enviarLote(@Body() dto: EnviarLoteDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.enviarLote(dto.itens, user);
  }

  @Get()
  @Roles(...LEITURA)
  @ApiOperation({ summary: 'Fila de status (enviado/visualizado/assinado/recusado).' })
  fila(@Query() q: FilaAssinaturaQuery, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.fila(q, user);
  }

  @Get(':id')
  @Roles(...LEITURA)
  @ApiOperation({ summary: 'Detalhe da assinatura (hash, timestamp, IP/dispositivo).' })
  detalhe(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.detalhe(id, user);
  }

  @Get(':id/comprovante')
  @Roles(...LEITURA)
  @ApiOperation({ summary: 'Comprovante verificavel.' })
  comprovante(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.comprovante(id, undefined, user);
  }

  @Post(':id/homologar')
  @Roles(PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL)
  @ApiOperation({ summary: 'Contra-assinatura do RH (homologa o fechamento assinado).' })
  homologar(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado, @Req() req: Request) {
    return this.service.homologar(id, user, extrairCtx(req));
  }
}
