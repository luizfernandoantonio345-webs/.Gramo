import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PapelAdmin } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { CriarDispositivoDto, KioskPontoDto } from './dto/kiosk.dto';
import { type DispositivoKioskCtx, KioskGuard } from './kiosk.guard';
import { KioskService } from './kiosk.service';

/** Gestao de dispositivos de quiosque (RH). */
@ApiTags('adm-kiosk')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/kiosk', version: '1' })
export class AdmKioskController {
  constructor(private readonly service: KioskService) {}

  @Post()
  @Roles(PapelAdmin.RH_MASTER)
  @ApiOperation({ summary: 'Cadastra um quiosque; retorna o token do dispositivo UMA vez.' })
  criar(@Body() dto: CriarDispositivoDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.criar(dto, user);
  }

  @Get()
  @Roles(PapelAdmin.RH_MASTER)
  @ApiOperation({ summary: 'Lista os dispositivos de quiosque.' })
  listar() {
    return this.service.listar();
  }

  @Post(':id/revogar')
  @Roles(PapelAdmin.RH_MASTER)
  @ApiOperation({ summary: 'Revoga (desativa) um dispositivo de quiosque.' })
  revogar(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.revogar(id, user);
  }
}

/** Endpoint do quiosque: autentica por token de dispositivo (sem JWT). */
@ApiTags('kiosk')
@Controller({ path: 'kiosk', version: '1' })
export class KioskPontoController {
  constructor(private readonly service: KioskService) {}

  @Post('ponto')
  @UseGuards(KioskGuard)
  @ApiOperation({ summary: 'Bate ponto no quiosque por CPF (nunca bloqueia).' })
  bater(@Body() dto: KioskPontoDto, @Req() req: Request & { kiosk: DispositivoKioskCtx }) {
    return this.service.baterPonto(req.kiosk, dto);
  }
}
