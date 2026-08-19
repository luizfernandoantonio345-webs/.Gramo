import { Module } from '@nestjs/common';
import { AejService } from './aej.service';
import { AfdService } from './afd.service';
import { CertificadoService } from './certificado.service';
import {
  ComplianceStatusController,
  ComprovanteController,
  ExportacaoController,
  FiscalizacaoController,
} from './compliance.controller';
import { ComplianceStatusService } from './compliance-status.service';
import { ComprovanteService } from './comprovante.service';
import { ExportacaoService } from './exportacao.service';
import { FiscalizacaoService } from './fiscalizacao.service';

/** Fase 5 -- Compliance Portaria 671: AFD/AEJ, comprovante PAdES, fiscalizacao. */
@Module({
  controllers: [
    ComplianceStatusController,
    ExportacaoController,
    ComprovanteController,
    FiscalizacaoController,
  ],
  providers: [
    ComplianceStatusService,
    AfdService,
    AejService,
    ExportacaoService,
    FiscalizacaoService,
    CertificadoService,
    ComprovanteService,
  ],
})
export class ComplianceModule {}
