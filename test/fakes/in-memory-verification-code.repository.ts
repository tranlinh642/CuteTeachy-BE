import {
  CreateVerificationCodeInput,
  VerificationCodeRecord,
  VerificationCodeRepository,
} from '../../src/application/verification/ports/verification-code.repository.port';

export class InMemoryVerificationCodeRepository implements VerificationCodeRepository {
  private readonly codes: VerificationCodeRecord[] = [];

  async create(input: CreateVerificationCodeInput): Promise<VerificationCodeRecord> {
    const now = input.now ?? new Date();
    const record: VerificationCodeRecord = {
      id: input.id,
      email: input.email.toLowerCase(),
      accountId: input.accountId ?? null,
      purpose: input.purpose,
      codeHash: input.codeHash,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 5,
      usedAt: null,
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
    };
    this.codes.push(record);
    return record;
  }

  async findLatest(email: string, purpose: string): Promise<VerificationCodeRecord | null> {
    const normalized = email.toLowerCase();
    const matching = this.codes
      .filter((c) => c.email === normalized && c.purpose === purpose)
      .slice()
      .reverse()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return matching[0] ?? null;
  }

  async incrementAttempts(id: string): Promise<void> {
    const record = this.codes.find((c) => c.id === id);
    if (record) {
      record.attempts += 1;
      record.updatedAt = new Date();
    }
  }

  async markUsed(id: string, usedAt: Date): Promise<void> {
    const record = this.codes.find((c) => c.id === id);
    if (record) {
      record.usedAt = usedAt;
      record.updatedAt = usedAt;
    }
  }

  getAll(): VerificationCodeRecord[] {
    return [...this.codes];
  }

  addManualRecord(record: VerificationCodeRecord): void {
    this.codes.push(record);
  }
}
