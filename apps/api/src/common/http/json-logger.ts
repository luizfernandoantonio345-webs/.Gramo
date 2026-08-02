import { ConsoleLogger, type LogLevel } from '@nestjs/common';

/**
 * Logger de producao: emite UMA linha JSON por evento (parseavel por
 * Datadog/Loki/CloudWatch). Em desenvolvimento mantem o formato colorido do
 * Nest. Ative com LOG_JSON=true (recomendado em producao).
 *
 * NUNCA logar segredos/biometria: os services ja logam apenas metadados.
 */
export class JsonLogger extends ConsoleLogger {
  private emitir(level: LogLevel, message: unknown, context?: string): void {
    process.stdout.write(
      `${JSON.stringify({
        ts: new Date().toISOString(),
        level,
        context: context ?? this.context,
        message: typeof message === 'string' ? message : JSON.stringify(message),
      })}\n`,
    );
  }

  log(message: unknown, context?: string): void {
    this.emitir('log', message, context);
  }
  error(message: unknown, stackOrContext?: string, context?: string): void {
    this.emitir('error', message, context ?? stackOrContext);
  }
  warn(message: unknown, context?: string): void {
    this.emitir('warn', message, context);
  }
  debug(message: unknown, context?: string): void {
    this.emitir('debug', message, context);
  }
  verbose(message: unknown, context?: string): void {
    this.emitir('verbose', message, context);
  }
}
