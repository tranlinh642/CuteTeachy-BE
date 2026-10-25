import { Inject, Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { Mailer } from '../../application/shared/ports/mailer.port';
import { APP_CONFIG, AppConfig } from '../config/app.config';

@Injectable()
export class SmtpMailer implements Mailer {
  private transporter: Transporter;
  private readonly from: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.from = config.MAIL_FROM;
    const auth =
      config.SMTP_USER && config.SMTP_PASS
        ? {
            user: config.SMTP_USER,
            pass: config.SMTP_PASS,
          }
        : undefined;

    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth,
    });
  }

  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html,
      text: text || undefined,
    });
  }
}
