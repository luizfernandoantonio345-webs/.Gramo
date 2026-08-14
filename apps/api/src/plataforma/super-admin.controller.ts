import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatusEmpresa } from '@prisma/client';
import type { Request } from 'express';
import type { JwtPayload } from '../common/auth/jwt-payload';
import { extrairCtx } from '../common/http/request-ctx';
import { CurrentSuperAdmin } from './current-super.decorator';
import { CriarEmpresaDto, CriarPlanoDto, GerarFaturaDto } from './dto/plataforma.dto';
import { SuperAdminService } from './super-admin.service';
import { SuperAuthGuard } from './super-auth.guard';

/** ADM 0 -- gestao da plataforma (empresas, planos, faturamento). */
@ApiTags('super-admin')
@ApiBearerAuth()
@UseGuards(SuperAuthGuard)
@Controller({ path: 'super', version: '1' })
export class SuperAdminController {
  constructor(private readonly service: SuperAdminService) {}

  @Get('empresas')
  @ApiOperation({ summary: 'Lista empresas-cliente (metadados de plataforma).' })
  listarEmpresas() {
    return this.service.listarEmpresas();
  }

  @Post('empresas')
  @ApiOperation({ summary: 'Cadastra empresa-cliente (onboarding).' })
  criarEmpresa(
    @Body() dto: CriarEmpresaDto,
    @CurrentSuperAdmin() sa: JwtPayload,
    @Req() req: Request,
  ) {
    return this.service.criarEmpresa(dto, sa.sub, extrairCtx(req));
  }

  @Post('empresas/:id/suspender')
  @ApiOperation({ summary: 'Suspende empresa (soft, reversivel; nunca apaga).' })
  suspender(@Param('id') id: string, @CurrentSuperAdmin() sa: JwtPayload, @Req() req: Request) {
    return this.service.alterarStatus(id, StatusEmpresa.SUSPENSA, sa.sub, extrairCtx(req));
  }

  @Post('empresas/:id/ativar')
  @ApiOperation({ summary: 'Reativa empresa suspensa.' })
  ativar(@Param('id') id: string, @CurrentSuperAdmin() sa: JwtPayload, @Req() req: Request) {
    return this.service.alterarStatus(id, StatusEmpresa.ATIVA, sa.sub, extrairCtx(req));
  }

  @Get('empresas/:id/uso')
  @ApiOperation({ summary: 'Metricas de uso (agregados; sem dados operacionais).' })
  uso(@Param('id') id: string) {
    return this.service.uso(id);
  }

  @Get('planos')
  listarPlanos() {
    return this.service.listarPlanos();
  }

  @Post('planos')
  criarPlano(@Body() dto: CriarPlanoDto, @CurrentSuperAdmin() sa: JwtPayload, @Req() req: Request) {
    return this.service.criarPlano(dto, sa.sub, extrairCtx(req));
  }

  @Get('faturas')
  listarFaturas(@Query('empresaId') empresaId?: string) {
    return this.service.listarFaturas(empresaId);
  }

  @Post('faturas')
  gerarFatura(
    @Body() dto: GerarFaturaDto,
    @CurrentSuperAdmin() sa: JwtPayload,
    @Req() req: Request,
  ) {
    return this.service.gerarFatura(dto, sa.sub, extrairCtx(req));
  }

  @Post('faturas/:id/pagar')
  pagar(@Param('id') id: string, @CurrentSuperAdmin() sa: JwtPayload, @Req() req: Request) {
    return this.service.marcarFaturaPaga(id, sa.sub, extrairCtx(req));
  }
}
