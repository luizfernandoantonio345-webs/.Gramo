import { Global, Module } from '@nestjs/common';
import { NotificacaoService } from './notificacao.service';

/** Modulo global de notificacoes (e-mail). */
@Global()
@Module({
  providers: [NotificacaoService],
  exports: [NotificacaoService],
})
export class NotificacaoModule {}
