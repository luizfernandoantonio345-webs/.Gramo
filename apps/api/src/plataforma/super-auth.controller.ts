import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { extrairCtx } from '../common/http/request-ctx';
import {
  SuperDesafio2faDto,
  SuperLoginDto,
  SuperRefreshDto,
  SuperVerificar2faDto,
} from './dto/plataforma.dto';
import { SuperAuthService } from './super-auth.service';

/** ADM 0 -- autenticacao do Super Admin (plataforma). 2FA obrigatorio. */
@ApiTags('super-auth')
@Throttle({ default: { limit: 10, ttl: 60000 } }) // brute force / credential stuffing
@Controller({ path: 'super/auth', version: '1' })
export class SuperAuthController {
  constructor(private readonly service: SuperAuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Passo 1: e-mail + senha -> desafio de 2FA.' })
  login(@Body() dto: SuperLoginDto) {
    return this.service.login(dto.email, dto.senha);
  }

  @Post('2fa/setup')
  @HttpCode(200)
  @ApiOperation({ summary: 'Primeiro acesso: gera segredo TOTP.' })
  setup(@Body() dto: SuperDesafio2faDto) {
    return this.service.iniciarSetup2fa(dto.desafioToken);
  }

  @Post('2fa/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Passo 2: valida TOTP e emite tokens.' })
  verify(@Body() dto: SuperVerificar2faDto, @Req() req: Request) {
    return this.service.verificar2fa(dto.desafioToken, dto.codigo, extrairCtx(req));
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: SuperRefreshDto, @Req() req: Request) {
    return this.service.refresh(dto.refreshToken, extrairCtx(req));
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: SuperRefreshDto) {
    await this.service.logout(dto.refreshToken);
  }
}
