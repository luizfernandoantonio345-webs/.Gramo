import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OnboardingDto } from './dto/onboarding.dto';
import { OnboardingService } from './onboarding.service';

/**
 * Rota PUBLICA de cadastro de empresa (nao passa pelo TenantMiddleware -- o
 * middleware isenta o prefixo /publico). Rate limit mais estrito que o global
 * para conter abuso de signup.
 */
@ApiTags('publico-onboarding')
@Controller({ path: 'publico/onboarding', version: '1' })
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  @Post()
  @Throttle({ default: { ttl: 3600000, limit: 5 } }) // 5 cadastros por hora por IP
  @ApiOperation({ summary: 'Cadastra uma nova empresa (self-service) + admin RH_MASTER.' })
  cadastrar(@Body() dto: OnboardingDto) {
    return this.service.cadastrar(dto);
  }
}
