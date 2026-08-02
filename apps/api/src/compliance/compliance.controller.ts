import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PapelAdmin, TipoExportacao } from '@prisma/client';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { ComprovanteService } from './comprovante.service';
import { PeriodoDto } from './dto/periodo.dto';
import { ExportacaoService } from './exportacao.service';
import { FiscalizacaoService } from './fiscalizacao.service';

const COMPLIANCE = [PapelAdmin.RH_MASTER, PapelAdmin.AUDITORIA] as const;

/** ADM 6 -- Exportacoes legais (AFD/AEJ) e fiscalizacao. */
@ApiTags('adm-exportacoes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/exportacoes', version: '1' })
export class ExportacaoController {
  constructor(private readonly service: ExportacaoService) {}

  @Post('afd')
  @Roles(...COMPLIANCE)
  @ApiOperation({ summary: 'Gera o AFD do periodo (hash + assinatura + registro).' })
  gerarAfd(@Body() dto: PeriodoDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.exportar(TipoExportacao.AFD, new Date(dto.inicio), new Date(dto.fim), user, dto.filialId);
  }

  @Post('aej')
  @Roles(...COMPLIANCE)
  @ApiOperation({ summary: 'Gera o AEJ do periodo.' })
  gerarAej(@Body() dto: PeriodoDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.exportar(TipoExportacao.AEJ, new Date(dto.inicio), new Date(dto.fim), user, dto.filialId);
  }

  @Get()
  @Roles(...COMPLIANCE)
  @ApiOperation({ summary: 'Lista exportacoes geradas.' })
  listar() {
    return this.service.listar();
  }

  @Get(':id/download')
  @Roles(...COMPLIANCE)
  @ApiOperation({ summary: 'Baixa o arquivo (decifra + confere integridade).' })
  download(@Param('id') id: string) {
    return this.service.download(id);
  }
}

/** ADM 6 -- comprovante de ponto PAdES. */
@ApiTags('adm-comprovantes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/comprovantes', version: '1' })
export class ComprovanteController {
  constructor(private readonly service: ComprovanteService) {}

  @Get('ponto/:id')
  @Roles(...COMPLIANCE)
  @ApiOperation({ summary: 'Comprovante de ponto em PDF assinado (PAdES-B).' })
  ponto(@Param('id') id: string) {
    return this.service.gerarComprovantePonto(id);
  }
}

/** ADM 6 -- pacote de fiscalizacao. */
@ApiTags('adm-fiscalizacao')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/relatorios', version: '1' })
export class FiscalizacaoController {
  constructor(private readonly service: FiscalizacaoService) {}

  @Post('fiscalizacao')
  @Roles(...COMPLIANCE)
  @ApiOperation({ summary: 'Gera o pacote de fiscalizacao (AFD + AEJ + trilha).' })
  pacote(@Body() dto: PeriodoDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.pacote(new Date(dto.inicio), new Date(dto.fim), user, dto.filialId);
  }
}
