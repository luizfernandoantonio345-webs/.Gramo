import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TipoSujeito } from '@prisma/client';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import {
  RegapStatusDto,
  RegistrarPontoDto,
  SyncPontosDto,
  UploadReferenciaDto,
} from './dto/ponto.dto';
import { PontoService } from './ponto.service';

/** Tela 3 -- Bater Ponto (funcionario). */
@ApiTags('pontos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'pontos', version: '1' })
export class PontoController {
  constructor(private readonly service: PontoService) {}

  @Post()
  @ApiOperation({ summary: 'Registra a marcacao (online). Nunca bloqueia.' })
  registrar(@Body() dto: RegistrarPontoDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.registrar(this.exigirFuncionario(user), dto);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sincroniza a fila offline (idempotente por UUID).' })
  sync(@Body() dto: SyncPontosDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service
      .sync(this.exigirFuncionario(user), dto.registros)
      .then((resultados) => ({ resultados }));
  }

  @Get('regap-status')
  @ApiOperation({ summary: 'Status da REGAP em tempo real (anel de presenca).' })
  statusRegap(@Query() q: RegapStatusDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.statusRegap(this.exigirFuncionario(user), q.latitude, q.longitude);
  }

  @Get('hoje')
  @ApiOperation({ summary: 'Espelho de ponto do dia corrente.' })
  hoje(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.espelhoDoDia(this.exigirFuncionario(user));
  }

  @Get('minha-referencia')
  @ApiOperation({
    summary: 'Foto de referencia (aprovada) do proprio funcionario, p/ matching facial.',
  })
  minhaReferencia(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.minhaReferencia(this.exigirFuncionario(user));
  }

  @Post('minha-referencia')
  @ApiOperation({
    summary: 'Envia/atualiza a selfie de referencia (fica pendente de aprovacao do RH).',
  })
  enviarReferencia(@Body() dto: UploadReferenciaDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.salvarMinhaReferencia(this.exigirFuncionario(user), dto.fotoBase64);
  }

  private exigirFuncionario(user: UsuarioAutenticado): string {
    if (user.tipo !== TipoSujeito.FUNCIONARIO) {
      throw new ForbiddenException('Apenas funcionarios registram ponto.');
    }
    return user.sub;
  }
}
