import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SignatureService } from '../../assinaturas/signature.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { EscopoFilialService } from '../authz/escopo-filial.service';

/**
 * Modulo global de seguranca: disponibiliza JwtModule (JwtService), os guards,
 * o SignatureService (Ed25519) e o EscopoFilialService (authz por filial) para
 * qualquer modulo sem reimportar.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [JwtAuthGuard, RolesGuard, SignatureService, EscopoFilialService],
  exports: [JwtAuthGuard, RolesGuard, JwtModule, SignatureService, EscopoFilialService],
})
export class SecurityModule {}
