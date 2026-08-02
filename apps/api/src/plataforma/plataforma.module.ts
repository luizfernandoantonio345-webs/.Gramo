import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { PrismaSuperService } from './prisma-super.service';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { SuperAuthController } from './super-auth.controller';
import { SuperAuthGuard } from './super-auth.guard';
import { SuperAuthService } from './super-auth.service';

/**
 * Fase 6 -- Plataforma/SaaS (ADM 0). Super Admin opera acima dos tenants, com
 * conexao propria (repp_super) sem acesso a dados operacionais. JwtModule vem do
 * SecurityModule (global).
 */
@Module({
  controllers: [SuperAuthController, SuperAdminController, OnboardingController],
  providers: [
    PrismaSuperService,
    SuperAuthService,
    SuperAdminService,
    SuperAuthGuard,
    OnboardingService,
  ],
})
export class PlataformaModule {}
