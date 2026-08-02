import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TipoSujeito } from '@prisma/client';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { UsuarioAutenticado } from '../common/auth/jwt-payload';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { DocumentosService } from './documentos.service';
import { EnviarDocumentoDto } from './dto/funcionario.dto';

/** Tela 4 -- Documentacao Necessaria (funcionario). */
@ApiTags('documentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'documentos', version: '1' })
export class DocumentosController {
  constructor(private readonly service: DocumentosService) {}

  @Get()
  @ApiOperation({ summary: 'Status de cada documento exigido do funcionario.' })
  listar(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.statusExigidos(this.exigirFuncionario(user));
  }

  @Post()
  @ApiOperation({ summary: 'Envia um documento (PDF/JPG/PNG ate 10MB).' })
  enviar(@Body() dto: EnviarDocumentoDto, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.enviar(this.exigirFuncionario(user), dto);
  }

  private exigirFuncionario(user: UsuarioAutenticado): string {
    if (user.tipo !== TipoSujeito.FUNCIONARIO) {
      throw new ForbiddenException('Apenas funcionarios enviam documentos.');
    }
    return user.sub;
  }
}
