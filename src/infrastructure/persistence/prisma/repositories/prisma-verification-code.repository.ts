import { Injectable } from '@nestjs/common';
import {
  CreateVerificationCodeInput,
  VerificationCodeRecord,
  VerificationCodeRepository,
} from '../../../../application/verification/ports/verification-code.repository.port';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaVerificationCodeRepository implements VerificationCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateVerificationCodeInput): Promise<VerificationCodeRecord> {
    const record = await this.prisma.verificationCode.create({
      data: {
        id: input.id,
        email: input.email.toLowerCase(),
        accountId: input.accountId ?? null,
        purpose: input.purpose,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        maxAttempts: input.maxAttempts ?? 5,
        attempts: 0,
        ...(input.now ? { createdAt: input.now, updatedAt: input.now } : {}),
      },
    });

    return {
      id: record.id,
      email: record.email,
      accountId: record.accountId,
      purpose: record.purpose,
      codeHash: record.codeHash,
      attempts: record.attempts,
      maxAttempts: record.maxAttempts,
      usedAt: record.usedAt,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async findLatest(email: string, purpose: string): Promise<VerificationCodeRecord | null> {
    const record = await this.prisma.verificationCode.findFirst({
      where: {
        email: email.toLowerCase(),
        purpose,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      email: record.email,
      accountId: record.accountId,
      purpose: record.purpose,
      codeHash: record.codeHash,
      attempts: record.attempts,
      maxAttempts: record.maxAttempts,
      usedAt: record.usedAt,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async incrementAttempts(id: string): Promise<void> {
    await this.prisma.verificationCode.update({
      where: { id },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });
  }

  async markUsed(id: string, usedAt: Date): Promise<void> {
    await this.prisma.verificationCode.update({
      where: { id },
      data: { usedAt },
    });
  }
}
