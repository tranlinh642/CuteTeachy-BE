export const CRON_SECRET_VERIFIER = Symbol('CRON_SECRET_VERIFIER');

export interface CronSecretVerifier {
  verify(secret: string): boolean;
}
