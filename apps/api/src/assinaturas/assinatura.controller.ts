import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MetodoAssinatura, TipoSujeito } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { extrairCtx } from '../common/http/request-ctx';
import { AssinaturaService } from './assinatura.service';
import { AssinarDto, RecusarDto } from './dto/assinatura.dto';

/** Tela 2 -- Folha de Pagamento e Assinatura Virtual (funcionario). */
@ApiTags('assinaturas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'assinaturas', version: '1' })
export class AssinaturaController {
  constructor(private readonly service: AssinaturaService) {}

  @Get()
  @ApiOperation({ summary: 'Lista documentos do funcionario (com status).' })
  listar(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.listar(this.func(user));
  }

  @Get('historico')
  @ApiOperation({ summary: 'Historico de documentos assinados.' })
  historico(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.historico(this.func(user));
  }

  @Get('chave-publica')
  @ApiOperation({ summary: 'Chave publica Ed25519 do servidor (verificacao).' })
  chavePublica() {
    return this.service.chavePublica();
  }

  @Get(':id/visualizar')
  @ApiOperation({ summary: 'Visualiza o documento (marca como visualizado).' })
  visualizar(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.visualizar(this.func(user), id);
  }

  @Post(':id/assinar')
  @ApiOperation({ summary: 'Assina (re-autentica; gera hash + timestamp + Ed25519).' })
  assinar(
    @Param('id') id: string,
    @Body() dto: AssinarDto,
    @CurrentUser() user: UsuarioAutenticado,
    @Req() req: Request,
  ) {
    return this.service.assinar(
      this.func(user),
      id,
      dto.senha,
      dto.metodo ?? MetodoAssinatura.SENHA,
      extrairCtx(req),
    );
  }

  @Post(':id/recusar')
  @ApiOperation({ summary: 'Recusa o documento (justificativa obrigatoria).' })
  recusar(
    @Param('id') id: string,
    @Body() dto: RecusarDto,
    @CurrentUser() user: UsuarioAutenticado,
    @Req() req: Request,
  ) {
    return this.service.recusar(this.func(user), id, dto.motivo, extrairCtx(req));
  }

  @Get(':id/comprovante')
  @ApiOperation({ summary: 'Comprovante verificavel da assinatura (do proprio funcionario).' })
  comprovante(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    // Escopa ao dono: um funcionario nao acessa o comprovante de outro (anti-IDOR).
    return this.service.comprovante(id, this.func(user));
  }

  private func(user: UsuarioAutenticado): string {
    if (user.tipo !== TipoSujeito.FUNCIONARIO) {
      throw new ForbiddenException('Apenas funcionarios assinam documentos.');
    }
    return user.sub;
  }
}
