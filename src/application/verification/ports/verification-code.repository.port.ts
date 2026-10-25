export const VERIFICATION_CODE_REPOSITORY = Symbol('VERIFICATION_CODE_REPOSITORY');

export interface VerificationCodeRecord {
  id: string;
  email: string;
  accountId: string | null;
  purpose: string;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  usedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVerificationCodeInput {
  id: string;
  email: string;
  accountId?: string | null;
  purpose: string;
  codeHash: string;
  expiresAt: Date;
  maxAttempts?: number;
  now?: Date;
}

export interface VerificationCodeRepository {
  create(input: CreateVerificationCodeInput): Promise<VerificationCodeRecord>;
  findLatest(email: string, purpose: string): Promise<VerificationCodeRecord | null>;
  incrementAttempts(id: string): Promise<void>;
  markUsed(id: string, usedAt: Date): Promise<void>;
}
