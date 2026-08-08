import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PapelAdmin } from '@prisma/client';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import {
  AtualizarFuncionarioDto,
  CriarFuncionarioDto,
  DecidirDocumentoDto,
  ImportarCsvDto,
  ListarFuncionariosQuery,
} from './dto/funcionario.dto';
import { FuncionariosService } from './funcionarios.service';

const LEITURA = [PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL, PapelAdmin.AUDITORIA] as const;
const ESCRITA = [PapelAdmin.RH_MASTER, PapelAdmin.GESTOR_FILIAL] as const;

/** ADM 2 -- Gestao de Funcionarios. */
@ApiTags('adm-funcionarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/funcionarios', version: '1' })
export class FuncionariosController {
  constructor(private readonly service: FuncionariosService) {}

  @Get()
  @Roles(...LEITURA)
  @ApiOperation({ summary: 'Lista funcionarios (filtro por status e busca; escopo por filial).' })
  listar(@Query() q: ListarFuncionariosQuery, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.listar(q, user);
  }

  @Post()
  @Roles(...ESCRITA)
  @ApiOperation({ summary: 'Cadastra funcionario (valida CPF e unicidade).' })
  criar(@Body() dto: CriarFuncionarioDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.criar(dto, user);
  }

  @Post('importar')
  @Roles(...ESCRITA)
  @ApiOperation({ summary: 'Importacao em lote CSV (tudo-ou-nada).' })
  importar(@Body() dto: ImportarCsvDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.importarCsv(dto.conteudo, user);
  }

  @Get('alertas/vencimento')
  @Roles(...LEITURA)
  @ApiOperation({ summary: 'Documentos vencendo em 30 dias (ou vencidos).' })
  alertas() {
    return this.service.alertasVencimento();
  }

  @Patch(':id')
  @Roles(...ESCRITA)
  atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarFuncionarioDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.atualizar(id, dto, user);
  }

  @Post(':id/foto/aprovar')
  @Roles(...ESCRITA)
  @ApiOperation({ summary: 'Aprova a foto de referencia (libera facial).' })
  aprovarFoto(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.aprovarFoto(id, user);
  }

  @Post(':id/desligar')
  @Roles(...ESCRITA)
  @ApiOperation({ summary: 'Desliga o funcionario (soft delete).' })
  desligar(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.desligar(id, user);
  }

  @Get(':id/documentos')
  @Roles(...LEITURA)
  documentos(@Param('id') id: string) {
    return this.service.documentos(id);
  }

  @Get(':id/foto-referencia')
  @Roles(...LEITURA)
  @ApiOperation({
    summary: 'Foto de referencia (selfie) do funcionario, para o RH conferir/aprovar.',
  })
  fotoReferencia(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.fotoReferencia(id, user);
  }
}

/** ADM 2 -- decisao sobre documentos enviados. */
@ApiTags('adm-documentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/documentos', version: '1' })
export class DocumentoAdminController {
  constructor(private readonly service: FuncionariosService) {}

  @Post(':id/decidir')
  @Roles(...ESCRITA)
  @ApiOperation({ summary: 'Aprova/rejeita um documento (motivo na rejeicao).' })
  decidir(
    @Param('id') id: string,
    @Body() dto: DecidirDocumentoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.decidirDocumento(id, dto, user);
  }
}
