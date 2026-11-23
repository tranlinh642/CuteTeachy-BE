import { Injectable } from '@nestjs/common';
import {
  ConsumedExchangeCode,
  CreateExchangeCodeRecord,
  OneTimeExchangeCodeRepository,
} from '../../../application/google-auth/ports/one-time-exchange-code.repository.port';
import { PrismaService } from '../../persistence/prisma/prisma.service';

@Injectable()
export class PrismaOneTimeExchangeCodeRepository implements OneTimeExchangeCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(record: CreateExchangeCodeRecord): Promise<void> {
    await this.prisma.oneTimeExchangeCode.create({
      data: {
        id: record.id,
        accountId: record.accountId,
        codeHash: record.codeHash,
        remember: record.remember,
        expiresAt: record.expiresAt,
      },
    });
  }

  async consume(codeHash: string, now: Date): Promise<ConsumedExchangeCode | null> {
    return await this.prisma.$transaction(async (tx) => {
      const record = await tx.oneTimeExchangeCode.findUnique({
        where: { codeHash },
      });

      if (!record) {
        return null;
      }

      if (record.usedAt !== null || record.expiresAt <= now) {
        return null;
      }

      const updated = await tx.oneTimeExchangeCode.updateMany({
        where: {
          id: record.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (updated.count !== 1) {
        return null;
      }

      return {
        id: record.id,
        accountId: record.accountId,
        remember: record.remember,
      };
    });
  }
}
