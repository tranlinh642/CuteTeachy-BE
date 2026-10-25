export const MAILER = Symbol('MAILER');

export interface Mailer {
  sendEmail(to: string, subject: string, html: string, text?: string): Promise<void>;
}
