import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PapelAdmin } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { extrairCtx } from '../common/http/request-ctx';
import { AdminAuthService } from './admin-auth.service';
import {
  AdminLoginDto,
  CriarAdminDto,
  Desafio2faDto,
  RefreshDto,
  Verificar2faDto,
} from './dto/admin.dto';
import { TrocarSenhaObrigatorioDto } from './dto/emergencia.dto';

/** ADM 1 -- autenticacao do administrador (2FA obrigatorio). */
@ApiTags('auth-admin')
// Rate limit ESTRITO por IP nas rotas de auth (login/2FA/refresh) -- resiste a
// brute force / credential stuffing, independente do lockout de conta. Fica
// separado do limite global folgado (dimensionado para o quiosque da obra).
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller({ path: 'auth/admin', version: '1' })
export class AdminAuthController {
  constructor(private readonly service: AdminAuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Passo 1: e-mail + senha. Retorna desafio de 2FA.' })
  login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    return this.service.login(dto.email, dto.senha, extrairCtx(req));
  }

  @Post('2fa/setup')
  @HttpCode(200)
  @ApiOperation({ summary: 'Primeiro acesso: gera segredo TOTP (otpauth/QR).' })
  setup2fa(@Body() dto: Desafio2faDto) {
    return this.service.iniciarSetup2fa(dto.desafioToken);
  }

  @Post('2fa/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Passo 2: valida codigo TOTP e emite os tokens.' })
  verify2fa(@Body() dto: Verificar2faDto, @Req() req: Request) {
    return this.service.verificar2fa(dto.desafioToken, dto.codigo, extrairCtx(req));
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renova a sessao (rotaciona o refresh token).' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.service.refresh(dto.refreshToken, extrairCtx(req));
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    await this.service.logout(dto.refreshToken, extrairCtx(req), user.sub);
  }

  @Post('trocar-senha-obrigatorio')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Troca de senha obrigatoria (protocolo de emergencia).',
    description:
      'Apresente o trocaSenhaToken recebido no login quando requiresPasswordChange=true. ' +
      'Apos a troca bem-sucedida, um par completo de tokens e emitido.',
  })
  trocarSenhaObrigatorio(@Body() dto: TrocarSenhaObrigatorioDto, @Req() req: Request) {
    return this.service.trocarSenhaObrigatorio(dto.trocaSenhaToken, dto.novaSenha, extrairCtx(req));
  }
}

/** ADM 1 -- gestao de administradores (somente RH Master). */
@ApiTags('admins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admins', version: '1' })
export class AdminController {
  constructor(private readonly service: AdminAuthService) {}

  @Post()
  @Roles(PapelAdmin.RH_MASTER)
  @ApiOperation({ summary: 'Cadastra um novo administrador.' })
  criar(@Body() dto: CriarAdminDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.criarAdmin(dto, user);
  }

  @Get()
  @Roles(PapelAdmin.RH_MASTER, PapelAdmin.AUDITORIA)
  @ApiOperation({ summary: 'Lista administradores da empresa.' })
  listar() {
    return this.service.listarAdmins();
  }

  @Post(':id/revogar')
  @HttpCode(204)
  @Roles(PapelAdmin.RH_MASTER)
  @ApiOperation({ summary: 'Revoga o acesso de um administrador.' })
  async revogar(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    await this.service.revogarAcesso(id, user);
  }
}
