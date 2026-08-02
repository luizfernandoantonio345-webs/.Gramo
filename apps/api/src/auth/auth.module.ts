import { Module } from '@nestjs/common';
import { AccessLogService } from './access-log.service';
import { AdminAuthController, AdminController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { ConviteController, FuncionarioAuthController } from './funcionario-auth.controller';
import { FuncionarioAuthService } from './funcionario-auth.service';
import { TokensService } from './tokens.service';

/**
 * Modulo de autenticacao e acesso (Fase 1): ADM 1 (admin + 2FA) e Tela 1
 * (funcionario). JwtModule/guards vem do SecurityModule (global). O segredo do
 * JWT e passado por assinatura/verificacao (secrets distintos access/refresh).
 */
@Module({
  controllers: [AdminAuthController, AdminController, FuncionarioAuthController, ConviteController],
  providers: [AdminAuthService, FuncionarioAuthService, TokensService, AccessLogService],
  exports: [AccessLogService],
})
export class AuthModule {}
