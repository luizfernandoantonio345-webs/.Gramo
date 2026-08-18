import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
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
import { RefreshDto } from './dto/admin.dto';
import {
  CriarConviteDto,
  FuncionarioLoginDto,
  PrimeiroAcessoDto,
  RecuperarSenhaDto,
  RedefinirSenhaDto,
} from './dto/funcionario.dto';
import { FuncionarioAuthService } from './funcionario-auth.service';

/** Tela 1 -- autenticacao e primeiro acesso do funcionario. */
@ApiTags('auth-funcionario')
// Rate limit estrito por IP (brute force / credential stuffing). Nao afeta o
// quiosque (que usa token de dispositivo, nao login de funcionario).
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller({ path: 'auth/funcionario', version: '1' })
export class FuncionarioAuthController {
  constructor(private readonly service: FuncionarioAuthService) {}

  @Get('avatar')
  @ApiOperation({
    summary: 'Preview de identidade pre-login: retorna primeiro nome + foto aprovada por CPF.',
  })
  avatar(@Query('cpf') cpf: string) {
    return this.service.avatar(cpf ?? '');
  }

  @Post('primeiro-acesso')
  @HttpCode(200)
  @ApiOperation({ summary: 'Primeiro acesso via codigo de convite + consentimento LGPD.' })
  primeiroAcesso(@Body() dto: PrimeiroAcessoDto, @Req() req: Request) {
    return this.service.primeiroAcesso(
      dto.codigo,
      dto.cpf,
      dto.senha,
      dto.aceiteTermos,
      extrairCtx(req),
    );
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login com CPF + senha (bloqueia apos 5 falhas por 15 min).' })
  login(@Body() dto: FuncionarioLoginDto, @Req() req: Request) {
    return this.service.login(dto.cpf, dto.senha, extrairCtx(req));
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renova a sessao.' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.service.refresh(dto.refreshToken, extrairCtx(req));
  }

  @Post('recuperar-senha')
  @HttpCode(202)
  @ApiOperation({ summary: 'Solicita recuperacao de senha (responde sempre 202).' })
  async recuperar(@Body() dto: RecuperarSenhaDto, @Req() req: Request) {
    await this.service.recuperarSenha(dto.cpf, extrairCtx(req));
    return { mensagem: 'Se o CPF existir, enviaremos as instrucoes de recuperacao.' };
  }

  @Post('redefinir-senha')
  @HttpCode(204)
  @ApiOperation({ summary: 'Redefine a senha com o token de recuperacao.' })
  async redefinir(@Body() dto: RedefinirSenhaDto, @Req() req: Request) {
    await this.service.redefinirSenha(dto.token, dto.novaSenha, extrairCtx(req));
  }
}

/** Emissao de convites pelo RH (ponte para o cadastro completo da Fase 3). */
@ApiTags('convites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'convites', version: '1' })
export class ConviteController {
  constructor(private readonly service: FuncionarioAuthService) {}

  @Post()
  @Roles(PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL)
  @ApiOperation({ summary: 'Gera convite de primeiro acesso para um funcionario.' })
  criar(@Body() dto: CriarConviteDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.criarConvite(dto, user);
  }
}
