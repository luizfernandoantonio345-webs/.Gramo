import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Envio de e-mail (recuperacao de senha, convite, notificacoes). Em producao usa
 * SMTP (nodemailer) quando SMTP_HOST esta definido; em dev, sem SMTP, apenas
 * registra no log -- nunca falha o fluxo de negocio por causa de e-mail.
 */
@Injectable()
export class NotificacaoService {
  private readonly logger = new Logger(NotificacaoService.name);
  private readonly transporter: Transporter | null;

  constructor() {
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
          : undefined,
      });
      this.logger.log('SMTP configurado para envio de e-mails.');
    } else {
      this.transporter = null;
      this.logger.warn('SMTP nao configurado -- e-mails serao apenas registrados (dev).');
    }
  }

  async enviarEmail(
    para: string | null | undefined,
    assunto: string,
    corpo: string,
  ): Promise<void> {
    if (!para) {
      this.logger.warn(`E-mail "${assunto}" nao enviado: destinatario ausente.`);
      return;
    }
    if (!this.transporter) {
      // Dev: sem SMTP, registra para inspecao (nao usar em producao).
      this.logger.log(`[EMAIL dev] para=${para} | ${assunto} | ${corpo}`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM ?? 'no-reply@rep-p.local',
        to: para,
        subject: assunto,
        text: corpo,
      });
    } catch (e) {
      // Falha de e-mail nunca derruba o fluxo (ex.: recuperacao continua valida).
      this.logger.error(`Falha ao enviar e-mail para ${para}: ${(e as Error).message}`);
    }
  }
}
