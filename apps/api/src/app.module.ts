import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AssinaturasModule } from './assinaturas/assinaturas.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AusenciasModule } from './ausencias/ausencias.module';
import { BancoHorasModule } from './banco-horas/banco-horas.module';
import { AuthModule } from './auth/auth.module';
import { ComplianceModule } from './compliance/compliance.module';
import { ComunicadosModule } from './comunicados/comunicados.module';
import { ConfiguracoesModule } from './configuracoes/configuracoes.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FechamentoModule } from './fechamento/fechamento.module';
import { IntegracoesModule } from './integracoes/integracoes.module';
import { KioskModule } from './kiosk/kiosk.module';
import { RequestIdMiddleware } from './common/http/request-id.middleware';
import { NotificacaoModule } from './common/notificacoes/notificacao.module';
import { SecurityModule } from './common/security/security.module';
import { TenantMiddleware } from './common/tenant/tenant.middleware';
import { validateEnv } from './config/env';
import { FuncionariosModule } from './funcionarios/funcionarios.module';
import { PlataformaModule } from './plataforma/plataforma.module';
import { PontosModule } from './pontos/pontos.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { HealthModule } from './health/health.module';

/**
 * Modulo raiz. O TenantMiddleware resolve a empresa (subdominio) e ativa o
 * TenantContext/RLS para toda requisicao (health/docs sao dispensados dentro
 * do proprio middleware).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Rate limiting global (hardening) -- protege login/2FA de brute force.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    StorageModule,
    SecurityModule,
    NotificacaoModule,
    HealthModule,
    AuthModule,
    PontosModule,
    FuncionariosModule,
    AssinaturasModule,
    ComplianceModule,
    PlataformaModule,
    AuditoriaModule,
    ConfiguracoesModule,
    AusenciasModule,
    BancoHorasModule,
    DashboardModule,
    ComunicadosModule,
    IntegracoesModule,
    FechamentoModule,
    KioskModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // RequestId primeiro (correlacao de logs), depois a resolucao de tenant.
    consumer.apply(RequestIdMiddleware, TenantMiddleware).forRoutes('*');
  }
}
