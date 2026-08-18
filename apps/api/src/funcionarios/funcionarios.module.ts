import { Module } from '@nestjs/common';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import {
  DocumentoAdminController,
  FuncionarioSelfController,
  FuncionariosController,
} from './funcionarios.controller';
import { FuncionariosService } from './funcionarios.service';

/** Fase 3 -- Funcionario e documentos: Tela 4 + ADM 2 + perfil self-service. */
@Module({
  controllers: [
    DocumentosController,
    FuncionariosController,
    DocumentoAdminController,
    FuncionarioSelfController,
  ],
  providers: [DocumentosService, FuncionariosService],
})
export class FuncionariosModule {}
