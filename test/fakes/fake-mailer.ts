import { Mailer } from '../../src/application/shared/ports/mailer.port';

export interface SentEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class FakeMailer implements Mailer {
  readonly sentEmails: SentEmail[] = [];

  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
    this.sentEmails.push({ to, subject, html, text });
  }

  clear(): void {
    this.sentEmails.length = 0;
  }
}
