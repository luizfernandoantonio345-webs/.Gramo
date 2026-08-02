import 'reflect-metadata';
// Carrega o .env ANTES de qualquer provider ser construido. Sem isto,
// construtores (ex.: PrismaSuperService) leem process.env antes do ConfigModule
// popular as variaveis, e SUPER_DATABASE_URL "some" (cai para a role errada).
// Em producao (env do SO/container) e no-op. Ver plataforma/prisma-super.service.
import 'dotenv/config';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter';
import { JsonLogger } from './common/http/json-logger';

// Teto de corpo da requisicao: suporta uploads base64 (foto/documento cifrados)
// mas limita o tamanho (DoS). 25MB ~ arquivo de 20MB + overhead de base64.
const LIMITE_BODY = '25mb';

// NSR e outros campos sao BigInt; sem isto JSON.stringify quebra na serializacao.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  // bodyParser: false -> registramos parsers com limite controlado (abaixo).
  // LOG_JSON=true -> logs em JSON (uma linha por evento) para producao.
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    ...(process.env.LOG_JSON === 'true' ? { logger: new JsonLogger() } : {}),
  });
  const logger = new Logger('bootstrap');
  const producao = process.env.NODE_ENV === 'production';

  // Hardening: cabecalhos de seguranca (CSP/HSTS/etc.).
  app.use(helmet());
  app.use(json({ limit: LIMITE_BODY }));
  app.use(urlencoded({ extended: true, limit: LIMITE_BODY }));

  // CORS restrito por env (CORS_ORIGINS = lista separada por virgula). Sem a var,
  // em producao nega cross-origin; em dev libera localhost.
  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: origins.length > 0 ? origins : producao ? false : /localhost:\d+$/,
    credentials: true,
  });

  // API versionada: /api/v1/...
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Validacao/whitelist global: DTOs com class-validator; rejeita campos extras.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Filtro global de erros: resposta JSON consistente (com requestId), mapeia
  // erros do Prisma para status HTTP e nunca vaza stack em producao.
  app.useGlobalFilters(new AllExceptionsFilter());

  // OpenAPI/Swagger apenas fora de producao (nao expor superficie da API).
  if (!producao) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('REP-P API')
      .setDescription('Sistema de Ponto Eletronico Corporativo (REP-P)')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  const port = process.env.API_PORT ? Number(process.env.API_PORT) : 3000;
  await app.listen(port);
  logger.log(`REP-P API em http://localhost:${port}/api/v1 (docs: /api/docs)`);
}

void bootstrap();
